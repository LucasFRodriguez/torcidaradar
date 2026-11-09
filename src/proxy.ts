import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/env";
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'" + (dev ? " ws:" : ""),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self'",
    ...(!dev ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const incoming = new Headers(request.headers);
  incoming.set("x-nonce", nonce);
  incoming.set("Content-Security-Policy", csp);
  let response = NextResponse.next({ request: { headers: incoming } });
  const config = supabaseConfig();
  if (config) {
    const db = createServerClient(config.url, config.key, {
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: !dev },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items, cacheHeaders) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          incoming.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: incoming } });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(cacheHeaders ?? {}).forEach(([k, v]) =>
            response.headers.set(k, v),
          );
        },
      },
    });
    try {
      await db.auth.getClaims();
    } catch {
      /* Private DAL still fails closed; public pages remain available. */
    }
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|icon-192.png|icon-512.png|offline.html|sw.js).*)",
  ],
};
