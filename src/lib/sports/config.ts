import "server-only";
import { z } from "zod";
export function sportsConfig() {
  return z
    .object({
      daily: z.coerce.number().int().min(1).max(100),
      minute: z.coerce.number().int().min(1).max(10),
      dailyLimit: z.coerce.number().int().min(1).max(100),
      minuteLimit: z.coerce.number().int().min(1).max(10),
      operationalReserve: z.coerce.number().int().min(0).max(99),
      priorityReserve: z.coerce.number().int().min(0).max(20),
      season: z.coerce.number().int().min(2000).max(2100),
    })
    .refine(
      (c) =>
        c.daily + c.operationalReserve <= c.dailyLimit &&
        c.minute <= c.minuteLimit &&
        c.priorityReserve < c.daily,
      { message: "Invalid Free budget" },
    )
    .parse({
      daily: process.env.API_FOOTBALL_DAILY_BUDGET ?? 70,
      minute: process.env.API_FOOTBALL_MINUTE_BUDGET ?? 8,
      dailyLimit: process.env.API_FOOTBALL_DAILY_LIMIT ?? 100,
      minuteLimit: process.env.API_FOOTBALL_MINUTE_LIMIT ?? 10,
      operationalReserve: process.env.API_FOOTBALL_OPERATIONAL_RESERVE ?? 30,
      priorityReserve: process.env.API_FOOTBALL_PRIORITY_RESERVE ?? 6,
      season: process.env.SPORTS_SEASON,
    });
}
