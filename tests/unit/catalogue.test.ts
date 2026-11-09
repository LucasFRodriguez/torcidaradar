import { afterEach, expect, it, vi } from "vitest";
import { sportsBudgetConfig, sportsConfig } from "@/lib/sports/config";
import { ApiFootball } from "@/lib/sports/provider";
vi.mock("@/server/jobs/catalogue", () => ({ sportsCatalogue: vi.fn() }));
import { sportsCatalogue } from "@/server/jobs/catalogue";
import { POST } from "@/app/api/internal/sports-catalogue/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("catálogo admite orçamento sem temporada; sync continua exigindo ano explícito", () => {
  vi.stubEnv("SPORTS_SEASON", "");
  expect(sportsBudgetConfig().daily).toBe(70);
  expect(() => sportsConfig()).toThrow();
});
it("consulta sem retries reserva e contabiliza somente uma tentativa mesmo em 503", async () => {
  const quota = {
    reserve: vi.fn(async () => "id"),
    settle: vi.fn(async () => {}),
  };
  const http = vi.fn(async () => new Response("", { status: 503 }));
  const api = new ApiFootball("test-only", {
    quota,
    fetch: http,
    maxAttempts: 1,
  });
  await expect(api.discover()).rejects.toMatchObject({ code: "unavailable" });
  expect(http).toHaveBeenCalledTimes(1);
  expect(quota.reserve).toHaveBeenCalledTimes(1);
  expect(quota.settle).toHaveBeenCalledTimes(1);
});
it("endpoint exige bearer de serviço antes de qualquer leitura ou custo", async () => {
  vi.stubEnv("CRON_SECRET", "x".repeat(64));
  for (const auth of [undefined, "Bearer wrong"]) {
    const response = await POST(
      new Request("https://example.test/api/internal/sports-catalogue", {
        method: "POST",
        headers: auth ? { authorization: auth } : {},
      }),
    );
    expect(response.status).toBe(401);
  }
  expect(sportsCatalogue).not.toHaveBeenCalled();
});
it("endpoint exige confirmação explícita, limita entrada e usa no-store", async () => {
  vi.stubEnv("CRON_SECRET", "x".repeat(64));
  for (const payload of [
    {},
    { confirmCost: false },
    { confirmCost: true, url: "https://evil.test" },
  ]) {
    const response = await POST(
      new Request("https://example.test/api/internal/sports-catalogue", {
        method: "POST",
        headers: {
          authorization: "Bearer " + "x".repeat(64),
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
  expect(sportsCatalogue).not.toHaveBeenCalled();
  vi.mocked(sportsCatalogue).mockResolvedValue({ cached: true } as Awaited<
    ReturnType<typeof sportsCatalogue>
  >);
  expect(
    (
      await POST(
        new Request("https://example.test/api/internal/sports-catalogue", {
          method: "POST",
          headers: {
            authorization: "Bearer " + "x".repeat(64),
            "content-type": "application/json",
          },
          body: JSON.stringify({ confirmCost: true }),
        }),
      )
    ).status,
  ).toBe(200);
  expect(sportsCatalogue).toHaveBeenCalledTimes(1);
});
