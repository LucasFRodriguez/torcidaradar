import { describe, it, expect, vi } from "vitest";
import {
  ApiFootball,
  retryAfter,
  type QuotaControl,
} from "@/lib/sports/provider";
import { ProviderError } from "@/lib/sports/errors";
import {
  discoverCompetitions,
  mapFixtures,
  mapStandings,
} from "@/lib/sports/mappers";
const envelope = (response: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    errors: [],
    results: Array.isArray(response) ? response.length : 1,
    paging: { current: 1, total: 1 },
    response,
    ...extra,
  });
function setup(responses: (Response | Error)[]) {
  const quota = {
    reserve: vi.fn<QuotaControl["reserve"]>().mockResolvedValue("reserved"),
    settle: vi.fn<QuotaControl["settle"]>().mockResolvedValue(undefined),
  };
  const http = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Error) http.mockRejectedValueOnce(r);
    else http.mockResolvedValueOnce(r);
  }
  return {
    quota,
    http,
    api: new ApiFootball("test-key-only", {
      quota,
      fetch: http,
      sleep: async () => {},
      random: () => 0,
    }),
  };
}
const account = {
  subscription: { plan: "Free", active: true },
  requests: { current: 50, limit_day: 100 },
};
describe("API-Football Free contrato", () => {
  it("status aceita objeto, verifica Free e reconcilia sem expor credencial", async () => {
    const { api, http, quota } = setup([
      new Response(envelope(account), {
        headers: {
          "x-ratelimit-requests-limit": "100",
          "x-ratelimit-requests-remaining": "50",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "8",
        },
      }),
    ]);
    expect(await api.status()).toEqual(account);
    expect(String(http.mock.calls[0][0])).toBe(
      "https://v3.football.api-sports.io/status",
    );
    expect(quota.settle).toHaveBeenCalledWith(
      "reserved",
      expect.objectContaining({
        code: "success",
        dailyRemaining: 50,
        minuteRemaining: 8,
        account,
      }),
    );
  });
  for (const status of [401, 403, 400])
    it(`HTTP ${status} não repete`, async () => {
      const { api, http } = setup([new Response("", { status })]);
      await expect(api.discover()).rejects.toMatchObject({
        code: status === 400 ? "parameters" : "authentication",
      });
      expect(http).toHaveBeenCalledTimes(1);
    });
  for (const [errors, code] of [
    [{ token: "invalid" }, "authentication"],
    [{ plan: "season unavailable" }, "coverage"],
    [{ subscription: "inactive" }, "inactive_subscription"],
    [{ parameters: "invalid" }, "parameters"],
    [{ requests: "quota" }, "rate_limit"],
  ] as const)
    it(`errors: ${code}`, async () => {
      const { api } = setup(
        Array.from({ length: 3 }, () => new Response(envelope([], { errors }))),
      );
      await expect(api.discover()).rejects.toMatchObject({ code });
    });
  it("recusa plano pago e assinatura inativa", async () => {
    for (const sub of [
      { plan: "Pro", active: true },
      { plan: "Free", active: false },
    ]) {
      const { api } = setup([
        new Response(envelope({ ...account, subscription: sub })),
      ]);
      await expect(api.status()).rejects.toMatchObject({
        code: sub.active ? "unsupported_plan" : "inactive_subscription",
      });
    }
  });
  it("resposta vazia é válida no transporte, não apaga dados no domínio", async () => {
    const { api } = setup([new Response(envelope([]))]);
    expect(await api.discover()).toEqual([]);
    expect(() => discoverCompetitions([], 2024)).toThrow("empty_unverified");
    expect(() => mapStandings([], 1, 2024)).toThrow("empty_unverified");
  });
  it("recusa results divergente, JSON inválido, payload incompleto e paginação incompleta", async () => {
    for (const value of [
      "{bad",
      envelope([], { results: 1 }),
      envelope([{ team: { id: 1 } }]),
      envelope([], { paging: { current: 1, total: 2 } }),
    ]) {
      const { api } = setup([new Response(value)]);
      await expect(api.teams(1, 2024)).rejects.toBeInstanceOf(ProviderError);
    }
  });
  it("Retry-After respeita HTTP date e interrompe espera longa", async () => {
    expect(
      retryAfter(
        "Thu, 01 Jan 2026 00:01:00 GMT",
        Date.parse("2026-01-01T00:00:00Z"),
      ),
    ).toBe(60);
    const { api, http, quota } = setup([
      new Response("", { status: 429, headers: { "retry-after": "120" } }),
    ]);
    await expect(api.fixtures(1, 2024)).rejects.toMatchObject({
      code: "rate_limit",
    });
    expect(http).toHaveBeenCalledTimes(1);
    expect(quota.settle).toHaveBeenCalledWith(
      "reserved",
      expect.objectContaining({ retryAfterSeconds: 120 }),
    );
  });
  it("falha na quota é fail closed, retry nunca contorna orçamento", async () => {
    const { api, http, quota } = setup([new Response("", { status: 503 })]);
    quota.reserve
      .mockResolvedValueOnce("reserved")
      .mockRejectedValueOnce(new ProviderError("quota_unavailable"));
    await expect(api.fixtures(1, 2024)).rejects.toMatchObject({
      code: "quota_unavailable",
    });
    expect(http).toHaveBeenCalledTimes(1);
  });
  it("timeout e rede são cobrados, erros não vazam URL/chave", async () => {
    const { api, quota } = setup([
      new DOMException("sensitive", "TimeoutError"),
      new TypeError("sensitive"),
      new TypeError("sensitive"),
    ]);
    await expect(api.fixtures(1, 2024)).rejects.toMatchObject({
      message: "network",
    });
    expect(quota.settle).toHaveBeenCalledTimes(3);
  });
  it("IDs/temporadas inválidos não chamam HTTP; nenhuma URL arbitrária", async () => {
    const { api, http } = setup([]);
    for (const id of [-1, 0, NaN])
      expect(() => api.fixtures(id, 2024)).toThrow("parameters");
    expect(() => api.fixtures(1, Infinity)).toThrow("parameters");
    expect(http).not.toHaveBeenCalled();
  });
  it("descobre IDs recebidos, não presume IDs conhecidos e não inventa temporada Free", () => {
    const league = {
      league: { id: 987, name: "Serie A", type: "League" as const },
      country: { name: "Brazil" },
      seasons: [{ year: 2024, coverage: { standings: true, fixtures: {} } }],
    };
    const result = discoverCompetitions([league], 2024);
    expect(result[0]).toMatchObject({ provider_id: 987, state: "advertised" });
    expect(result[1].state).toBe("unavailable");
    expect(discoverCompetitions([league], 2026)[0]).toMatchObject({
      provider_id: 987,
      state: "unavailable",
      available_seasons: [2024],
    });
    expect(discoverCompetitions([league, league], 2024)[0].state).toBe(
      "ambiguous",
    );
  });
  it("status desconhecido e zero não são inventados; erros de identidade recusados", () => {
    expect(() => mapFixtures([], 1, 2024)).toThrow("empty_unverified");
    expect(() =>
      mapStandings(
        [{ league: { id: 2, season: 2024, standings: [] } }],
        1,
        2024,
      ),
    ).toThrow("invalid_data");
  });
});
