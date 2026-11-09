import "server-only";
import { z } from "zod";
import { ProviderError, type ProviderCode } from "./errors";
import {
  envelopeSchema,
  leagueSchema,
  providerTeamSchema,
  providerFixtureSchema,
  providerStandingsSchema,
  statusSchema,
  type League,
  type ProviderTeam,
  type ProviderFixture,
  type ProviderStandings,
  type AccountStatus,
} from "./schemas";
export { ProviderError } from "./errors";
export type Endpoint =
  "status" | "leagues" | "teams" | "fixtures" | "standings";
export type Priority = "high" | "medium";
export type QuotaObservation = {
  code: "success" | ProviderCode;
  dailyLimit?: number;
  dailyRemaining?: number;
  minuteLimit?: number;
  minuteRemaining?: number;
  retryAfterSeconds?: number;
  account?: AccountStatus;
};
export interface QuotaControl {
  reserve(endpoint: Endpoint, priority: Priority): Promise<string>;
  settle(id: string, observation: QuotaObservation): Promise<void>;
}
export interface FootballDataProvider {
  status(): Promise<AccountStatus>;
  discover(): Promise<League[]>;
  teams(league: number, season: number): Promise<ProviderTeam[]>;
  fixtures(league: number, season: number): Promise<ProviderFixture[]>;
  standings(league: number, season: number): Promise<ProviderStandings[]>;
}
export type SportsProvider = FootballDataProvider;
type Dependencies = {
  quota: QuotaControl;
  maxAttempts?: 1 | 2 | 3;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
};
export function retryAfter(value: string | null, now = Date.now()) {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(seconds, 86400)
    : undefined;
}
function count(h: Headers, name: string) {
  const value = h.get(name);
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : undefined;
}
function headers(h: Headers, now: number) {
  return {
    dailyLimit: count(h, "x-ratelimit-requests-limit"),
    dailyRemaining: count(h, "x-ratelimit-requests-remaining"),
    minuteLimit: count(h, "x-ratelimit-limit"),
    minuteRemaining: count(h, "x-ratelimit-remaining"),
    retryAfterSeconds: retryAfter(h.get("retry-after"), now),
  };
}
function apiError(
  errors: Record<string, unknown> | unknown[],
): ProviderCode | null {
  if (!Object.keys(errors).length) return null;
  const keys = Object.keys(errors).join(" ").toLowerCase();
  const text = JSON.stringify(errors).toLowerCase();
  if (/token|key|authentication/.test(keys)) return "authentication";
  if (/plan|season|coverage/.test(keys)) return "coverage";
  if (/subscription|inactive/.test(keys + " " + text))
    return "inactive_subscription";
  if (/season|coverage/.test(text)) return "coverage";
  if (/rate|limit|requests/.test(keys)) return "rate_limit";
  if (/parameters|endpoint|filter/.test(keys)) return "parameters";
  return "unavailable";
}
export class ApiFootball implements FootballDataProvider {
  private http: typeof fetch;
  private sleep: (ms: number) => Promise<void>;
  private random: () => number;
  private now: () => number;
  constructor(
    private key: string,
    private deps: Dependencies,
  ) {
    this.http = deps.fetch ?? fetch;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = deps.random ?? Math.random;
    this.now = deps.now ?? Date.now;
  }
  private async request<T>(
    endpoint: Endpoint,
    params: Record<string, string>,
    schema: z.ZodType<T>,
    priority: Priority,
  ): Promise<T> {
    if (!this.key) throw new ProviderError("configuration");
    const allowed: Record<Endpoint, string[]> = {
      status: [],
      leagues: ["country"],
      teams: ["league", "season"],
      fixtures: ["league", "season"],
      standings: ["league", "season"],
    };
    if (
      !(endpoint in allowed) ||
      Object.keys(params).some((k) => !allowed[endpoint].includes(k))
    )
      throw new ProviderError("parameters");
    const url = new URL("https://v3.football.api-sports.io/" + endpoint);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    for (let attempt = 0; attempt < (this.deps.maxAttempts ?? 3); attempt++) {
      const reservation = await this.deps.quota.reserve(endpoint, priority);
      let observation: QuotaObservation = { code: "network" };
      let result: T | undefined;
      let failure: ProviderError | undefined;
      try {
        const response = await this.http(url, {
          headers: { "x-apisports-key": this.key },
          method: "GET",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        });
        observation = {
          code: "success",
          ...headers(response.headers, this.now()),
        };
        if (!response.ok) {
          await response.body?.cancel();
          throw new ProviderError(
            response.status === 401 || response.status === 403
              ? "authentication"
              : response.status === 429
                ? "rate_limit"
                : response.status >= 500
                  ? "unavailable"
                  : "parameters",
            observation.retryAfterSeconds,
          );
        }
        const reader = response.body?.getReader();
        if (!reader) throw new ProviderError("invalid_data");
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 8_000_000) {
            await reader.cancel();
            throw new ProviderError("invalid_data");
          }
          chunks.push(value);
        }
        let raw: unknown;
        try {
          raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          throw new ProviderError("invalid_data");
        }
        const envelope = envelopeSchema.safeParse(raw);
        if (!envelope.success) throw new ProviderError("invalid_data");
        const code = apiError(envelope.data.errors);
        if (code) throw new ProviderError(code, observation.retryAfterSeconds);
        if (
          envelope.data.paging.current !== 1 ||
          envelope.data.paging.total > 1
        )
          throw new ProviderError("pagination");
        const parsed = schema.safeParse(envelope.data.response);
        if (!parsed.success) throw new ProviderError("invalid_data");
        if (
          envelope.data.results !==
          (Array.isArray(parsed.data) ? parsed.data.length : 1)
        )
          throw new ProviderError("invalid_data");
        if (envelope.data.paging.total === 0 && envelope.data.results !== 0)
          throw new ProviderError("invalid_data");
        result = parsed.data;
        if (endpoint === "status") {
          const account = result as AccountStatus;
          observation.account = account;
          if (!account.subscription.active)
            throw new ProviderError("inactive_subscription");
          if (account.subscription.plan.trim().toLowerCase() !== "free")
            throw new ProviderError("unsupported_plan");
          account.subscription.plan = "Free";
        }
      } catch (e) {
        failure =
          e instanceof ProviderError
            ? e
            : new ProviderError(
                e instanceof DOMException &&
                  (e.name === "TimeoutError" || e.name === "AbortError")
                  ? "timeout"
                  : "network",
              );
        observation.code = failure.code;
      }
      // Always reconcile, including 200-with-errors, timeout and final attempt. No refund.
      await this.deps.quota.settle(reservation, observation);
      if (!failure) return result!;
      if (
        !["rate_limit", "unavailable", "timeout", "network"].includes(
          failure.code,
        ) ||
        attempt === (this.deps.maxAttempts ?? 3) - 1
      )
        throw failure;
      const delay = Math.max(
        500 * 2 ** attempt + this.random() * 250,
        (observation.retryAfterSeconds ?? 0) * 1000,
      );
      if (delay > 15000) throw failure;
      await this.sleep(delay);
    }
    throw new ProviderError("unavailable");
  }
  status() {
    return this.request("status", {}, statusSchema, "high");
  }
  discover() {
    return this.request(
      "leagues",
      { country: "Brazil" },
      z.array(leagueSchema).max(1000),
      "medium",
    );
  }
  private params(league: number, season: number) {
    if (
      !z.number().int().positive().safeParse(league).success ||
      !z.number().int().min(2000).max(2100).safeParse(season).success
    )
      throw new ProviderError("parameters");
    return { league: String(league), season: String(season) };
  }
  teams(league: number, season: number) {
    return this.request(
      "teams",
      this.params(league, season),
      z.array(providerTeamSchema).max(1000),
      "medium",
    );
  }
  fixtures(league: number, season: number) {
    return this.request(
      "fixtures",
      this.params(league, season),
      z.array(providerFixtureSchema).max(10000),
      "high",
    );
  }
  standings(league: number, season: number) {
    return this.request(
      "standings",
      this.params(league, season),
      z.array(providerStandingsSchema).max(20),
      "high",
    );
  }
}
