import "server-only";
import type {
  League,
  ProviderTeam,
  ProviderFixture,
  ProviderStandings,
} from "./schemas";
import { ProviderError } from "./errors";
const targets = [
  { key: "serie-a", name: "serie a", type: "League" },
  { key: "serie-b", name: "serie b", type: "League" },
  { key: "copa-brasil", name: "copa do brasil", type: "Cup" },
] as const;
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export function discoverCompetitions(leagues: League[], season?: number) {
  if (!leagues.length) throw new ProviderError("empty_unverified");
  return targets.map((target) => {
    const found = leagues.filter(
      (l) =>
        normalize(l.country.name) === "brazil" &&
        normalize(l.league.name) === target.name &&
        l.league.type === target.type,
    );
    if (found.length !== 1)
      return {
        target: target.key,
        state: found.length ? "ambiguous" : "unavailable",
        provider_id: null,
        name: null,
        type: target.type,
        available_seasons: [],
        standings: false,
      };
    const l = found[0];
    const year = l.seasons.find((s) => s.year === season);
    return {
      target: target.key,
      state: season === undefined || year ? "advertised" : "unavailable",
      provider_id: l.league.id,
      name: l.league.name,
      type: l.league.type,
      available_seasons: l.seasons.map((s) => s.year),
      standings: year?.coverage.standings ?? false,
    };
  });
}
function unique(ids: number[]) {
  if (new Set(ids).size !== ids.length) throw new ProviderError("invalid_data");
}
export function mapTeams(teams: ProviderTeam[]) {
  if (!teams.length) throw new ProviderError("empty_unverified");
  unique(teams.map((t) => t.team.id));
  return teams.map(({ team: t }) => ({
    provider_id: t.id,
    name: t.name,
    country: t.country,
    slug:
      (normalize(t.name)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 135) || "clube") +
      "-" +
      t.id,
  }));
}
export function mapFixtures(
  fixtures: ProviderFixture[],
  league: number,
  season: number,
) {
  if (!fixtures.length) throw new ProviderError("empty_unverified");
  unique(fixtures.map((f) => f.fixture.id));
  return fixtures.map((f) => {
    if (
      f.league.id !== league ||
      f.league.season !== season ||
      f.teams.home.id === f.teams.away.id
    )
      throw new ProviderError("invalid_data");
    return {
      provider_id: f.fixture.id,
      home_id: f.teams.home.id,
      away_id: f.teams.away.id,
      kickoff_at: f.fixture.date,
      status: f.fixture.status.short,
      home_score: f.goals.home,
      away_score: f.goals.away,
      home_penalties: f.score.penalty.home,
      away_penalties: f.score.penalty.away,
      round: f.league.round ?? null,
    };
  });
}
export function mapStandings(
  data: ProviderStandings[],
  league: number,
  season: number,
) {
  if (data.some((s) => s.league.id !== league || s.league.season !== season))
    throw new ProviderError("invalid_data");
  const rows = data
    .flatMap((s) => s.league.standings.flat())
    .map((s) => ({
      team_id: s.team.id,
      group_name: s.group ?? "",
      rank: s.rank,
      points: s.points,
      played: s.all.played,
      wins: s.all.win,
      draws: s.all.draw,
      losses: s.all.lose,
    }));
  if (!rows.length) throw new ProviderError("empty_unverified");
  if (
    new Set(rows.map((r) => r.team_id + ":" + r.group_name)).size !==
    rows.length
  )
    throw new ProviderError("invalid_data");
  return rows;
}
