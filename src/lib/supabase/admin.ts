import "server-only";
import { createClient } from "@supabase/supabase-js";
import { privilegedKey, supabaseConfig } from "@/lib/env";
import { HttpError } from "@/lib/security/validation";
// Never use this client for user-domain reads or writes. Only infra/jobs.
export function infrastructureClient() {
  const config = supabaseConfig();
  if (!config) throw new HttpError(503, "INTEGRACAO_INDISPONIVEL");
  return createClient(config.url, privilegedKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
