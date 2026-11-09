import { dataMessages } from "@/lib/sports/freshness";
import Link from "next/link";
import { CalendarDays, ArrowRight, Heart, Clock3, EyeOff } from "lucide-react";
import type { Fixture, Snapshot } from "@/lib/sports/domain";
import { Monogram } from "./monogram";
export { Monogram } from "./monogram";
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: boolean;
}) {
  return (
    <div className="empty">
      <span className="feature-icon">
        <CalendarDays size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <Link className="button secondary" href="/meus-times">
          Escolher meus times <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function DataNotice({ data }: { data: Snapshot }) {
  return data.demo ? null : (
    <p
      role="status"
      className={data.dataState === "ready" ? "updated" : "notice"}
    >
      {dataMessages[data.dataState ?? "not_synced"] +
        (data.seasons.length > 0 &&
        data.seasons.every((s) => s.year < new Date().getUTCFullYear())
          ? " A cobertura disponível é histórica; não há temporada atual confirmada."
          : "")}
    </p>
  );
}
export function UpdateStamp({ data }: { data: Snapshot }) {
  return (
    <p className="updated">
      <Clock3 size={13} />
      {data.demo
        ? "Dados fictícios para demonstração local"
        : data.updatedAt
          ? "Partidas API-Football · Atualizado em " +
            new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: data.timezone,
            }).format(new Date(data.updatedAt))
          : "Informação indisponível · aguardando sincronização da fonte"}
      {data.unavailable && data.updatedAt
        ? " · A fonte pode estar desatualizada."
        : ""}
    </p>
  );
}
const statuses: Record<string, string> = {
  NS: "Agendado",
  TBD: "Data a definir",
  FT: "Encerrado",
  AET: "Após prorrogação",
  PEN: "Após pênaltis",
  PST: "Adiado",
  CANC: "Cancelado",
  SUSP: "Suspenso",
  INT: "Interrompido",
  ABD: "Abandonado",
  AWD: "Decisão administrativa",
  WO: "W.O.",
};
export function FixtureCard({
  fixture: f,
  data,
}: {
  fixture: Fixture;
  data: Snapshot;
}) {
  const home = data.teams.find((t) => t.id === f.home_team_id),
    away = data.teams.find((t) => t.id === f.away_team_id);
  if (!home || !away) return null;
  const season = data.seasons.find((s) => s.id === f.season_id),
    comp = data.competitions.find((c) => c.id === season?.competition_id);
  const date = f.kickoff_at
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: data.timezone,
      }).format(new Date(f.kickoff_at))
    : "Data a definir";
  const finished = ["FT", "AET", "PEN", "AWD", "WO"].includes(f.status);
  return (
    <article className="fixture-card">
      <div className="fixture-meta">
        <span>
          {comp?.name ?? "Competição indisponível"}
          {season ? ` · ${season.year}` : ""}
          {!data.hideScores && f.round ? ` · ${f.round}` : ""}
        </span>
        <span>{date}</span>
      </div>
      <div className="fixture-teams">
        <Link href={"/times/" + home.slug}>
          <Monogram team={home} />
          <span>{home.name}</span>
        </Link>
        <div className="score">
          {data.hideScores ? (
            <EyeOff size={19} aria-label="Placar oculto" />
          ) : f.home_score !== null && f.away_score !== null ? (
            <span>
              {f.home_score}
              <span className="score-divider">:</span>
              {f.away_score}
            </span>
          ) : (
            <span className="versus">vs</span>
          )}
        </div>
        <Link href={"/times/" + away.slug}>
          <span>{away.name}</span>
          <Monogram team={away} />
        </Link>
      </div>
      <div className="fixture-bottom">
        <span>
          {data.hideScores
            ? "Resultado protegido"
            : (statuses[f.status] ?? "Status registrado na última atualização")}
          {!data.hideScores &&
          f.home_penalties !== null &&
          f.away_penalties !== null
            ? ` · Pênaltis ${f.home_penalties} × ${f.away_penalties}`
            : ""}
        </span>
        <span>
          {data.hideScores
            ? "Sem spoiler"
            : finished
              ? "Resultado"
              : "Horário local"}
        </span>
      </div>
    </article>
  );
}
export function FavoritesStrip({ data }: { data: Snapshot }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>
          <Heart size={18} /> Meus times
        </h2>
        <Link href="/meus-times">
          Gerenciar <ArrowRight size={14} />
        </Link>
      </div>
      {data.favorites.length ? (
        <div className="favorites-strip">
          {data.teams
            .filter((t) => data.favorites.includes(t.id))
            .map((t) => (
              <Link key={t.id} href={"/times/" + t.slug}>
                <Monogram team={t} />
                <strong>{t.name}</strong>
                <span className="muted">{t.country}</span>
              </Link>
            ))}
        </div>
      ) : (
        <Empty
          title="Seu radar começa com um time."
          description="Escolha seus clubes favoritos para personalizar esta página."
          action
        />
      )}
    </section>
  );
}
