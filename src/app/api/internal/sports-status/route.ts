import { validCron } from "@/lib/security/cron";
import { sportsMonitor } from "@/server/jobs/monitor";
import { json, failure } from "@/lib/security/http";
export async function GET(req: Request) {
  if (!validCron(req.headers.get("authorization"), process.env.CRON_SECRET))
    return json({ error: "NAO_AUTORIZADO" }, 401);
  try {
    return json(await sportsMonitor());
  } catch (e) {
    return failure(e);
  }
}
