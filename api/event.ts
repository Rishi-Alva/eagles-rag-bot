import { z } from "zod";
import { isValidEventType, logEvent } from "../src/analytics/log.js";
import { isDatabaseConfigured } from "../src/db/pool.js";
import { readBodyAny } from "../src/api-common/readBody.js";
import { jsonResponse } from "../src/api-common/jsonResponse.js";

const CORS_HEADERS = "content-type";

const BodySchema = z.object({
  eventType: z.string().min(1).max(64),
  locale: z.string().max(12).optional(),
  clientId: z.string().max(200).optional(),
  pagePath: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return jsonResponse(req, res, 204, {}, CORS_HEADERS);
  if (req.method !== "POST") return jsonResponse(req, res, 405, { error: "Method not allowed" }, CORS_HEADERS);

  if (!isDatabaseConfigured()) {
    return jsonResponse(req, res, 503, { error: "Analytics database is not configured (set DATABASE_URL)" }, CORS_HEADERS);
  }

  try {
    const body = BodySchema.parse(await readBodyAny(req));
    const eventType = body.eventType.trim();

    if (!isValidEventType(eventType)) {
      return jsonResponse(req, res, 400, { error: `Invalid eventType: ${eventType}` }, CORS_HEADERS);
    }

    await logEvent({
      eventType,
      locale: body.locale,
      clientId: body.clientId,
      pagePath: body.pagePath,
      metadata: body.metadata,
    });

    return jsonResponse(req, res, 200, { ok: true }, CORS_HEADERS);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const msg = err.issues[0]?.message || "Invalid request body";
      return jsonResponse(req, res, 400, { error: msg }, CORS_HEADERS);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse(req, res, 500, { error: msg }, CORS_HEADERS);
  }
}
