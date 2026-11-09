import { notFound } from "next/navigation";
import { z } from "zod";
import { club } from "@/server/dal/football";
import {
  Monogram,
  FixtureCard,
  Empty,
  UpdateStamp,
  DataNotice,
} from "@/components/football";
export default async function Club({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = z
    .string()
    .max(160)
    .regex(/^[a-z0-9-]+$/)
    .safeParse((await params).slug);
  if (!slug.success) notFound();
  const { team, data, fixtures, standings, memberships, resourceFreshness } =
    await club(slug.data);
  if (!team) notFound();
  const sp = z
    .object({ season: z.uuid().optional() })
    .strict()
    .safeParse(await searchParams);
  const seasons = data.seasons.filter((s) => memberships.includes(s.id));
  const selected =
    sp.success && sp.data.season
      ? seasons.find((s) => s.id === sp.data.season)
      : seasons[0];
  const standingStamp = resourceFreshness.find(
    (f) => f.resource === "standings" && f.season_id === selected?.id,
  );
  return (
    <>
      <div className="club-heading">
        <Monogram team={team} />
        <div>
          <span className="eyebrow">{team.country ?? "País indisponível"}</span>
          <h1>{team.name}</h1>
          <p>O clube no seu radar.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Competições e classificação</h2>
        <form className="filter-bar" method="get">
          <label>
            Competição / temporada
            <select name="season" defaultValue={selected?.id}>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {data.competitions.find((c) => c.id === s.competition_id)
                    ?.name ?? "Competição"}{" "}
                  · {s.year}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary">Consultar</button>
        </form>
        {data.hideScores ? (
          <p className="notice">
            Classificação oculta no modo sem spoiler, pois pode revelar
            resultados.
          </p>
        ) : selected && standings.some((s) => s.season_id === selected.id) ? (
          <div className="table-scroll">
            <table>
              <caption>Classificação · {selected.year}</caption>
              <thead>
                <tr>
                  <th scope="col">Pos.</th>
                  <th scope="col">Time</th>
                  <th scope="col">Grupo</th>
                  <th scope="col">Pts</th>
                  <th scope="col">J</th>
                  <th scope="col">V</th>
                  <th scope="col">E</th>
                  <th scope="col">D</th>
                </tr>
              </thead>
              <tbody>
                {standings
                  .filter((s) => s.season_id === selected.id)
                  .map((s) => (
                    <tr key={s.team_id + s.group_name}>
                      <td>{s.rank}</td>
                      <td>
                        {data.teams.find((t) => t.id === s.team_id)?.name ??
                          "Informação indisponível"}
                      </td>
                      <td>{s.group_name}</td>
                      <td>{s.points}</td>
                      <td>{s.played}</td>
                      <td>{s.wins}</td>
                      <td>{s.draws}</td>
                      <td>{s.losses}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-line">
            Informação indisponível para esta competição e temporada.
          </p>
        )}
        {!data.hideScores && standingStamp && (
          <p className="updated">
            Classificação:{" "}
            {standingStamp.last_success_at
              ? "última atualização em " +
                new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: data.timezone,
                }).format(new Date(standingStamp.last_success_at))
              : "informação indisponível"}
            {standingStamp.state !== "available"
              ? " · Não foi possível atualizar; os dados anteriores podem estar desatualizados."
              : ""}
          </p>
        )}
      </section>
      <div className="section-heading spaced">
        <h2>Agenda e resultados</h2>
      </div>
      <div className="calendar-grid">
        {fixtures.map((f) => (
          <FixtureCard fixture={f} data={data} key={f.id} />
        ))}
      </div>
      {!fixtures.length && (
        <Empty
          title="Sem partidas disponíveis."
          description="A agenda será exibida após a sincronização da fonte."
        />
      )}
      <DataNotice data={data} />
      <UpdateStamp data={data} />
    </>
  );
}
