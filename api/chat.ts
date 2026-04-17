import { z } from "zod";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { env } from "../src/env.js";
import { generateAnswer } from "../src/answer.js";
import { loadIndex, searchIndex } from "../src/localIndex.js";
import { readBodyAny } from "../src/api-common/readBody.js";
import { jsonResponse } from "../src/api-common/jsonResponse.js";
import { RateLimitError, assertWithinChatLimit, recordChatUse } from "../src/rate-limit/check.js";

const BodySchema = z.object({
  message: z.string().min(1),
  /** Opaque id from the widget (e.g. random UUID). Short or missing values fall back to IP-based limiting. */
  clientId: z.string().max(200).optional(),
});

type LoadedIndex = Awaited<ReturnType<typeof loadIndex>>;
let cachedIndex: { path: string; index: LoadedIndex } | null = null;
async function loadIndexCached(path: string): Promise<LoadedIndex> {
  if (cachedIndex && cachedIndex.path === path) return cachedIndex.index;
  const index = await loadIndex({ path });
  cachedIndex = { path, index };
  return index;
}

function pickIndexPath(configured: string) {
  if (existsSync(configured)) return configured;
  const tmp = "/tmp/eagles-index.json";
  if (existsSync(tmp)) return tmp;
  return configured;
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return jsonResponse(req, res, 204, {});
  if (req.method !== "POST") return jsonResponse(req, res, 405, { error: "Method not allowed" });

  try {
    const bodyInput = await readBodyAny(req);
    const body = BodySchema.parse(bodyInput);
    const q = body.message.trim();
    const rawId = body.clientId?.trim();
    const clientId = rawId && rawId.length >= 8 ? rawId : undefined;

    await assertWithinChatLimit(clientId, req);

    const e = env();
    const configuredPath = isAbsolute(e.INDEX_PATH) ? e.INDEX_PATH : resolve(process.cwd(), e.INDEX_PATH);
    const indexPath = pickIndexPath(configuredPath);
    let idx;
    try {
      idx = await loadIndexCached(indexPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse(req, res, 500, {
        error: `Failed to load local index at ${indexPath}. Did you run 'npm run reindex'?\n${msg}`,
      });
    }
    const hits = searchIndex({ index: idx, query: q, topK: 4 });
    const sources = hits.filter((h) => h.sourceUrl && h.score > 0.2);

    const { answer } = await generateAnswer({ userMessage: q, sources });

    const rateLimit = await recordChatUse(clientId, req);

    return jsonResponse(req, res, 200, {
      answer,
      sources: sources.map((s) => ({ url: s.sourceUrl, title: s.title, score: s.score })),
      contact: { email: e.CONTACT_EMAIL, address: e.CONTACT_ADDRESS },
      rateLimit,
    });
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return jsonResponse(req, res, 429, {
        error: err.message,
        code: err.code,
        contact: { email: err.contactEmail },
      });
    }
    if (err instanceof z.ZodError) {
      const msg = err.issues[0]?.message || "Invalid request body";
      return jsonResponse(req, res, 400, { error: msg });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse(req, res, 500, { error: msg });
  }
}
