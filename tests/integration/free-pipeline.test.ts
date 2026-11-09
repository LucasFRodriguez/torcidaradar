import { it, expect } from "vitest";
import { ApiFootball } from "@/lib/sports/provider";
import { runCycle } from "@/server/jobs/sync";
import { QuotaManager } from "@/server/jobs/quota";
import { sportsDatabase, sportsClient } from "../helpers/sports-database";
const owner = "00000000-0000-4000-8000-000000000001";
const config = {
  daily: 70,
  minute: 8,
  dailyLimit: 100,
  minuteLimit: 10,
  operationalReserve: 30,
  priorityReserve: 6,
  season: 2024,
};
it("ciclo completo transporte mock → quota real → scheduler → persistência transacional; repetição e falha de escrita preservam dados", async () => {
  const pg = await sportsDatabase();
  try {
    await pg.query("select acquire_sync_lease($1)", [owner]);
    let fail = false;
    const db = sportsClient(pg, () => fail);
    let calls = 0,
      charged = 0;
    const paths: string[] = [];
    const provider = new ApiFootball("test-key-not-real", {
      quota: new QuotaManager(db, owner, config),
      sleep: async () => {},
      fetch: async (input) => {
        const url = new URL(String(input));
        paths.push(url.pathname);
        calls++;
        if (url.pathname !== "/status") charged++;
        const payload: Record<string, unknown> = {
          "/status": {
            subscription: { plan: "Free", active: true },
            requests: { current: charged, limit_day: 100 },
          },
          "/leagues": [
            {
              league: { id: 987, name: "Serie A", type: "League" },
              country: { name: "Brazil" },
              seasons: [
                { year: 2024, coverage: { standings: true, fixtures: {} } },
              ],
            },
          ],
          "/teams": [
            { team: { id: 111, name: "Equipe Teste", country: "Brazil" } },
            { team: { id: 222, name: "Adversário Teste", country: "Brazil" } },
          ],
          "/fixtures": [
            {
              fixture: {
                id: 333,
                date: "2024-06-01T22:00:00Z",
                status: { short: "FT" },
              },
              league: { id: 987, season: 2024, round: "Rodada 1" },
              teams: { home: { id: 111 }, away: { id: 222 } },
              goals: { home: 0, away: 1 },
              score: { penalty: { home: null, away: null } },
            },
          ],
          "/standings": [
            {
              league: {
                id: 987,
                season: 2024,
                standings: [
                  [
                    {
                      rank: 1,
                      team: { id: 222 },
                      points: 3,
                      group: "Liga",
                      all: { played: 1, win: 1, draw: 0, lose: 0 },
                    },
                    {
                      rank: 2,
                      team: { id: 111 },
                      points: 0,
                      group: "Liga",
                      all: { played: 1, win: 0, draw: 0, lose: 1 },
                    },
                  ],
                ],
              },
            },
          ],
        };
        const response = payload[url.pathname];
        if (!response) throw new Error("Unexpected endpoint");
        return new Response(
          JSON.stringify({
            errors: [],
            results: Array.isArray(response) ? response.length : 1,
            paging: { current: 1, total: 1 },
            response,
          }),
          {
            headers: {
              "x-ratelimit-requests-limit": "100",
              "x-ratelimit-requests-remaining": String(100 - charged),
            },
          },
        );
      },
    });
    const first = await runCycle(db, owner, "", config, provider);
    expect(first).toMatchObject({
      completed: 4,
      failed: 0,
      deferred: 0,
      outcome: "success",
    });
    expect(paths).toEqual([
      "/status",
      "/leagues",
      "/teams",
      "/fixtures",
      "/standings",
    ]);
    expect(
      (
        await pg.query<{ daily_used: number }>(
          "select daily_used from sports_provider_state",
        )
      ).rows[0].daily_used,
    ).toBe(4);
    expect((await pg.query("select * from fixtures")).rows).toHaveLength(1);
    expect((await pg.query("select * from standings")).rows).toHaveLength(2);
    await pg.exec(
      "update sports_provider_state set last_status_at=now()-interval '16 minutes',last_status_request_at=now()-interval '16 minutes'",
    );
    const idle = await runCycle(db, owner, "", config, provider);
    expect(idle.outcome).toBe("idle");
    expect(calls).toBe(5);
    await pg.exec(
      "update sports_sync_tasks set next_run_at=now()-interval '1 second' where kind='fixtures'",
    );
    fail = true;
    const before = (await pg.query("select * from fixtures")).rows;
    const result = await runCycle(db, owner, "", config, provider);
    expect(result.failed).toBe(1);
    expect((await pg.query("select * from fixtures")).rows).toEqual(before);
    expect(
      (
        await pg.query<{ state: string }>(
          "select state from sports_data_freshness where resource='fixtures'",
        )
      ).rows[0].state,
    ).toBe("unavailable");
    expect(
      (
        await pg.query<{ status: string }>(
          "select status from sync_runs order by started_at desc limit 1",
        )
      ).rows[0].status,
    ).toBe("failed");
  } finally {
    await pg.close();
  }
});
