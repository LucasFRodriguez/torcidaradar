import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { sportsDatabase, sportsClient } from "../helpers/sports-database";
import { runCatalogue } from "@/server/jobs/catalogue";
import { ApiFootball } from "@/lib/sports/provider";
import { QuotaManager } from "@/server/jobs/quota";
import { sportsBudgetConfig } from "@/lib/sports/config";
let pg: PGlite;
const owner = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  pg = await sportsDatabase();
});
afterAll(async () => {
  await pg.close();
});
beforeEach(async () => {
  await pg.exec(
    "delete from sync_runs; delete from sports_request_reservations; delete from job_leases; delete from sports_provider_state; insert into sports_provider_state(provider,day) values('api-football',(now() at time zone 'UTC')::date)",
  );
  await pg.query("select acquire_sync_lease($1)", [owner]);
});
const envelope = (response: unknown) =>
  JSON.stringify({
    errors: [],
    results: Array.isArray(response) ? response.length : 1,
    paging: { current: 1, total: 1 },
    response,
  });
function setup() {
  const db = sportsClient(pg);
  const http = vi.fn<typeof fetch>();
  const api = new ApiFootball("test-key-only", {
    quota: new QuotaManager(db, owner, sportsBudgetConfig()),
    fetch: http,
    maxAttempts: 1,
  });
  return { db, http, api };
}
it("sem ano, consulta status e catálogo com quota SQL real, cacheia sem provar acesso nem importar times", async () => {
  const { db, api, http } = setup();
  http
    .mockResolvedValueOnce(
      new Response(
        envelope({
          subscription: { plan: "Free", active: true },
          requests: { current: 0, limit_day: 100 },
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        envelope([
          {
            league: { id: 987, name: "Serie A", type: "League" },
            country: { name: "Brazil" },
            seasons: [
              { year: 2024, coverage: { standings: true, fixtures: {} } },
            ],
          },
        ]),
      ),
    );
  const result = await runCatalogue(db, api);
  expect(result.seasonAccess).toBe("not_verified");
  expect(result.competitions[0]).toMatchObject({
    provider_id: 987,
    advertised_seasons: [2024],
    state: "advertised",
  });
  expect(http).toHaveBeenCalledTimes(2);
  const again = await runCatalogue(db, api);
  expect(again).toEqual({ ...result, cached: true });
  expect(http).toHaveBeenCalledTimes(2);
  expect(
    (
      await pg.query<{ daily_used: number }>(
        "select daily_used from sports_provider_state",
      )
    ).rows[0].daily_used,
  ).toBe(1);
  expect(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from sports_request_reservations where settled_at is not null",
      )
    ).rows[0].n,
  ).toBe(2);
  expect(
    (await pg.query<{ n: number }>("select count(*)::int n from teams")).rows[0]
      .n,
  ).toBe(0);
});
it("assinatura inativa impede catálogo e registra só código sanitizado", async () => {
  const { db, api, http } = setup();
  http.mockResolvedValueOnce(
    new Response(
      envelope({
        subscription: { plan: "Free", active: false },
        requests: { current: 0, limit_day: 100 },
      }),
    ),
  );
  await expect(runCatalogue(db, api)).rejects.toMatchObject({
    code: "CATALOGO_INDISPONIVEL",
  });
  expect(http).toHaveBeenCalledTimes(1);
  expect(
    (await pg.query("select status,sanitized_error from sync_runs")).rows,
  ).toEqual([{ status: "failed", sanitized_error: "inactive_subscription" }]);
});
it("lease perdida falha fechado sem HTTP", async () => {
  const { db, api, http } = setup();
  await pg.exec("update job_leases set expires_at=now()-interval '1 second'");
  await expect(runCatalogue(db, api)).rejects.toMatchObject({
    code: "CATALOGO_INDISPONIVEL",
  });
  expect(http).not.toHaveBeenCalled();
});
