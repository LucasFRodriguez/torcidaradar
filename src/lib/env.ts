import "server-only";
import { z } from "zod";
const originSchema = z.url().refine((v) => {
  const u = new URL(v);
  return (
    u.origin === v &&
    (u.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(u.hostname)))
  );
});
export function appOrigin() {
  return originSchema.parse(
    process.env.APP_ORIGIN ||
      (process.env.NODE_ENV !== "production"
        ? "http://localhost:3000"
        : undefined),
  );
}
export function demoEnabled() {
  return (
    process.env.NODE_ENV !== "production" && process.env.LOCAL_DEMO === "true"
  );
}
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const parsed = z.url().safeParse(url);
  if (!parsed.success || !url.startsWith("https://")) return null;
  if (!key.startsWith("sb_publishable_")) {
    try {
      const claims = JSON.parse(
        Buffer.from(key.split(".")[1] ?? "", "base64url").toString(),
      );
      if (claims.role !== "anon") return null;
    } catch {
      return null;
    }
  }
  return { url, key };
}
export function privilegedKey() {
  return z.string().min(20).parse(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
