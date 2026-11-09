import Link from "next/link";
import { ArrowRight, CalendarDays, MoveUpRight } from "lucide-react";
import { snapshot } from "@/server/dal/football";
import { inRange } from "@/lib/sports/domain";
import {
  FavoritesStrip,
  FixtureCard,
  Empty,
  UpdateStamp,
  DataNotice,
} from "@/components/football";
export default async function Dashboard() {
  const data = await snapshot();
  const now = new Date();
  const today = data.fixtures.filter((f) => inRange(f, "hoje", data.timezone));
  const future = data.fixtures
    .filter(
      (f) =>
        (!f.kickoff_at || new Date(f.kickoff_at) > now) && !today.includes(f),
    )
    .slice(0, 4);
  const recent = data.fixtures
    .filter(
      (f) =>
        f.kickoff_at &&
        new Date(f.kickoff_at) < now &&
        !today.includes(f) &&
        (data.hideScores ||
          ["FT", "AET", "PEN", "AWD", "WO"].includes(f.status)),
    )
    .slice(-4)
    .reverse();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: data.timezone,
            }).format(now)}
          </span>
          <h1>
            Meu Futebol Hoje<span className="accent">.</span>
          </h1>
          <p>
            {data.displayName ? "Olá, " + data.displayName + ". " : ""}Um lugar
            para tudo que move a sua torcida.
          </p>
        </div>
        <Link className="button secondary" href="/calendario">
          <CalendarDays size={16} /> Ver calendário
        </Link>
      </div>
      <div className="dashboard-summary">
        <div>
          <span className="stat-value">
            {data.favorites.length.toString().padStart(2, "0")}
          </span>
          <span>Times no radar</span>
        </div>
        <div>
          <span className="stat-value">
            {today.length.toString().padStart(2, "0")}
          </span>
          <span>Jogos hoje</span>
        </div>
        <Link href="/meus-times">
          Seu futebol, do seu jeito <MoveUpRight size={19} />
        </Link>
      </div>
      <FavoritesStrip data={data} />
      {data.competitions.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <h2>Competições no radar</h2>
          </div>
          <div className="favorites-strip">
            {data.competitions.map((c) => {
              const season = data.seasons.find(
                (s) => s.competition_id === c.id,
              );
              const team = data.teams.find(
                (t) =>
                  data.favorites.includes(t.id) &&
                  data.teamCompetitions?.some(
                    (m) => m.team_id === t.id && m.season_id === season?.id,
                  ),
              );
              return (
                <div key={c.id}>
                  <strong>{c.name}</strong>
                  <p className="muted">
                    {season?.year}
                    {!data.hideScores &&
                      season?.standings_available &&
                      team && (
                        <>
                          {" "}
                          ·{" "}
                          <Link
                            className="text-link"
                            href={
                              "/times/" + team.slug + "?season=" + season.id
                            }
                          >
                            Consultar classificação
                          </Link>
                        </>
                      )}
                  </p>
                </div>
              );
            })}
          </div>
          {data.hideScores && (
            <p className="fine-print">
              Classificações ocultas no modo sem spoiler.
            </p>
          )}
        </section>
      )}

      <div className="dashboard-columns">
        <section>
          <div className="section-heading">
            <h2>
              <span className="dot" /> Hoje
            </h2>
            <span className="tag">
              {today.length} {today.length === 1 ? "partida" : "partidas"}
            </span>
          </div>
          {today.length ? (
            today.map((f) => <FixtureCard key={f.id} fixture={f} data={data} />)
          ) : (
            <Empty
              title={
                data.favorites.length
                  ? "Nenhuma partida disponível para hoje."
                  : "Vamos colocar seus times no radar?"
              }
              description={
                data.favorites.length
                  ? "Não há partidas disponíveis para hoje. Veja os próximos encontros na agenda."
                  : "Escolha seus favoritos para acompanhar os jogos que importam."
              }
              action={!data.favorites.length}
            />
          )}
          <div className="section-heading spaced">
            <h2>Últimos resultados</h2>
            {data.hideScores && <span className="tag">Protegidos</span>}
          </div>
          {recent.length ? (
            recent.map((f) => (
              <FixtureCard key={f.id} fixture={f} data={data} />
            ))
          ) : (
            <p className="empty-line">Nenhum resultado recente disponível.</p>
          )}
        </section>
        <aside>
          <div className="section-heading">
            <h2>Próximos jogos</h2>
            <Link href="/calendario" aria-label="Ver todos os próximos jogos">
              <ArrowRight size={17} />
            </Link>
          </div>
          {future.length ? (
            future.map((f) => (
              <FixtureCard key={f.id} fixture={f} data={data} />
            ))
          ) : (
            <Empty
              title="A agenda está em aberto."
              description="Os próximos jogos aparecerão quando forem disponibilizados pela fonte."
            />
          )}
          <div className="quiet-card">
            <span className="eyebrow">NO SEU TEMPO</span>
            <h3>Prefere descobrir depois?</h3>
            <p>O modo sem spoiler protege os resultados em todo o seu radar.</p>
            <Link className="text-link" href="/configuracoes">
              Ajustar preferências <ArrowRight size={15} />
            </Link>
          </div>
        </aside>
      </div>
      <DataNotice data={data} />
      <UpdateStamp data={data} />
    </>
  );
}
