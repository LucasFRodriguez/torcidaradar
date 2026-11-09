import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/env";
import { HttpError } from "@/lib/security/validation";
export async function userClient() {
  const config = supabaseConfig();
  if (!config) throw new HttpError(503, "INTEGRACAO_INDISPONIVEL");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components: proxy refreshes cookies. */
        }
      },
    },
  });
}
export async function identity() {
  const db = await userClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "AUTENTICACAO_NECESSARIA");
  return { db, user: data.user };
}
