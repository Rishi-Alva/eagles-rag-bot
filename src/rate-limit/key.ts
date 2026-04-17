import { createHash } from "node:crypto";

/** Stable key per browser clientId; falls back to IP-based id when clientId is missing. */
export function makeRateLimitKey(pepper: string, clientId: string | undefined, ipFallback: string): string {
  const raw = (clientId && clientId.trim().length >= 8 ? clientId.trim() : `ip:${ipFallback}`) + "|" + pepper;
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}
