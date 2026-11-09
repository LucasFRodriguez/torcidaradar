import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "API_FOOTBALL_KEY",
  "CRON_SECRET",
  "RECOVERY_SIGNING_SECRET",
];
const values = forbidden
  .map((k) => process.env[k])
  .filter((v) => v && v.length >= 16);
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(file);
    else {
      const content = await readFile(file);
      for (const marker of [...forbidden, ...values])
        if (content.includes(Buffer.from(marker)))
          throw new Error(`Server secret boundary violation in ${file}`);
    }
  }
}
await scan(".next/static");
await scan("public");
console.log(
  "Client boundary: no privileged variable names/values in static bundles or public assets.",
);
