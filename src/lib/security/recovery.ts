import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
function signingKey() {
  return Buffer.from(
    z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(process.env.RECOVERY_SIGNING_SECRET),
    "hex",
  );
}
export function recoveryTicket(id: string, now = Date.now()) {
  const payload = `${id}.${now}`;
  return (
    payload +
    "." +
    createHmac("sha256", signingKey())
      .update("recovery:" + payload)
      .digest("hex")
  );
}
export function validRecovery(
  ticket: string | undefined,
  id: string,
  now = Date.now(),
) {
  if (!ticket) return false;
  const parts = ticket.split(".");
  if (parts.length !== 3) return false;
  const [uid, t, mac] = parts;
  if (
    uid !== id ||
    !/^\d{13}$/.test(t ?? "") ||
    !mac ||
    !/^[a-f0-9]{64}$/.test(mac) ||
    now - Number(t) > 600000 ||
    now < Number(t)
  )
    return false;
  const expected = recoveryTicket(uid, Number(t)).split(".")[2];
  return (
    mac.length === expected.length &&
    timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  );
}
