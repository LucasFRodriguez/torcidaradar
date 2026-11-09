import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { demoEnabled } from "@/lib/env";
import { uuid } from "@/lib/security/validation";
export const demoTeams = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Aurora FC",
    slug: "aurora-fc",
    country: "Brasil",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Porto Verde",
    slug: "porto-verde",
    country: "Brasil",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Atlético do Vale",
    slug: "atletico-do-vale",
    country: "Brasil",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "União Serrana",
    slug: "uniao-serrana",
    country: "Brasil",
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    name: "Estrela do Sul",
    slug: "estrela-do-sul",
    country: "Brasil",
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    name: "Nacional da Praia",
    slug: "nacional-da-praia",
    country: "Brasil",
  },
];
const schema = z.object({
  favorites: z.array(uuid).max(30).default([]),
  hide_scores: z.boolean().default(false),
  timezone: z
    .enum(["America/Sao_Paulo", "America/Manaus", "America/Recife", "UTC"])
    .default("America/Sao_Paulo"),
  display_name: z.string().max(60).default("Visitante"),
});
export async function demoState() {
  if (!demoEnabled()) return null;
  const raw = (await cookies()).get("tr-demo")?.value;
  if (!raw) return null;
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
export async function writeDemo(state: z.infer<typeof schema>) {
  if (!demoEnabled()) throw new Error("Demo unavailable");
  (await cookies()).set("tr-demo", JSON.stringify(schema.parse(state)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
}
export function demoFixtures() {
  const base = new Date();
  base.setUTCHours(22, 0, 0, 0);
  return [-2, 0, 2, 4, 7, 12, 20].map((days, i) => ({
    id: `demo-${i}`,
    season_id: "20000000-0000-4000-8000-000000000001",
    home_team_id: demoTeams[i % 6].id,
    away_team_id: demoTeams[(i + 1) % 6].id,
    kickoff_at: new Date(base.getTime() + days * 86400000).toISOString(),
    status: days < 0 ? "FT" : "NS",
    home_score: days < 0 ? 2 : null,
    away_score: days < 0 ? 1 : null,
    home_penalties: null,
    away_penalties: null,
    updated_at: base.toISOString(),
  }));
}
