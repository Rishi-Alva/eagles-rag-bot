import { env } from "../env.js";
import { rateLimitMessage } from "./config.js";
import * as store from "./store.js";
import { makeRateLimitKey } from "./key.js";

export class RateLimitError extends Error {
  readonly code = "RATE_LIMIT" as const;
  constructor(readonly contactEmail: string) {
    super(rateLimitMessage(contactEmail));
    this.name = "RateLimitError";
  }
}

export function getClientIp(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const xf = req.headers?.["x-forwarded-for"];
  const first = Array.isArray(xf) ? xf[0] : typeof xf === "string" ? xf.split(",")[0]?.trim() : "";
  if (first) return first;
  const ri = req.headers?.["x-real-ip"];
  if (typeof ri === "string" && ri.trim()) return ri.trim();
  return req.socket?.remoteAddress || "0.0.0.0";
}

/** Call before heavy work. Throws RateLimitError when the free tier is exhausted. */
export async function assertWithinChatLimit(clientId: string | undefined, req: Parameters<typeof getClientIp>[0]): Promise<void> {
  const e = env();
  const limit = e.CHAT_FREE_USES;
  const ip = getClientIp(req);
  const key = makeRateLimitKey(e.RATE_LIMIT_PEPPER, clientId, ip);
  const used = await store.getCount(key);
  if (used >= limit) {
    throw new RateLimitError(e.CONTACT_EMAIL);
  }
}

/** Call only after a successful assistant reply is ready to return. */
export async function recordChatUse(
  clientId: string | undefined,
  req: Parameters<typeof getClientIp>[0]
): Promise<{ used: number; limit: number; remaining: number }> {
  const e = env();
  const limit = e.CHAT_FREE_USES;
  const ip = getClientIp(req);
  const key = makeRateLimitKey(e.RATE_LIMIT_PEPPER, clientId, ip);
  const used = await store.incrementCount(key);
  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining };
}
