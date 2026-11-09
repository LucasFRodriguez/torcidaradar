export type DataState =
  "ready" | "not_synced" | "unavailable" | "stale" | "unsupported";
export type Freshness = {
  last_success_at: string | null;
  state?: string;
  resource: string;
  season_id: string;
  season_year?: number;
};
export function dataFreshness(
  rows: Freshness[],
  failed = false,
  now = Date.now(),
): { state: DataState; updatedAt: string | null } {
  const stamps = rows
    .filter((r) => r.resource === "fixtures" && r.last_success_at)
    .map((r) => r.last_success_at!)
    .sort();
  const updatedAt = stamps[0] ?? null; // Oldest participating season: never overstate freshness.
  if (
    failed ||
    rows.some((r) => r.resource === "fixtures" && r.state === "unavailable")
  )
    return { state: updatedAt ? "stale" : "unavailable", updatedAt };
  if (rows.some((r) => r.resource === "fixtures" && r.state === "unsupported"))
    return { state: updatedAt ? "stale" : "unsupported", updatedAt };
  if (!updatedAt) return { state: "not_synced", updatedAt: null };
  if (
    rows.some(
      (r) =>
        r.resource === "fixtures" &&
        (!r.last_success_at ||
          now - new Date(r.last_success_at).getTime() >
            (r.season_year !== undefined &&
            r.season_year < new Date(now).getUTCFullYear()
              ? 8 * 86400000
              : 12 * 3600000)),
    )
  )
    return { state: "stale", updatedAt };
  return { state: "ready", updatedAt };
}
export const dataMessages: Record<DataState, string> = {
  ready:
    "Resultados atualizados periodicamente. Não é um serviço de placares ao vivo.",
  not_synced:
    "Sincronização ainda não realizada para esta seleção. Dados indisponíveis no momento.",
  unavailable:
    "Não foi possível atualizar os dados. Tente novamente mais tarde.",
  stale:
    "Os dados podem estar desatualizados. A última atualização bem-sucedida está indicada abaixo.",
  unsupported:
    "Ainda não temos informações para esta competição e temporada no plano gratuito.",
};
