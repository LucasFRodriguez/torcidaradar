import { snapshot } from "@/server/dal/football";
import { calendarSchema } from "@/lib/security/validation";
import { inRange } from "@/lib/sports/domain";
import {
  FixtureCard,
  Empty,
  UpdateStamp,
  DataNotice,
} from "@/components/football";
export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = calendarSchema.safeParse(await searchParams);
  const p = result.success
    ? result.data
    : { range: "semana" as const, team: "", competition: "" };
  const data = await snapshot();
  const seasons = data.seasons
    .filter((s) => !p.competition || s.competition_id === p.competition)
    .map((s) => s.id);
  const games = data.fixtures.filter(
    (f) =>
      inRange(f, p.range, data.timezone) &&
      (!p.team || [f.home_team_id, f.away_team_id].includes(p.team)) &&
      seasons.includes(f.season_id),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA JOGO NO SEU LUGAR</span>
          <h1>Calendário</h1>
          <p>A agenda dos seus favoritos, sem precisar procurar.</p>
        </div>
      </div>
      {!result.success && (
        <p className="notice" role="alert">
          Filtros inválidos. Exibindo a semana.
        </p>
      )}
      <form className="filter-bar" method="get">
        <label>
          Período
          <select name="range" defaultValue={p.range}>
            <option value="hoje">Hoje</option>
            <option value="semana">Próximos 7 dias</option>
            <option value="mes">Próximos 30 dias</option>
          </select>
        </label>
        <label>
          Time
          <select name="team" defaultValue={p.team}>
            <option value="">Todos os favoritos</option>
            {data.teams
              .filter((t) => data.favorites.includes(t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Competição
          <select name="competition" defaultValue={p.competition}>
            <option value="">Todas as competições</option>
            {data.competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button">Filtrar</button>
      </form>
      <div className="section-heading">
        <h2>Seus próximos encontros</h2>
        <span className="muted">
          {games.length} partidas · {data.timezone}
        </span>
      </div>
      <div className="calendar-grid">
        {games.map((f) => (
          <FixtureCard key={f.id} fixture={f} data={data} />
        ))}
      </div>
      {!games.length && (
        <Empty
          title="Nenhum jogo por aqui."
          description="Ajuste os filtros ou adicione mais times. Datas e cobertura dependem da fonte esportiva."
          action={!data.favorites.length}
        />
      )}
      <DataNotice data={data} />
      <UpdateStamp data={data} />
    </>
  );
}
