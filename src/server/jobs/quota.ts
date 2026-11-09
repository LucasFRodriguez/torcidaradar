import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Endpoint,
  Priority,
  QuotaControl,
  QuotaObservation,
} from "@/lib/sports/provider";
import { ProviderError } from "@/lib/sports/errors";
import { sportsBudgetConfig } from "@/lib/sports/config";
const reservation = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  retry_after: z.number().optional(),
  reservation: z.uuid().optional(),
});
export class QuotaManager implements QuotaControl {
  constructor(
    private db: SupabaseClient,
    private owner: string,
    private config: ReturnType<typeof sportsBudgetConfig>,
  ) {}
  async reserve(endpoint: Endpoint, priority: Priority) {
    const { data, error } = await this.db.rpc("reserve_sports_request", {
      p_owner: this.owner,
      p_endpoint: endpoint,
      p_priority: priority,
      p_config: this.config,
      p_cost: 1,
    });
    const r = reservation.safeParse(data);
    if (error || !r.success) throw new ProviderError("quota_unavailable");
    if (!r.data.allowed) {
      const code = r.data.reason;
      throw new ProviderError(
        code === "minute_budget"
          ? "minute_budget"
          : code === "lease_lost"
            ? "lease_lost"
            : code === "circuit_open"
              ? "circuit_open"
              : "budget",
        r.data.retry_after,
      );
    }
    if (!r.data.reservation) throw new ProviderError("quota_unavailable");
    return r.data.reservation;
  }
  async settle(id: string, observation: QuotaObservation) {
    const { error } = await this.db.rpc("settle_sports_request", {
      p_reservation: id,
      p_observation: observation,
    });
    if (error) throw new ProviderError("quota_unavailable");
  }
}
