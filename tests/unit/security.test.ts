import { describe, it, expect, vi } from "vitest";
import {
  safeNext,
  trustedOrigin,
  favoriteSchema,
  searchSchema,
  profileSchema,
  calendarSchema,
} from "@/lib/security/validation";
import { demoEnabled } from "@/lib/env";
describe("fronteiras de entrada", () => {
  it("redirecionamento usa allowlist exata", () => {
    for (const v of [
      "//evil.com",
      "https://evil.com",
      "/\\evil",
      "/dashboard?x=1",
      "/auth/callback",
      null,
    ])
      expect(safeNext(v)).toBe("/dashboard");
    expect(safeNext("/onboarding")).toBe("/onboarding");
  });
  it("CSRF rejeita origem ausente, parecida e externa", () => {
    for (const o of [null, "null", "https://app.test.evil", "http://app.test"])
      expect(trustedOrigin(o, "https://app.test")).toBe(false);
    expect(trustedOrigin("https://app.test", "https://app.test")).toBe(true);
  });
  it("rejeita autoridade user_id, XSS, SQLi, busca gigante e paginação inválida", () => {
    expect(
      favoriteSchema.safeParse({
        teamId: "00000000-0000-4000-8000-000000000001",
        user_id: "x",
      }).success,
    ).toBe(false);
    for (const n of ["<script>alert(1)</script>", '" onmouseover=alert(1)'])
      expect(profileSchema.safeParse({ display_name: n }).success).toBe(false);
    for (const s of ["a".repeat(81), "%", "foo;drop table teams"])
      expect(searchSchema.safeParse({ search: s }).success).toBe(false);
    for (const p of ["NaN", 0, -1, 101, "1 OR 1=1"])
      expect(searchSchema.safeParse({ page: p }).success).toBe(false);
    expect(calendarSchema.safeParse({ range: "ano" }).success).toBe(false);
  });
  it("demo desabilitado em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_DEMO", "true");
    expect(demoEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
});
