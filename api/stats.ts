import { z } from "zod";
import { fetchStats, pingDatabase } from "../src/analytics/log.js";
import { isDatabaseConfigured } from "../src/db/pool.js";
import { jsonResponse } from "../src/api-common/jsonResponse.js";

const CORS_HEADERS = "content-type, x-stats-secret";

function checkSecret(req: any): boolean {
  const expected = process.env.STATS_SECRET?.trim() || "";
  if (!expected) return false;
  const header = (req.headers?.["x-stats-secret"] || req.headers?.["X-Stats-Secret"] || "") as string;
  return header === expected;
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return jsonResponse(req, res, 204, {}, CORS_HEADERS);
  if (req.method !== "GET") return jsonResponse(req, res, 405, { error: "Method not allowed" }, CORS_HEADERS);

  if (!checkSecret(req)) {
    return jsonResponse(req, res, 401, { error: "Unauthorized" }, CORS_HEADERS);
  }

  if (!isDatabaseConfigured()) {
    return jsonResponse(req, res, 503, { error: "DATABASE_URL is not configured" }, CORS_HEADERS);
  }

  try {
    const url = new URL(req.url || "/", `http://${req.headers?.host || "localhost"}`);
    const daysRaw = url.searchParams.get("days") || "30";
    const days = z.coerce.number().int().min(1).max(365).parse(daysRaw);

    const dbOk = await pingDatabase();
    if (!dbOk) {
      return jsonResponse(req, res, 503, { error: "Database connection failed" }, CORS_HEADERS);
    }

    const summary = await fetchStats(days);
    return jsonResponse(req, res, 200, { ok: true, ...summary }, CORS_HEADERS);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse(req, res, 500, { error: msg }, CORS_HEADERS);
  }
}
