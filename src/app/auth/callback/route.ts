import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { userClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/security/validation";
import { appOrigin } from "@/lib/env";
import { recoveryTicket } from "@/lib/security/recovery";
export async function GET(req: NextRequest) {
  let next = "/login?status=falha";
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (code && code.length <= 2048) {
      const db = await userClient();
      const { data, error } = await db.auth.exchangeCodeForSession(code);
      if (!error) {
        next = safeNext(req.nextUrl.searchParams.get("next"));
        if (next === "/atualizar-senha" && data.user)
          (await cookies()).set("tr-recovery", recoveryTicket(data.user.id), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/auth",
            maxAge: 600,
          });
      }
    }
  } catch {
    /* Never log callback URLs/tokens. */
  }
  return NextResponse.redirect(new URL(next, appOrigin()), {
    status: 303,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
