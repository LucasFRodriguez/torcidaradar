import { z } from "zod";
const text = z.string().min(1).max(160);
const id = z.number().int().positive();
const score = z.number().int().nonnegative().nullable();
export const leagueSchema = z.object({
  league: z.object({ id, name: text, type: z.enum(["League", "Cup"]) }),
  country: z.object({ name: text }),
  seasons: z.array(
    z.object({
      year: z.number().int(),
      coverage: z
        .object({
          standings: z.boolean(),
          fixtures: z.object({ events: z.boolean().optional() }).loose(),
        })
        .loose(),
    }),
  ),
});
export const providerTeamSchema = z.object({
  team: z.object({ id, name: text, country: text.nullable() }),
});
export const providerFixtureSchema = z.object({
  fixture: z.object({
    id,
    date: z.iso.datetime({ offset: true }).nullable(),
    status: z.object({
      short: z.enum([
        "TBD",
        "NS",
        "1H",
        "HT",
        "2H",
        "ET",
        "BT",
        "P",
        "FT",
        "AET",
        "PEN",
        "SUSP",
        "INT",
        "PST",
        "CANC",
        "ABD",
        "AWD",
        "WO",
        "LIVE",
      ]),
    }),
  }),
  league: z.object({
    id,
    season: z.number().int(),
    round: z.string().max(160).nullable().optional(),
  }),
  teams: z.object({
    home: z.object({ id, name: text.optional() }),
    away: z.object({ id, name: text.optional() }),
  }),
  goals: z.object({ home: score, away: score }),
  score: z.object({ penalty: z.object({ home: score, away: score }) }),
});
export const providerStandingsSchema = z.object({
  league: z.object({
    id,
    season: z.number().int(),
    standings: z.array(
      z.array(
        z.object({
          rank: id,
          team: z.object({ id }),
          points: z.number().int(),
          group: z.string().max(120).nullable(),
          all: z.object({
            played: z.number().int().nonnegative(),
            win: z.number().int().nonnegative(),
            draw: z.number().int().nonnegative(),
            lose: z.number().int().nonnegative(),
          }),
        }),
      ),
    ),
  }),
});
export type League = z.infer<typeof leagueSchema>;
export type ProviderTeam = z.infer<typeof providerTeamSchema>;
export type ProviderFixture = z.infer<typeof providerFixtureSchema>;
export type ProviderStandings = z.infer<typeof providerStandingsSchema>;

export const statusSchema = z.object({
  subscription: z.object({
    plan: z.string().min(1).max(80),
    active: z.boolean(),
  }),
  requests: z.object({
    current: z.number().int().nonnegative(),
    limit_day: z.number().int().positive(),
  }),
});
export type AccountStatus = z.infer<typeof statusSchema>;
export const envelopeSchema = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  results: z.number().int().nonnegative(),
  paging: z.object({
    current: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
  response: z.unknown(),
});
