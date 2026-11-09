import { it, expect } from "vitest";
import { dataFreshness, dataMessages } from "@/lib/sports/freshness";
const now = Date.parse("2026-11-09T15:00:00Z");
const row = {
  season_id: "season",
  resource: "fixtures",
  last_success_at: "2026-11-09T14:00:00Z",
  state: "available",
  season_year: 2026,
};
it("distingue estados, usa carimbo real e mantém dados antigos em falha", () => {
  expect(dataFreshness([], false, now)).toEqual({
    state: "not_synced",
    updatedAt: null,
  });
  expect(dataFreshness([row], false, now).state).toBe("ready");
  expect(dataFreshness([row], true, now)).toEqual({
    state: "stale",
    updatedAt: row.last_success_at,
  });
  expect(
    dataFreshness(
      [{ ...row, last_success_at: null, state: "unavailable" }],
      false,
      now,
    ).state,
  ).toBe("unavailable");
  expect(
    dataFreshness(
      [{ ...row, last_success_at: null, state: "unsupported" }],
      false,
      now,
    ).state,
  ).toBe("unsupported");
  expect(
    dataFreshness(
      [{ ...row, last_success_at: "2026-11-07T00:00:00Z" }],
      false,
      now,
    ).state,
  ).toBe("stale");
  expect(dataMessages.ready).toContain("Não é um serviço de placares ao vivo");
});
it("não informa atualização mais recente que a temporada participante mais antiga e reconhece cadência histórica", () => {
  const historical = {
    ...row,
    season_year: 2024,
    last_success_at: "2026-11-07T00:00:00Z",
  };
  expect(dataFreshness([row, historical], false, now)).toEqual({
    state: "ready",
    updatedAt: historical.last_success_at,
  });
});
