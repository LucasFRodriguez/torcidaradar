import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { appOrigin, demoEnabled } from "@/lib/env";
import { userClient, identity } from "@/lib/supabase/server";
import { assertOrigin, limitedText, limit } from "@/lib/security/http";
import {
  credentialsSchema,
  loginSchema,
  HttpError,
} from "@/lib/security/validation";
import { validRecovery } from "@/lib/security/recovery";
import { writeDemo } from "@/server/dal/demo";
function redirect(path: string) {
  return NextResponse.redirect(new URL(path, appOrigin()), {
    status: 303,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  try {
    if (
      !["login", "signup", "recover", "password", "logout", "demo"].includes(
        action,
      )
    )
      throw new HttpError(404, "ROTA_INVALIDA");
    assertOrigin(req);
    if (
      !req.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      throw new HttpError(415, "TIPO_INVALIDO");
    const raw = new URLSearchParams(await limitedText(req, 4096));
    const values = Object.fromEntries(raw);
    if (raw.size !== Object.keys(values).length)
      throw new HttpError(400, "PARAMETRO_DUPLICADO");
    if (action === "demo") {
      if (!demoEnabled()) return redirect("/login?status=indisponivel");
      await writeDemo({
        favorites: [],
        hide_scores: false,
        timezone: "America/Sao_Paulo",
        display_name: "Visitante",
      });
      return redirect("/onboarding");
    }
    if (action === "logout") {
      (await cookies()).delete("tr-demo");
      (await cookies()).set("tr-recovery", "", {
        path: "/auth",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      const db = await userClient().catch(() => null);
      if (db) {
        const result = await db.auth.signOut();
        if (result.error) throw new HttpError(503, "LOGOUT_NAO_CONCLUIDO");
      }
      const r = redirect("/login?status=saiu");
      r.headers.set("Clear-Site-Data", '"cache", "storage"');
      return r;
    }
    // Shared global limiter is conservative and does not trust forwarded IPs.
    // Configure provider/edge per-IP throttling as an additional deployment gate.
    await limit(`auth:${action}:global`, action === "login" ? 60 : 20, 60);
    const db = await userClient();
    if (action === "login") {
      const p = loginSchema.parse(values);
      await limit("auth:login:" + p.email.toLowerCase(), 5, 300);
      const { error } = await db.auth.signInWithPassword(p);
      return redirect(error ? "/login?status=falha" : "/dashboard");
    }
    if (action === "signup") {
      const p = credentialsSchema.parse(values);
      await limit("auth:signup:" + p.email.toLowerCase(), 3, 300);
      await db.auth.signUp({
        ...p,
        options: {
          emailRedirectTo: appOrigin() + "/auth/callback?next=/onboarding",
        },
      });
      return redirect("/login?status=verifique");
    }
    if (action === "recover") {
      const { email } = z
        .object({ email: z.email().max(254) })
        .strict()
        .parse(values);
      await limit("auth:recover:" + email.toLowerCase(), 3, 300);
      await db.auth.resetPasswordForEmail(email, {
        redirectTo: appOrigin() + "/auth/callback?next=/atualizar-senha",
      });
      return redirect("/recuperar-senha?status=verifique");
    }
    if (action === "password") {
      const p = z
        .object({
          password: z.string().min(12).max(128),
          current_password: z.string().max(128).optional(),
        })
        .strict()
        .parse(values);
      const { user } = await identity();
      // Recovery authorization is a short HttpOnly cookie set ONLY after PKCE exchange.
      const recovery = validRecovery(
        (await cookies()).get("tr-recovery")?.value,
        user.id,
      );
      if (!recovery) {
        if (!p.current_password)
          throw new HttpError(403, "REAUTENTICACAO_NECESSARIA");
        const { error } = await db.auth.signInWithPassword({
          email: user.email!,
          password: p.current_password,
        });
        if (error) throw new HttpError(403, "REAUTENTICACAO_NECESSARIA");
      }
      const { error } = await db.auth.updateUser({ password: p.password });
      if (error) return redirect("/atualizar-senha?status=falha");
      (await cookies()).set("tr-recovery", "", {
        path: "/auth",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      await db.auth.signOut({ scope: "global" });
      return redirect("/login?status=senha");
    }
    return redirect("/login?status=falha");
  } catch (e) {
    return redirect(
      (action === "recover"
        ? "/recuperar-senha"
        : action === "password"
          ? "/atualizar-senha"
          : "/login") +
        "?status=" +
        (e instanceof HttpError && e.status === 429 ? "limite" : "falha"),
    );
  }
}
