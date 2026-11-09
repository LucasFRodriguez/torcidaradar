export {};
const origin = process.env.APP_ORIGIN,
  secret = process.env.CRON_SECRET;
if (!origin || !secret)
  throw new Error("APP_ORIGIN e CRON_SECRET obrigatórios");
const url = new URL("/api/internal/sports-status", origin);
if (
  url.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(url.hostname)
)
  throw new Error("HTTPS obrigatório");
const r = await fetch(url, {
  headers: { authorization: `Bearer ${secret}` },
  redirect: "error",
  signal: AbortSignal.timeout(15000),
});
if (!r.ok) {
  console.error("Monitor indisponível", r.status);
  process.exitCode = 1;
} else console.log(JSON.stringify(await r.json(), null, 2));
