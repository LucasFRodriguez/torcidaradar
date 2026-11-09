import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
export function validCron(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header || header.length > 1024)
    return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(header), hash("Bearer " + secret));
}
