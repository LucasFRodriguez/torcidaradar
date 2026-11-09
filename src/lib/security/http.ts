import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { appOrigin } from "@/lib/env";
import { HttpError, trustedOrigin } from "./validation";
import { infrastructureClient } from "@/lib/supabase/admin";
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    },
  });
}
export function failure(error: unknown) {
  const known = error instanceof HttpError;
  return json(
    {
      error: known
        ? error.code
        : error instanceof z.ZodError
          ? "ENTRADA_INVALIDA"
          : "SERVICO_INDISPONIVEL",
    },
    known ? error.status : error instanceof z.ZodError ? 400 : 503,
  );
}
export function assertOrigin(req: Request) {
  if (!trustedOrigin(req.headers.get("origin"), appOrigin()))
    throw new HttpError(403, "ORIGEM_INVALIDA");
}
export async function body(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "TIPO_INVALIDO");
  const text = await limitedText(req, 4096);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "JSON_INVALIDO");
  }
}
export async function limitedText(req: Request, limit: number) {
  const reader = req.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "CONTEUDO_EXCESSIVO");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function limit(key: string, max = 60, seconds = 60) {
  const db = infrastructureClient();
  const bucket = createHash("sha256").update(key).digest("hex");
  const { data, error } = await db.rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_limit: max,
    p_seconds: seconds,
  });
  if (error) throw new HttpError(503, "PROTECAO_TEMPORARIAMENTE_INDISPONIVEL");
  if (!data) throw new HttpError(429, "LIMITE_DE_REQUISICOES");
}
export function query(req: Request) {
  const u = new URL(req.url);
  if (u.search.length > 1000) throw new HttpError(400, "CONSULTA_EXCESSIVA");
  const out: Record<string, string> = {};
  for (const [k, v] of u.searchParams) {
    if (k in out) throw new HttpError(400, "PARAMETRO_DUPLICADO");
    out[k] = v;
  }
  return out;
}
