import { it, expect, vi } from "vitest";
import { QuotaManager } from "@/server/jobs/quota";
import { executeTask } from "@/server/jobs/sync";
import { sportsConfig } from "@/lib/sports/config";
import type { FootballDataProvider } from "@/lib/sports/provider";
import type { SupabaseClient } from "@supabase/supabase-js";
const config = {
  daily: 70,
  minute: 8,
  dailyLimit: 100,
  minuteLimit: 10,
  operationalReserve: 30,
  priorityReserve: 6,
  season: 2024,
};
it("falha de comunicação com quota não libera chamada; settlement também falha fechado", async () => {
  const db = {
    rpc: vi.fn(async () => ({ data: null, error: { code: "offline" } })),
  } as unknown as SupabaseClient;
  const q = new QuotaManager(db, "owner", config);
  await expect(q.reserve("fixtures", "high")).rejects.toMatchObject({
    code: "quota_unavailable",
  });
  await expect(q.settle("id", { code: "timeout" })).rejects.toMatchObject({
    code: "quota_unavailable",
  });
});
it("configuração não aceita orçamento incompatível com Free nem usa ano corrente silenciosamente", () => {
  vi.stubEnv("SPORTS_SEASON", "");
  expect(() => sportsConfig()).toThrow();
  vi.stubEnv("SPORTS_SEASON", "2024");
  vi.stubEnv("API_FOOTBALL_DAILY_BUDGET", "80");
  vi.stubEnv("API_FOOTBALL_OPERATIONAL_RESERVE", "30");
  expect(() => sportsConfig()).toThrow();
  vi.unstubAllEnvs();
});
it("tarefa não grava resposta vazia/incompleta nem consulta endpoint opcional", async () => {
  const provider = {
    teams: vi.fn(async () => []),
    fixtures: vi.fn(async () => []),
    standings: vi.fn(async () => []),
    discover: vi.fn(async () => []),
    status: vi.fn(),
  } as FootballDataProvider;
  for (const kind of ["teams", "fixtures", "standings", "discovery"] as const)
    await expect(
      executeTask(
        provider,
        {
          id: "00000000-0000-4000-8000-000000000001",
          kind,
          league_id: 987,
          season: 2024,
          failures: 0,
        },
        2024,
      ),
    ).rejects.toMatchObject({ code: "empty_unverified" });
});
