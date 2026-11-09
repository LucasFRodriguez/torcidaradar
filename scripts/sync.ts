export {};
const execute = process.argv.includes("--execute");
console.log(
  "API-Football Free: orçamento padrão 70/dia, 8/minuto, reserva operacional 30. Ciclo: até 12 tarefas, até 3 tentativas por chamada; admissão real limitada pelo saldo persistido e pelos headers. /status reconcilia em intervalos de pelo menos 15 min e não é cobrado no dia segundo o contrato.",
);
if (!execute) {
  console.log(
    "Prévia sem rede e sem consumo de quota. Para autorizar execução manual: npm run sync -- --execute",
  );
} else {
  const origin = process.env.APP_ORIGIN,
    secret = process.env.CRON_SECRET;
  if (!origin || !secret)
    throw new Error("APP_ORIGIN e CRON_SECRET obrigatórios");
  const url = new URL("/api/internal/sync", origin);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error("HTTPS obrigatório");
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    redirect: "error",
    signal: AbortSignal.timeout(300000),
  });
  console.log("sync status", r.status);
  if (!r.ok) process.exitCode = 1;
}
