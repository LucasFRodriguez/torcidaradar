import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { infrastructureClient } from "@/lib/supabase/admin";
import { ApiFootball, type FootballDataProvider } from "@/lib/sports/provider";
import { ProviderError } from "@/lib/sports/errors";
import { sportsConfig } from "@/lib/sports/config";
import {
  discoverCompetitions,
  mapTeams,
  mapFixtures,
  mapStandings,
} from "@/lib/sports/mappers";
import { localDay } from "@/lib/sports/domain";
import { QuotaManager } from "./quota";
import { HttpError } from "@/lib/security/validation";
import type { SupabaseClient } from "@supabase/supabase-js";
const taskSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["discovery", "teams", "fixtures", "standings"]),
  league_id: z.number().int().positive().nullable(),
  season: z.number().int().nullable(),
  failures: z.number().int(),
});
export async function executeTask(
  provider: FootballDataProvider,
  task: z.infer<typeof taskSchema>,
  season: number,
) {
  switch (task.kind) {
    case "discovery":
      return discoverCompetitions(await provider.discover(), season);
    case "teams":
      return mapTeams(await provider.teams(task.league_id!, task.season!));
    case "fixtures":
      return mapFixtures(
        await provider.fixtures(task.league_id!, task.season!),
        task.league_id!,
        task.season!,
      );
    case "standings":
      return mapStandings(
        await provider.standings(task.league_id!, task.season!),
        task.league_id!,
        task.season!,
      );
  }
}
async function checked<T>(promise: PromiseLike<{ data: T; error: unknown }>) {
  const r = await promise;
  if (r.error) throw new ProviderError("database");
  return r.data;
}
export async function syncSports() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new HttpError(503, "FORNECEDOR_NAO_CONFIGURADO");
  const config = sportsConfig();
  const db = infrastructureClient(),
    owner = randomUUID();
  const lease = await db.rpc("acquire_sync_lease", { p_owner: owner });
  if (lease.error) throw new HttpError(503, "JOB_INDISPONIVEL");
  if (!lease.data) throw new HttpError(409, "SINCRONIZACAO_EM_ANDAMENTO");
  try {
    return await runCycle(db, owner, key, config);
  } finally {
    await db
      .from("job_leases")
      .delete()
      .eq("name", "sports")
      .eq("owner", owner);
  }
}
export async function runCycle(
  db: SupabaseClient,
  owner: string,
  key: string,
  config: ReturnType<typeof sportsConfig>,
  providerOverride?: FootballDataProvider,
) {
  const provider =
    providerOverride ??
    new ApiFootball(key, { quota: new QuotaManager(db, owner, config) });
  const started = Date.now();
  let completed = 0,
    failed = 0,
    deferred = 0;
  const stopAt = started + 220000;
  const run = await checked(
    db
      .from("sync_runs")
      .insert({ resource: `free:${config.season}`, status: "running" })
      .select("id")
      .single(),
  );
  try {
    // Interrupted runs/tasks are recovered by TTL, not by resetting valid sports data.
    await checked(
      db
        .from("sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          sanitized_error: "interrupted",
        })
        .eq("status", "running")
        .lt("started_at", new Date(started - 600000).toISOString()),
    );
    await checked(
      db.from("sports_sync_tasks").upsert(
        {
          task_key: `discovery:${config.season}`,
          kind: "discovery",
          season: config.season,
          priority: 3,
        },
        { onConflict: "task_key", ignoreDuplicates: true },
      ),
    );
    const due = await db
      .from("sports_sync_tasks")
      .select("id", { count: "exact", head: true })
      .eq("season", config.season)
      .lte("next_run_at", new Date().toISOString());
    if (due.error) throw new ProviderError("database");
    const state = await checked(
      db
        .from("sports_provider_state")
        .select("day,last_status_at,last_status_request_at,daily_used")
        .eq("provider", "api-football")
        .single(),
    );
    const day = new Date().toISOString().slice(0, 10);
    if (
      (due.count ?? 0) > 0 &&
      !(state!.day === day && state!.daily_used >= config.daily) &&
      (!state!.last_status_at ||
        state!.day !== day ||
        Date.now() - new Date(state!.last_status_at).getTime() > 900000)
    )
      await provider.status();
    for (let count = 0; count < 12 && Date.now() < stopAt; count++) {
      const raw = await checked(
        db.rpc("claim_sports_task", { p_owner: owner, p_config: config }),
      );
      if (!raw) {
        const pending = await db
          .from("sports_sync_tasks")
          .select("id", { count: "exact", head: true })
          .eq("season", config.season)
          .lte("next_run_at", new Date().toISOString());
        if (pending.error) throw new ProviderError("database");
        deferred += pending.count ?? 0;
        break;
      }
      const task = taskSchema.parse(raw);
      let error: string | null = null;
      let delay =
        task.kind === "discovery"
          ? 86400
          : task.kind === "teams"
            ? 86400
            : task.kind === "standings"
              ? 21600
              : 28800;
      try {
        const rows = await executeTask(provider, task, config.season);
        if (task.kind === "discovery")
          await checked(
            db.rpc("commit_sports_discovery", {
              p_owner: owner,
              p_season: config.season,
              p_rows: rows,
            }),
          );
        else
          await checked(
            db.rpc("commit_sports_resource", {
              p_owner: owner,
              p_kind: task.kind,
              p_league: task.league_id,
              p_season: task.season,
              p_rows: rows,
            }),
          );
        // On match days shorten fixture cadence to 2h, not live polling. Otherwise 8h.
        if (task.kind === "fixtures") {
          const today = localDay(new Date().toISOString(), "America/Sao_Paulo");
          const relevant = (rows as { kickoff_at: string | null }[]).some(
            (f) =>
              f.kickoff_at &&
              localDay(f.kickoff_at, "America/Sao_Paulo") === today,
          );
          if (relevant) delay = 7200;
        }
        if (
          task.kind !== "discovery" &&
          task.season! < new Date().getUTCFullYear()
        )
          delay = 604800;
        completed++;
      } catch (e) {
        error = e instanceof ProviderError ? e.code : "database";
        failed++;
        delay =
          error === "coverage"
            ? 86400
            : Math.min(21600, 300 * 2 ** Math.min(task.failures, 6));
        if (
          [
            "budget",
            "minute_budget",
            "circuit_open",
            "quota_unavailable",
            "lease_lost",
          ].includes(error)
        ) {
          deferred++;
          delay = error === "budget" ? 3600 : 300;
        }
      }
      if (error && task.kind !== "discovery")
        await checked(
          db.rpc("mark_sports_failure", {
            p_owner: owner,
            p_league: task.league_id,
            p_season: task.season,
            p_resource: task.kind,
            p_state: error === "coverage" ? "unsupported" : "unavailable",
          }),
        );
      await checked(
        db.rpc("finish_sports_task", {
          p_owner: owner,
          p_task: task.id,
          p_error: error,
          p_delay: delay,
        }),
      );

      if (
        error &&
        [
          "budget",
          "minute_budget",
          "circuit_open",
          "quota_unavailable",
          "lease_lost",
          "authentication",
          "inactive_subscription",
          "unsupported_plan",
        ].includes(error)
      )
        break;
    }
    await checked(
      db
        .from("sync_runs")
        .update({
          status: failed || deferred ? "failed" : "success",
          finished_at: new Date().toISOString(),
          metrics: { completed, failed, deferred },
          sanitized_error: failed
            ? "task_failed"
            : deferred
              ? "quota_or_dependency"
              : null,
        })
        .eq("id", run!.id),
    );
    return {
      completed,
      failed,
      deferred,
      outcome: failed
        ? "partial"
        : deferred
          ? "deferred"
          : completed
            ? "success"
            : "idle",
    };
  } catch (e) {
    await db.rpc("mark_sports_failure", {
      p_owner: owner,
      p_league: null,
      p_season: null,
      p_resource: null,
      p_state: "unavailable",
    });
    await db
      .from("sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        metrics: { completed, failed, deferred },
        sanitized_error: e instanceof ProviderError ? e.code : "internal",
      })
      .eq("id", run!.id);
    throw new HttpError(503, "SINCRONIZACAO_INDISPONIVEL");
  }
}
