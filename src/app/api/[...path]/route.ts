import { NextRequest } from "next/server";
import { z } from "zod";
import { identity } from "@/lib/supabase/server";
import { snapshot, findTeams } from "@/server/dal/football";
import { demoState, writeDemo, demoTeams } from "@/server/dal/demo";
import {
  assertOrigin,
  body,
  failure,
  json,
  limit,
  query,
} from "@/lib/security/http";
import {
  favoriteSchema,
  preferenceSchema,
  profileSchema,
  searchSchema,
  uuid,
  HttpError,
  calendarSchema,
} from "@/lib/security/validation";
import { inRange } from "@/lib/sports/domain";
type Context = { params: Promise<{ path: string[] }> };
async function handle(req: NextRequest, context: Context) {
  try {
    const path = (await context.params).path.join("/");
    const method = req.method;
    if (method !== "GET") assertOrigin(req);
    const demo = await demoState();
    const auth = demo ? null : await identity();
    if (!demo)
      await limit(
        `${auth!.user.id}:${method === "GET" ? "read" : "write"}`,
        method === "GET" ? 90 : 30,
      );
    if (method === "GET") {
      if (path === "teams") {
        const p = searchSchema.parse(query(req));
        return json({ teams: await findTeams(p.search, p.page), page: p.page });
      }
      if (path === "dashboard") return json(await snapshot());
      if (path === "me/favorites") {
        const s = await snapshot();
        return json({
          teams: s.teams.filter((t) => s.favorites.includes(t.id)),
        });
      }
      if (path === "calendar") {
        const p = calendarSchema.parse(query(req));
        const s = await snapshot();
        const seasonIds = s.seasons
          .filter((c) => !p.competition || c.competition_id === p.competition)
          .map((c) => c.id);
        return json({
          fixtures: s.fixtures.filter(
            (f) =>
              inRange(f, p.range, s.timezone) &&
              (!p.team || [f.home_team_id, f.away_team_id].includes(p.team)) &&
              seasonIds.includes(f.season_id),
          ),
        });
      }
    }
    if (path === "me/favorites" && method === "POST") {
      const { teamId } = favoriteSchema.parse(await body(req));
      if (demo) {
        if (!demoTeams.some((t) => t.id === teamId))
          throw new HttpError(404, "TIME_NAO_ENCONTRADO");
        await writeDemo({
          ...demo,
          favorites: [...new Set([...demo.favorites, teamId])],
        });
      } else {
        const { error } = await auth!.db
          .from("user_favorite_teams")
          .upsert(
            { user_id: auth!.user.id, team_id: teamId },
            { onConflict: "user_id,team_id", ignoreDuplicates: true },
          );
        if (error) throw new HttpError(400, "FAVORITO_NAO_SALVO");
      }
      return json({ ok: true });
    }
    if (path.startsWith("me/favorites/") && method === "DELETE") {
      const id = uuid.parse(path.slice("me/favorites/".length));
      if (demo)
        await writeDemo({
          ...demo,
          favorites: demo.favorites.filter((t) => t !== id),
        });
      else {
        const { error } = await auth!.db
          .from("user_favorite_teams")
          .delete()
          .eq("user_id", auth!.user.id)
          .eq("team_id", id);
        if (error) throw new HttpError(503, "FAVORITO_NAO_REMOVIDO");
      }
      return json({ ok: true });
    }
    if (path === "me/preferences" && method === "POST") {
      const p = preferenceSchema.parse(await body(req));
      if (demo) await writeDemo({ ...demo, ...p });
      else {
        const { error } = await auth!.db
          .from("user_preferences")
          .upsert({ user_id: auth!.user.id, ...p });
        if (error) throw new HttpError(503, "PREFERENCIAS_NAO_SALVAS");
      }
      return json({ ok: true });
    }
    if (path === "me/profile" && method === "POST") {
      const p = profileSchema.parse(await body(req));
      if (demo) await writeDemo({ ...demo, ...p });
      else {
        const { error } = await auth!.db
          .from("profiles")
          .upsert({ id: auth!.user.id, ...p });
        if (error) throw new HttpError(503, "PERFIL_NAO_SALVO");
      }
      return json({ ok: true });
    }
    if (path === "me/deletion-request" && method === "POST") {
      const p = z
        .object({
          password: z.string().min(1).max(128),
          confirmation: z.literal("EXCLUIR MINHA CONTA"),
        })
        .strict()
        .parse(await body(req));
      if (demo) throw new HttpError(400, "DEMONSTRACAO_NAO_POSSUI_CONTA");
      const { error } = await auth!.db.auth.signInWithPassword({
        email: auth!.user.email!,
        password: p.password,
      });
      if (error) throw new HttpError(403, "CONFIRMACAO_NAO_VALIDADA");
      const result = await auth!.db
        .from("account_deletion_requests")
        .insert({ user_id: auth!.user.id });
      if (result.error && result.error.code !== "23505")
        throw new HttpError(503, "SOLICITACAO_NAO_REGISTRADA");
      return json({ ok: true, status: "pending" });
    }
    throw new HttpError(404, "ROTA_NAO_ENCONTRADA");
  } catch (e) {
    return failure(e);
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
