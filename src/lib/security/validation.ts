import { z } from "zod";
export const uuid = z.uuid();
export const searchSchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(80)
      .regex(/^[\p{L}\p{N} .'-]*$/u)
      .default(""),
    page: z.coerce.number().int().min(1).max(100).default(1),
  })
  .strict();
export const favoriteSchema = z.object({ teamId: uuid }).strict();
export const preferenceSchema = z
  .object({
    hide_scores: z.boolean(),
    timezone: z.enum([
      "America/Sao_Paulo",
      "America/Manaus",
      "America/Recife",
      "UTC",
    ]),
  })
  .strict();
export const profileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .max(60)
      .regex(/^[\p{L}\p{N} .'-]*$/u),
  })
  .strict();
export const credentialsSchema = z
  .object({
    email: z.string().trim().pipe(z.email().max(254)),
    password: z.string().min(12).max(128),
  })
  .strict();
export const loginSchema = z
  .object({
    email: z.string().trim().pipe(z.email().max(254)),
    password: z.string().min(1).max(128),
  })
  .strict();
export const calendarSchema = z
  .object({
    range: z.enum(["hoje", "semana", "mes"]).default("semana"),
    team: z.union([uuid, z.literal("")]).default(""),
    competition: z.union([uuid, z.literal("")]).default(""),
  })
  .strict();
export function safeNext(value: unknown) {
  return typeof value === "string" &&
    ["/dashboard", "/onboarding", "/atualizar-senha"].includes(value)
    ? value
    : "/dashboard";
}
export function trustedOrigin(origin: string | null, expected: string) {
  return origin !== null && origin === expected;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
