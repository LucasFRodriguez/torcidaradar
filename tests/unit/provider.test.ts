import { describe, it, expect, vi } from "vitest";
import { ApiFootball } from "@/lib/sports/provider";
import { concealFixture, inRange } from "@/lib/sports/domain";
import { validCron } from "@/lib/security/cron";
const quota = {
  reserve: vi.fn(async () => "reservation"),
  settle: vi.fn(async () => {}),
};
const envelope = (response: unknown[] = []) =>
  JSON.stringify({
    errors: [],
    results: response.length,
    paging: { current: 1, total: 1 },
    response,
  });
describe("SportsProvider", () => {
  it("fixa origem, timeout, credencial servidor e não segue redirects", async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(envelope()));
    const api = new ApiFootball("secret", { quota, fetch: mock });
    expect(await api.teams(71, 2026)).toEqual([]);
    const [url, opts] = mock.mock.calls[0];
    expect(String(url)).toBe(
      "https://v3.football.api-sports.io/teams?league=71&season=2026",
    );
    expect(opts?.redirect).toBe("error");
    expect(opts?.signal).toBeDefined();
  });
  it("429 e 5xx repetem no máximo três vezes com orçamento a cada chamada", async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response("", { status: 429 }));
    const reserve = vi.fn(async () => true),
      sleep = vi.fn(async () => {});
    await expect(
      new ApiFootball("s", {
        quota: {
          ...quota,
          reserve: async () => {
            await reserve();
            return "reservation";
          },
        },
        fetch: mock,
        sleep,
      }).teams(71, 2026),
    ).rejects.toMatchObject({ code: "rate_limit" });
    expect(mock).toHaveBeenCalledTimes(3);
    expect(reserve).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
  it("retry 5xx permite recuperação", async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(envelope()));
    expect(
      await new ApiFootball("s", {
        quota,
        fetch: mock,
        sleep: async () => {},
      }).teams(71, 2026),
    ).toEqual([]);
  });
  it("timeout tem limite e erro sanitizado", async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("sensitive url", "TimeoutError"));
    await expect(
      new ApiFootball("s", { quota, fetch: mock, sleep: async () => {} }).teams(
        71,
        2026,
      ),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(mock).toHaveBeenCalledTimes(3);
  });
  it("recusa dados incompletos, erros da API, paginação não suportada e orçamento esgotado", async () => {
    for (const value of [
      envelope([{ team: { id: 1 } }]),
      JSON.stringify({
        errors: { plan: "bad" },
        paging: { current: 1, total: 1 },
        response: [],
      }),
      JSON.stringify({
        errors: [],
        paging: { current: 1, total: 2 },
        response: [],
      }),
    ])
      await expect(
        new ApiFootball("s", {
          quota,
          fetch: vi.fn(async () => new Response(value)),
        }).teams(71, 2026),
      ).rejects.toThrow();
    const mock = vi.fn<typeof fetch>();
    await expect(
      new ApiFootball("s", {
        quota: {
          ...quota,
          reserve: async () => {
            throw { code: "budget" };
          },
        },
        fetch: mock,
      }).teams(71, 2026),
    ).rejects.toMatchObject({ code: "budget" });
    expect(mock).not.toHaveBeenCalled();
  });
  it("sem spoiler remove placares, pênaltis e status no DTO", () => {
    const f = {
      id: "1",
      season_id: "1",
      home_team_id: "a",
      away_team_id: "b",
      kickoff_at: "2026-11-10T01:00:00Z",
      status: "PEN",
      home_score: 2,
      away_score: 2,
      home_penalties: 5,
      away_penalties: 4,
      updated_at: "2026-11-09T00:00:00Z",
    };
    expect(concealFixture(f, true)).toMatchObject({
      home_score: null,
      away_score: null,
      home_penalties: null,
      away_penalties: null,
      status: "HIDDEN",
    });
    expect(
      inRange(f, "hoje", "America/Sao_Paulo", new Date("2026-11-09T12:00:00Z")),
    ).toBe(true);
  });
  it("cron exige segredo forte e comparação completa", () => {
    const s = "x".repeat(32);
    expect(validCron(null, s)).toBe(false);
    expect(validCron("Bearer no", s)).toBe(false);
    expect(validCron("Bearer " + s, s)).toBe(true);
    expect(validCron("Bearer x", "x")).toBe(false);
  });
});
