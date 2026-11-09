import "server-only";
import { infrastructureClient } from "@/lib/supabase/admin";
import { sportsConfig } from "@/lib/sports/config";
import { ProviderError } from "@/lib/sports/errors";
export async function sportsMonitor() {
  const db = infrastructureClient();
  const config = (() => {
    try {
      return sportsConfig();
    } catch {
      return null;
    }
  })();
  const results = await Promise.all([
    db
      .from("sports_provider_state")
      .select(
        "day,daily_used,provider_used,provider_remaining,provider_daily_limit,provider_minute_remaining,plan,active,last_status_at,blocked_until,last_error",
      )
      .eq("provider", "api-football")
      .single(),
    db
      .from("sports_sync_tasks")
      .select(
        "task_key,kind,state,priority,next_run_at,last_success_at,last_error,completed_count,failures",
      )
      .order("next_run_at")
      .limit(100),
    db
      .from("sports_competition_coverage")
      .select(
        "target,season,provider_id,provider_name,available_seasons,state,last_success_at,last_error",
      )
      .limit(100),
    db
      .from("sync_runs")
      .select("started_at,finished_at,status,metrics,sanitized_error")
      .order("started_at", { ascending: false })
      .limit(10),
  ]);
  if (results.some((r) => r.error)) throw new ProviderError("database");
  const state = results[0].data as Record<string, unknown> | null;
  const today = new Date().toISOString().slice(0, 10);
  const used = state?.day === today ? Number(state?.daily_used ?? 0) : 0;
  return {
    integration: !process.env.API_FOOTBALL_KEY
      ? "not_configured"
      : state?.blocked_until &&
          Date.parse(String(state.blocked_until)) > Date.now()
        ? "blocked"
        : state?.active !== true
          ? "unavailable"
          : state?.plan !== "Free"
            ? "unverified_or_unsupported"
            : "configured",
    state,
    config: config
      ? {
          season: config.season,
          dailyBudget: config.daily,
          minuteBudget: config.minute,
          operationalReserve: config.operationalReserve,
        }
      : { error: "SEASON_OR_BUDGET_NOT_CONFIGURED" },
    internalAvailable: config ? Math.max(0, config.daily - used) : null,
    tasks: (
      (results[1].data ?? []) as {
        last_success_at: string | null;
        next_run_at: string;
      }[]
    ).map((t) => ({
      ...t,
      neverSynced: !t.last_success_at,
      overdue: Date.parse(t.next_run_at) < Date.now(),
    })),
    coverage: results[2].data,
    runs: results[3].data,
    scheduler: "external_invocation_required",
    keyConfigured: !!process.env.API_FOOTBALL_KEY,
    nextScheduledExecution: null,
    completedTasks: (
      (results[1].data ?? []) as { completed_count: number }[]
    ).reduce((sum, t) => sum + t.completed_count, 0),
    effectiveAvailable:
      config && state?.plan === "Free" && state?.active === true
        ? Math.max(
            0,
            Math.min(
              config.daily - used,
              Number(state?.provider_remaining ?? 0) -
                config.operationalReserve,
            ),
          )
        : 0,
  };
}
