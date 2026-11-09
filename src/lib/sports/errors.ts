export type ProviderCode =
  | "configuration"
  | "authentication"
  | "inactive_subscription"
  | "unsupported_plan"
  | "parameters"
  | "coverage"
  | "rate_limit"
  | "unavailable"
  | "timeout"
  | "network"
  | "invalid_data"
  | "pagination"
  | "budget"
  | "minute_budget"
  | "circuit_open"
  | "quota_unavailable"
  | "database"
  | "lease_lost"
  | "empty_unverified";
export class ProviderError extends Error {
  constructor(
    public code: ProviderCode,
    public retryAfterSeconds?: number,
  ) {
    super(code);
  }
}
