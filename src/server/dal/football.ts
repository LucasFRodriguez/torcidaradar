import "server-only";
import { dataFreshness } from "@/lib/sports/freshness";
import { cache } from "react";
import { limit } from "@/lib/security/http";
import { identity } from "@/lib/supabase/server";
import { demoState, demoTeams, demoFixtures } from "./demo";
import {
  concealFixture,
  type Snapshot,
  type Team,
  type Fixture,
  type Standing,
  type Season,
} from "@/lib/sports/domain";
import { HttpError } from "@/lib/security/validation";
export const snapshot = cache(async function snapshot(): Promise<Snapshot> {
  const demo = await demoState();
  if (demo) {
    const fixtures = demoFixtures();
    return {
      demo: true,
      teams: demoTeams,
      favorites: demo.favorites,
      fixtures: fixtures
        .filter(
          (f) =>
            demo.favorites.includes(f.home_team_id) ||
            demo.favorites.includes(f.away_team_id),
        )
        .map((f) => concealFixture(f, demo.hide_scores)),
      competitions: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          name: "Liga de Demonstração",
        },
      ],
      seasons: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          competition_id: "30000000-0000-4000-8000-000000000001",
          year: new Date().getUTCFullYear(),
          standings_available: false,
        },
      ],
      standings: [],
      hideScores: demo.hide_scores,
      timezone: demo.timezone,
      displayName: demo.display_name,
      deletionStatus: null,
      updatedAt: new Date().toISOString(),
      unavailable: false,
    };
  }
  const { db, user } = await identity();
  await limit(user.id + ":page", 180);
  const [profile, prefs, favorites, deletion, comps, seasons] =
    await Promise.all([
      db
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle(),
      db
        .from("user_preferences")
        .select("hide_scores,timezone")
        .eq("user_id", user.id)
        .maybeSingle(),
      db
        .from("user_favorite_teams")
        .select("team_id")
        .eq("user_id", user.id)
        .limit(100),
      db
        .from("account_deletion_requests")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle(),
      db.from("competitions").select("id,name").limit(100),
      db
        .from("competition_seasons")
        .select("id,competition_id,year,standings_available")
        .order("year", { ascending: false })
        .limit(200),
    ]);
  if ([profile, prefs, favorites, deletion].some((r) => r.error))
    throw new HttpError(503, "DADOS_PESSOAIS_INDISPONIVEIS");
  const ids = (favorites.data ?? []).map((f) => f.team_id as string);
  const fixtures = ids.length
    ? await db
        .from("fixtures")
        .select("*")
        .or(
          `and(or(home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")})),or(kickoff_at.is.null,and(kickoff_at.gte.${new Date(Date.now() - 30 * 86400000).toISOString()},kickoff_at.lte.${new Date(Date.now() + 31 * 86400000).toISOString()})))`,
        )
        .order("kickoff_at")
        .limit(500)
    : { data: [], error: null };
  const teamIds = [
    ...new Set([
      ...ids,
      ...(fixtures.data ?? []).flatMap(
        (f) => [f.home_team_id, f.away_team_id] as string[],
      ),
    ]),
  ];
  const teams = teamIds.length
    ? await db.from("teams").select("id,name,slug,country").in("id", teamIds)
    : { data: [], error: null };
  const memberships = ids.length
    ? await db
        .from("team_competitions")
        .select("season_id,team_id")
        .in("team_id", ids)
    : { data: [], error: null };
  const relevantSeasons = [
    ...new Set((memberships.data ?? []).map((m) => m.season_id as string)),
  ];
  const freshness = relevantSeasons.length
    ? await db
        .from("sports_data_freshness")
        .select("season_id,resource,last_success_at,state")
        .in("season_id", relevantSeasons)
        .eq("resource", "fixtures")
    : { data: [], error: null };
  const freshnessRows = relevantSeasons.map(
    (id) =>
      (freshness.data ?? []).find((f) => f.season_id === id) ?? {
        season_id: id,
        resource: "fixtures",
        last_success_at: null,
        state: "unavailable",
      },
  );
  const health = dataFreshness(
    freshnessRows.map((r) => ({
      ...r,
      season_year: (seasons.data ?? []).find((s) => s.id === r.season_id)?.year,
    })),
    !!(
      fixtures.error ||
      teams.error ||
      comps.error ||
      seasons.error ||
      memberships.error ||
      freshness.error
    ),
  );
  const favoriteSeasons = (seasons.data ?? []).filter((s) =>
    relevantSeasons.includes(s.id),
  );
  const competitionIds = favoriteSeasons.map((s) => s.competition_id);
  return {
    demo: false,
    teams: (teams.data ?? []) as Team[],
    favorites: ids,
    fixtures: ((fixtures.data ?? []) as Fixture[]).map((f) =>
      concealFixture(f, prefs.data?.hide_scores ?? false),
    ),
    competitions: (comps.data ?? []).filter((c) =>
      competitionIds.includes(c.id),
    ),
    seasons: favoriteSeasons as Season[],
    teamCompetitions: memberships.data ?? [],
    standings: [],
    hideScores: prefs.data?.hide_scores ?? false,
    timezone: prefs.data?.timezone ?? "America/Sao_Paulo",
    displayName: profile.data?.display_name ?? "",
    deletionStatus: deletion.data?.status ?? null,
    updatedAt: health.updatedAt,
    dataState: health.state,
    unavailable: health.state !== "ready",
  };
});
export async function findTeams(search: string, page: number) {
  if (await demoState())
    return demoTeams
      .filter((t) =>
        t.name
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
      )
      .slice((page - 1) * 20, page * 20);
  const { db, user } = await identity();
  await limit(user.id + ":search", 30);
  const { data, error } = await db
    .from("teams")
    .select("id,name,slug,country")
    .ilike("name", `%${search}%`)
    .order("name")
    .range((page - 1) * 20, page * 20 - 1);
  if (error) throw new HttpError(503, "TIMES_INDISPONIVEIS");
  return (data ?? []) as Team[];
}
export async function club(slug: string) {
  const data = await snapshot();
  if (data.demo) {
    const team = demoTeams.find((t) => t.slug === slug);
    return {
      data,
      team,
      fixtures: demoFixtures()
        .filter(
          (f) => f.home_team_id === team?.id || f.away_team_id === team?.id,
        )
        .map((f) => concealFixture(f, data.hideScores)),
      standings: [] as Standing[],
      memberships: data.seasons.map((s) => s.id),
      resourceFreshness: [] as {
        season_id: string;
        resource: string;
        last_success_at: string | null;
        state: string;
      }[],
    };
  }
  const { db } = await identity();
  const { data: team, error } = await db
    .from("teams")
    .select("id,name,slug,country")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new HttpError(503, "TIME_INDISPONIVEL");
  if (!team)
    return {
      data,
      team: null,
      fixtures: [],
      standings: [],
      memberships: [],
      resourceFreshness: [] as {
        season_id: string;
        resource: string;
        last_success_at: string | null;
        state: string;
      }[],
    };
  const [fixtures, memberships] = await Promise.all([
    db
      .from("fixtures")
      .select("*")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .order("kickoff_at", { ascending: false })
      .limit(100),
    db.from("team_competitions").select("season_id").eq("team_id", team.id),
  ]);
  const ids = (memberships.data ?? []).map((m) => m.season_id as string);
  const [clubSeasons, clubComps, clubFreshness] = await Promise.all([
    db
      .from("competition_seasons")
      .select("id,competition_id,year,standings_available")
      .in("id", ids)
      .order("year", { ascending: false }),
    db.from("competitions").select("id,name"),
    db
      .from("sports_data_freshness")
      .select("season_id,resource,last_success_at,state")
      .in("season_id", ids),
  ]);
  data.seasons = (clubSeasons.data ?? []) as Season[];
  data.competitions = (clubComps.data ?? []).filter((c) =>
    data.seasons.some((s) => s.competition_id === c.id),
  );
  const health = dataFreshness(
    (clubFreshness.data ?? []).map((r) => ({
      ...r,
      season_year: data.seasons.find((s) => s.id === r.season_id)?.year,
    })),
    !!(clubSeasons.error || clubComps.error || clubFreshness.error),
  );
  data.updatedAt = health.updatedAt;
  data.dataState = health.state;
  data.unavailable = health.state !== "ready";
  const standings = ids.length
    ? await db
        .from("standings")
        .select("*")
        .in("season_id", ids)
        .order("rank")
        .limit(500)
    : { data: [], error: null };
  const teamIds = [
    ...new Set([
      ...(fixtures.data ?? []).flatMap((f) => [f.home_team_id, f.away_team_id]),
      ...(standings.data ?? []).map((s) => s.team_id),
    ]),
  ];
  const other = teamIds.length
    ? await db.from("teams").select("id,name,slug,country").in("id", teamIds)
    : { data: [], error: null };
  if (fixtures.error || memberships.error || standings.error || other.error)
    throw new HttpError(503, "TIME_INDISPONIVEL");
  data.teams = [
    ...new Map(
      [...data.teams, ...((other.data ?? []) as Team[]), team as Team].map(
        (t) => [t.id, t],
      ),
    ).values(),
  ];
  return {
    data,
    team: team as Team,
    fixtures: ((fixtures.data ?? []) as Fixture[]).map((f) =>
      concealFixture(f, data.hideScores),
    ),
    standings: data.hideScores ? [] : ((standings.data ?? []) as Standing[]),
    memberships: ids,
    resourceFreshness: (clubFreshness.data ?? []) as {
      season_id: string;
      resource: string;
      last_success_at: string | null;
      state: string;
    }[],
  };
}
