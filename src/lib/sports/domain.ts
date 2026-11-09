import { z } from "zod";
export const teamSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  country: z.string().nullable(),
});
export type Team = z.infer<typeof teamSchema>;
export type Fixture = {
  id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string | null;
  status: string;
  round?: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  updated_at: string;
};
export type Competition = { id: string; name: string };
export type Season = {
  id: string;
  competition_id: string;
  year: number;
  standings_available: boolean;
};
export type Standing = {
  season_id: string;
  team_id: string;
  group_name: string;
  rank: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
};
export type Snapshot = {
  demo: boolean;
  teams: Team[];
  favorites: string[];
  fixtures: Fixture[];
  competitions: Competition[];
  seasons: Season[];
  standings: Standing[];
  teamCompetitions?: { team_id: string; season_id: string }[];
  hideScores: boolean;
  timezone: string;
  displayName: string;
  deletionStatus: string | null;
  updatedAt: string | null;
  unavailable: boolean;
  dataState?: import("./freshness").DataState;
};
export function concealFixture(f: Fixture, hide: boolean): Fixture {
  return hide
    ? {
        ...f,
        status: "HIDDEN",
        home_score: null,
        away_score: null,
        home_penalties: null,
        away_penalties: null,
      }
    : f;
}
export function localDay(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
export function inRange(
  f: Fixture,
  range: "hoje" | "semana" | "mes",
  timezone: string,
  now = new Date(),
) {
  if (!f.kickoff_at) return false;
  const today = localDay(now.toISOString(), timezone);
  const date = localDay(f.kickoff_at, timezone);
  const n = range === "hoje" ? 0 : range === "semana" ? 6 : 29;
  const end = new Date(today + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + n);
  return date >= today && date <= end.toISOString().slice(0, 10);
}
