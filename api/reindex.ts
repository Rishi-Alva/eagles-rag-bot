import { reindexEnv } from "../src/env.js";
import { reindexSite } from "../src/indexer.js";
import { copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { jsonResponse } from "../src/api-common/jsonResponse.js";

const CORS_HEADERS = "content-type, x-reindex-secret";

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return jsonResponse(req, res, 204, {}, CORS_HEADERS);
  if (req.method !== "POST") return jsonResponse(req, res, 405, { error: "Method not allowed" }, CORS_HEADERS);

  try {
    // Touch body so local dev server consumes it before passing here.
    if (typeof req.body === "string") {
      try {
        req.body = req.body.trim() ? JSON.parse(req.body) : {};
      } catch {
        // ignore
      }
    }
    // Very simple auth: require a shared secret via header.
    const secret = process.env.REINDEX_SECRET || "";
    if (!secret) return jsonResponse(req, res, 500, { error: "REINDEX_SECRET not configured" }, CORS_HEADERS);
    if ((req.headers?.["x-reindex-secret"] || "") !== secret) return jsonResponse(req, res, 401, { error: "Unauthorized" }, CORS_HEADERS);

    // Validate env early
    const e = reindexEnv();

    const stats = await reindexSite();
    // If running in a serverless environment, try to keep a copy in /tmp for this instance.
    if (e.INDEX_PATH !== "/tmp/eagles-index.json" && existsSync(e.INDEX_PATH)) {
      await copyFile(e.INDEX_PATH, "/tmp/eagles-index.json").catch(() => {});
    }
    return jsonResponse(req, res, 200, { ok: true, stats }, CORS_HEADERS);
  } catch (err: any) {
    return jsonResponse(req, res, 500, { error: err?.message ?? "Unknown error" }, CORS_HEADERS);
  }
}

