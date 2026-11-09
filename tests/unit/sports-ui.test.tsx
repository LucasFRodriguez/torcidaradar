import { it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Snapshot } from "@/lib/sports/domain";
import { concealFixture } from "@/lib/sports/domain";
const mocks = vi.hoisted(() => ({ snapshot: vi.fn() }));
vi.mock("@/server/dal/football", () => ({ snapshot: mocks.snapshot }));
import Dashboard from "@/app/(private)/dashboard/page";
import { FixtureCard, DataNotice } from "@/components/football";
const data: Snapshot = {
  demo: false,
  teams: [
    { id: "a", name: "Time Teste", slug: "time-teste", country: "Brasil" },
    {
      id: "b",
      name: "Adversário Teste",
      slug: "adversario",
      country: "Brasil",
    },
  ],
  favorites: ["a"],
  competitions: [{ id: "c", name: "Competição Teste" }],
  seasons: [
    { id: "s", competition_id: "c", year: 2026, standings_available: true },
  ],
  standings: [],
  teamCompetitions: [{ team_id: "a", season_id: "s" }],
  fixtures: [
    {
      id: "f",
      season_id: "s",
      home_team_id: "a",
      away_team_id: "b",
      kickoff_at: "2026-11-10T01:00:00Z",
      status: "NS",
      home_score: null,
      away_score: null,
      home_penalties: null,
      away_penalties: null,
      updated_at: "2026-11-09T14:00:00Z",
    },
  ],
  hideScores: false,
  timezone: "America/Sao_Paulo",
  displayName: "Teste",
  deletionStatus: null,
  updatedAt: "2026-11-09T14:00:00Z",
  unavailable: false,
  dataState: "ready",
};
afterEach(() => vi.useRealTimers());
it("dashboard lê snapshot interno e mostra competição/partida sem inventar resultado", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T15:00:00Z"));
  mocks.snapshot.mockResolvedValue(data);
  const html = renderToStaticMarkup(await Dashboard());
  expect(html).toContain("Competição Teste");
  expect(html).toContain("Time Teste");
  expect(html).toContain("Meu Futebol Hoje");
  expect(html).toContain("Não é um serviço de placares ao vivo");
  expect(html).not.toContain("score-divider");
});
it("dashboard vazio e indisponibilidade explicam ausência sem substituir por mocks", async () => {
  mocks.snapshot.mockResolvedValue({
    ...data,
    fixtures: [],
    dataState: "unavailable",
    updatedAt: null,
    unavailable: true,
  });
  const html = renderToStaticMarkup(await Dashboard());
  expect(html).toContain("Não foi possível atualizar os dados");
  expect(html).toContain("Nenhum resultado recente disponível");
  expect(html).not.toContain("Aurora FC");
  expect(html).not.toContain("score-divider");
});
it("timestamp e estado desatualizado são honestos e horários são brasileiros", () => {
  const html = renderToStaticMarkup(
    <>
      <FixtureCard fixture={data.fixtures[0]} data={data} />
      <DataNotice data={{ ...data, dataState: "stale" }} />
    </>,
  );
  expect(html).toContain("22:00");
  expect(html).toContain("09 de nov.");
  expect(html).toContain("podem estar desatualizados");
});
it("sem spoiler preserva nomes e horários mas não placar/status/classificação", async () => {
  const f = {
    ...data.fixtures[0],
    status: "PEN",
    home_score: 9,
    away_score: 8,
    home_penalties: 5,
    away_penalties: 4,
  };
  const hidden = {
    ...data,
    hideScores: true,
    fixtures: [concealFixture(f, true)],
  };
  mocks.snapshot.mockResolvedValue(hidden);
  const html = renderToStaticMarkup(await Dashboard());
  expect(html).toContain("Placar oculto");
  expect(html).not.toContain("score-divider");
  expect(html).not.toContain("Após pênaltis");
  expect(html).not.toContain("Consultar classificação");
  expect(html).toContain("Classificações ocultas");
});
