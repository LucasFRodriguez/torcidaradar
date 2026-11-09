"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Search, ArrowRight } from "lucide-react";
import type { Team } from "@/lib/sports/domain";
import { Monogram } from "./monogram";
export function TeamSearch({
  initialTeams,
  favorites,
  onboarding = false,
  search = "",
  page = 1,
}: {
  initialTeams: Team[];
  favorites: string[];
  onboarding?: boolean;
  search?: string;
  page?: number;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  async function toggle(id: string) {
    setSaving(id);
    setError("");
    try {
      const active = favorites.includes(id);
      const r = await fetch("/api/me/favorites" + (active ? "/" + id : ""), {
        method: active ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(active ? {} : { body: JSON.stringify({ teamId: id }) }),
      });
      if (!r.ok) throw new Error();
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível atualizar seu favorito. Tente novamente.");
    } finally {
      setSaving(null);
    }
  }
  return (
    <>
      <form className="search-form" method="get">
        <label htmlFor="search" className="sr-only">
          Pesquisar times
        </label>
        <Search size={20} aria-hidden="true" />
        <input
          id="search"
          name="search"
          defaultValue={search}
          maxLength={80}
          placeholder="Busque pelo nome do clube"
        />
        <button className="button small">Buscar</button>
      </form>
      <div className="section-heading">
        <p className="muted">
          {favorites.length}{" "}
          {favorites.length === 1 ? "time no seu radar" : "times no seu radar"}
        </p>
        <span className="tag">Escolha quantos quiser</span>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="team-grid" aria-busy={busy}>
        {initialTeams.map((t) => (
          <article className="team-card" key={t.id}>
            <Monogram team={t} />
            <div>
              <h3>
                <Link href={"/times/" + t.slug}>{t.name}</Link>
              </h3>
              <p>{t.country ?? "País indisponível"}</p>
            </div>
            <button
              className={
                "favorite-toggle " +
                (favorites.includes(t.id) ? "selected" : "")
              }
              aria-label={
                (favorites.includes(t.id) ? "Remover " : "Adicionar ") + t.name
              }
              aria-pressed={favorites.includes(t.id)}
              onClick={() => toggle(t.id)}
              disabled={saving !== null || busy}
            >
              <Heart
                size={19}
                fill={favorites.includes(t.id) ? "currentColor" : "none"}
              />
            </button>
          </article>
        ))}
      </div>
      {!initialTeams.length && (
        <div className="empty">
          <h3>Nenhum time encontrado.</h3>
          <p>
            Tente outro nome. A disponibilidade depende da cobertura e da última
            sincronização.
          </p>
        </div>
      )}
      <nav className="pagination" aria-label="Páginas de times">
        {page > 1 && (
          <Link href={`?search=${encodeURIComponent(search)}&page=${page - 1}`}>
            Anterior
          </Link>
        )}
        {initialTeams.length === 20 && (
          <Link href={`?search=${encodeURIComponent(search)}&page=${page + 1}`}>
            Próxima página
          </Link>
        )}
      </nav>
      {onboarding && (
        <div className="onboarding-next">
          <p className="muted">
            Você pode ajustar seus favoritos a qualquer momento.
          </p>
          <Link className="button" href="/dashboard">
            {favorites.length
              ? "Meu radar está pronto"
              : "Continuar por enquanto"}
            <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </>
  );
}
