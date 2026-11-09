import { it, expect, vi, afterEach } from "vitest";
import { recoveryTicket, validRecovery } from "@/lib/security/recovery";
import { supabaseConfig } from "@/lib/env";
afterEach(() => vi.unstubAllEnvs());
it("ticket assinado exige dono, prazo, assinatura íntegra e formato exato", () => {
  vi.stubEnv("RECOVERY_SIGNING_SECRET", "a".repeat(64));
  const now = 1794229200000;
  const ticket = recoveryTicket("user-a", now);
  expect(validRecovery(ticket, "user-a", now)).toBe(true);
  for (const [value, id, time] of [
    [ticket, "user-b", now],
    [ticket, "user-a", now + 600001],
    [ticket, "user-a", now - 1],
    [ticket + ".extra", "user-a", now],
    [ticket.slice(0, -1) + "z", "user-a", now],
    [
      ticket.split(".").slice(0, 2).join(".") + "." + "é".repeat(64),
      "user-a",
      now,
    ],
  ] as const)
    expect(validRecovery(value, id, time)).toBe(false);
});
it("configuração pública rejeita secret key e JWT service_role", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  for (const key of [
    "sb_secret_test",
    "x." +
      Buffer.from(JSON.stringify({ role: "service_role" })).toString(
        "base64url",
      ) +
      ".x",
  ]) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
    expect(supabaseConfig()).toBeNull();
  }
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_local_test",
  );
  expect(supabaseConfig()).not.toBeNull();
});
