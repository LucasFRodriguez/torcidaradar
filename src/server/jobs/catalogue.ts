import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { infrastructureClient } from "@/lib/supabase/admin";
import { sportsBudgetConfig } from "@/lib/sports/config";
import { ApiFootball, type FootballDataProvider } from "@/lib/sports/provider";
import { discoverCompetitions } from "@/lib/sports/mappers";
import { ProviderError } from "@/lib/sports/errors";
import { HttpError } from "@/lib/security/validation";
import { QuotaManager } from "./quota";

const catalogueSchema = z.object({
  observedAt: z.iso.datetime(),
  seasonAccess: z.literal("not_verified"),
  competitions: z
    .array(
      z.object({
        target: z.enum(["serie-a", "serie-b", "copa-brasil"]),
        state: z.enum(["advertised", "ambiguous", "unavailable"]),
        provider_id: z.number().int().positive().nullable(),
        name: z.string().nullable(),
        type: z.enum(["League", "Cup"]),
        advertised_seasons: z.array(z.number().int()),
      }),
    )
    .length(3),
});
async function checked<T>(promise: PromiseLike<{ data: T; error: unknown }>) {
  const result = await promise;
  if (result.error) throw new ProviderError("database");
  return result.data;
}

// Uses the same exclusive lease and persisted quotas as regular synchronization.
// No season default and no sports-domain writes: catalogues do not prove entitlement.
export async function sportsCatalogue() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new HttpError(503, "FORNECEDOR_NAO_CONFIGURADO");
  const config = sportsBudgetConfig();
  const db = infrastructureClient();
  const owner = randomUUID();
  const lease = await checked(db.rpc("acquire_sync_lease", { p_owner: owner }));
  if (!lease) throw new HttpError(409, "SINCRONIZACAO_EM_ANDAMENTO");
  try {
    const provider = new ApiFootball(key, {
      quota: new QuotaManager(db, owner, config),
      maxAttempts: 1,
    });
    return await runCatalogue(db, provider);
  } finally {
    await db
      .from("job_leases")
      .delete()
      .eq("name", "sports")
      .eq("owner", owner);
  }
}

export async function runCatalogue(
  db: SupabaseClient,
  provider: FootballDataProvider,
) {
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const cached = await checked(
    db
      .from("sync_runs")
      .select("metrics")
      .eq("resource", "free:catalogue")
      .eq("status", "success")
      .gte("finished_at", cutoff)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (cached) {
    const parsed = catalogueSchema.safeParse(cached.metrics);
    if (!parsed.success) throw new ProviderError("database");
    return { ...parsed.data, cached: true };
  }
  const run = await checked(
    db
      .from("sync_runs")
      .insert({
        resource: "free:catalogue",
        status: "running",
      })
      .select("id")
      .single(),
  );
  if (!run) throw new ProviderError("database");
  try {
    const state = await checked(
      db
        .from("sports_provider_state")
        .select("day,last_status_at")
        .eq("provider", "api-football")
        .single(),
    );
    if (!state) throw new ProviderError("database");
    if (
      state.day !== new Date().toISOString().slice(0, 10) ||
      !state.last_status_at ||
      Date.now() - new Date(state.last_status_at).getTime() > 900000
    )
      await provider.status();
    const rows = discoverCompetitions(await provider.discover());
    const result = catalogueSchema.parse({
      observedAt: new Date().toISOString(),
      seasonAccess: "not_verified",
      competitions: rows.map((row) => ({
        target: row.target,
        state: row.state,
        provider_id: row.provider_id,
        name: row.name,
        type: row.type,
        advertised_seasons: row.available_seasons,
      })),
    });
    await checked(
      db
        .from("sync_runs")
        .update({
          status: "success",
          finished_at: result.observedAt,
          metrics: result,
        })
        .eq("id", run.id),
    );
    return { ...result, cached: false };
  } catch (error) {
    await checked(
      db
        .from("sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          sanitized_error:
            error instanceof ProviderError ? error.code : "internal",
        })
        .eq("id", run.id),
    );
    throw new HttpError(503, "CATALOGO_INDISPONIVEL");
  }
}
