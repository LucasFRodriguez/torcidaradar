import { z } from "zod";
import { validCron } from "@/lib/security/cron";
import { sportsCatalogue } from "@/server/jobs/catalogue";
import { body, json, failure } from "@/lib/security/http";
export const maxDuration = 60;
const confirmation = z.object({ confirmCost: z.literal(true) }).strict();
export async function POST(req: Request) {
  if (!validCron(req.headers.get("authorization"), process.env.CRON_SECRET))
    return json({ error: "NAO_AUTORIZADO" }, 401);
  try {
    confirmation.parse(await body(req));
    return json(await sportsCatalogue());
  } catch (error) {
    return failure(error);
  }
}
