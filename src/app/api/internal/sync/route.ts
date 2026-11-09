import { syncSports } from "@/server/jobs/sync";
import { validCron } from "@/lib/security/cron";
import { failure, json } from "@/lib/security/http";
export const maxDuration = 300;
export async function POST(req: Request) {
  if (!validCron(req.headers.get("authorization"), process.env.CRON_SECRET))
    return json({ error: "NAO_AUTORIZADO" }, 401);
  try {
    const metrics = await syncSports();
    return json(
      { ok: metrics.failed === 0 && metrics.deferred === 0, metrics },
      metrics.failed || metrics.deferred ? 503 : 200,
    );
  } catch (e) {
    return failure(e);
  }
}
