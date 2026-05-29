// src/devServer.ts
import http from "node:http";
import { readFile as readFile3 } from "node:fs/promises";
import { resolve as resolve4 } from "node:path";

// api/chat.ts
import { z as z2 } from "zod";
import { existsSync as existsSync2 } from "node:fs";
import { isAbsolute, resolve as resolve2 } from "node:path";

// src/env.ts
import { config as loadEnv, parse as parseEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
var __dirname = dirname(fileURLToPath(import.meta.url));
function findPackageRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 14; i++) {
    if (existsSync(resolve(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir, "..");
}
var ENV_FILE = resolve(findPackageRoot(__dirname), ".env");
var ENV_FILE_CWD = resolve(process.cwd(), ".env");
function mergeParsedEnvFile(path) {
  if (!existsSync(path)) return;
  let raw = readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 65279) raw = raw.slice(1);
  const parsed = parseEnv(raw);
  for (const [k, v] of Object.entries(parsed)) {
    process.env[k] = v;
  }
}
loadEnv({ path: ENV_FILE, override: true });
if (ENV_FILE_CWD !== ENV_FILE) {
  loadEnv({ path: ENV_FILE_CWD, override: true });
}
mergeParsedEnvFile(ENV_FILE);
if (ENV_FILE_CWD !== ENV_FILE) mergeParsedEnvFile(ENV_FILE_CWD);
var ReindexEnvSchema = z.object({
  SITE_SITEMAP_URL: z.string().url().default("https://www.orlandoeaglessoccer.com/sitemap.xml"),
  INDEX_PATH: z.string().min(1).default("data/eagles-index.json")
});
var EnvSchema = ReindexEnvSchema.extend({
  // LLM (answering) — only required for /api/chat
  ANTHROPIC_API_KEY: z.string().min(1),
  // Dated snapshots are stable; `-latest` aliases are often removed. See https://docs.anthropic.com/en/docs/about-claude/models
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-20250514"),
  SITE_BASE_URL: z.string().url().default("https://www.orlandoeaglessoccer.com"),
  CONTACT_EMAIL: z.string().email().default("info@orlandoeaglessoccer.com"),
  CONTACT_ADDRESS: z.string().min(1).default("1395 Campus View Ct, Oviedo, FL 32765"),
  /** Successful chat replies per browser/client id before the limit message (server-enforced). */
  CHAT_FREE_USES: z.coerce.number().int().min(1).max(1e3).default(5),
  /** Salt for hashing client keys in the rate-limit store (change if counts should reset). */
  RATE_LIMIT_PEPPER: z.string().min(8).default("orlando-eagles-rate-v1")
});
var cachedReindex = null;
var cached = null;
function reindexEnv() {
  if (cachedReindex) return cachedReindex;
  const parsed = ReindexEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:
${msg}`);
  }
  cachedReindex = parsed.data;
  return cachedReindex;
}
function env() {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:
${msg}`);
  }
  cached = parsed.data;
  return cached;
}
function listParsedKeysFromFile(path) {
  if (!existsSync(path)) return [];
  let raw = readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 65279) raw = raw.slice(1);
  return Object.keys(parseEnv(raw)).sort();
}
function envLoadDiagnostics() {
  const k = process.env.ANTHROPIC_API_KEY;
  const keys = listParsedKeysFromFile(ENV_FILE);
  const anthropicLike = keys.filter((n) => n.toUpperCase().includes("ANTHROP"));
  return {
    cwd: process.cwd(),
    envFileNextToPackageJson: ENV_FILE,
    envFileNextToPackageJsonExists: existsSync(ENV_FILE),
    envFileCwd: ENV_FILE_CWD,
    envFileCwdExists: existsSync(ENV_FILE_CWD),
    anthropicKeyLength: k ? k.length : 0,
    anthropicKeyLooksSet: Boolean(k && String(k).trim().length > 0),
    /** Names only — use to spot typos (e.g. ANTHROPIC_APIKE) or a missing line. */
    dotEnvKeyNames: keys,
    dotEnvKeysMatchingAnthropic: anthropicLike,
    expectedKeyName: "ANTHROPIC_API_KEY"
  };
}

// src/answer.ts
import Anthropic from "@anthropic-ai/sdk";
var client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return client;
}
async function generateAnswer(params) {
  const e = env();
  const sourcesText = params.sources.length === 0 ? "(no sources retrieved)" : params.sources.map(
    (s, i) => `SOURCE ${i + 1}
URL: ${s.sourceUrl}
TITLE: ${s.title}
EXCERPT:
${s.snippet}
`
  ).join("\n");
  const system = `You are "Eagles Assistant" \u2014 you speak for Orlando Eagles Soccer like a friendly staff member at the field, not a corporate help desk or FAQ bot. Parents should feel welcomed and understood; this is a youth soccer org with a faith-based, community-first heart.

Voice and tone:
- Sound human: warm, direct, a little enthusiasm is good. Short openers help ("Happy to help you get your kid on the field!", "Great question!", "We'd love to have your child join us!" \u2014 use when they fit naturally, not every time).
- Lead with connection or enthusiasm when it fits, then the practical details \u2014 don't jump straight into bullet-like facts without acknowledging what they're trying to do.
- Speak as part of the team: say "we" and "us" for Orlando Eagles. Never sound like a third party describing "them" or "the organization."
- When the excerpts support it, weave in mission-aligned language naturally: community, growth, confidence, opportunity \u2014 don't force every word every time.

Say this, not that (avoid robotic / ticket-system phrasing):
- Avoid "According to the information available" or similar \u2014 just state the fact directly (e.g. "We have locations at\u2026" or start with the answer).
- Avoid "I couldn't find [X] in the Eagles resources" \u2014 instead use something like "I don't have all the details on that just yet" and then what to do next.
- Avoid "For complete sign-up instructions" \u2014 prefer "To get the full picture" or plain direct language.
- Avoid "I'd recommend contacting them directly" \u2014 say "Reach out to us at ${e.CONTACT_EMAIL} and we'll get you set up" (or similar). You may mention the office: ${e.CONTACT_ADDRESS}.

Accuracy (non-negotiable):
- Use ONLY the provided reference excerpts for factual claims. Do not invent schedules, prices, policies, or contacts.
- If excerpts don't cover something, be warm and honest: you don't have every detail yet, then invite them to email us \u2014 don't blame "the website" in a cold way.

Output format (exactly one prefix line, then your reply):
Eagles Assistant: <your reply \u2014 no bullet lists of URLs; links appear separately in the chat UI>

Do not add a "Sources" section, URL lists, or markdown link lists in your reply.`;
  const msg = await anthropic().messages.create({
    model: e.ANTHROPIC_MODEL,
    max_tokens: 500,
    temperature: 0.32,
    system,
    messages: [
      { role: "user", content: `User question:
${params.userMessage}

Reference excerpts:
${sourcesText}` }
    ]
  });
  let text = msg.content.map((b) => b.type === "text" ? b.text : "").join("").trim();
  text = text.replace(/\n\n*Sources?:[\s\S]*$/i, "").trim();
  text = text.replace(/\n\n*[-•]\s*https?:\/\/[^\s]+\s*(\n[-•]\s*https?:\/\/[^\s]+\s*)*$/i, "").trim();
  if (/^Answer:\s*/i.test(text)) {
    text = text.replace(/^Answer:\s*/i, "Eagles Assistant: ");
  }
  if (text.length > 0 && !/^Eagles Assistant:/i.test(text)) {
    text = `Eagles Assistant: ${text}`;
  }
  return { answer: text };
}

// src/localIndex.ts
import MiniSearch from "minisearch";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname as dirname2 } from "node:path";
var miniSearchOptions = {
  fields: ["title", "content"],
  storeFields: ["sourceUrl", "title", "content"],
  searchOptions: {
    boost: { title: 2 },
    fuzzy: 0.2,
    prefix: true
  }
};
function buildIndex(docs) {
  const ms = new MiniSearch(miniSearchOptions);
  ms.addAll(docs);
  return ms;
}
async function saveIndex(params) {
  await mkdir(dirname2(params.path), { recursive: true });
  const payload = {
    version: 1,
    miniSearchJson: params.index.toJSON(),
    builtAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await writeFile(params.path, JSON.stringify(payload), "utf8");
}
async function loadIndex(params) {
  const raw = await readFile(params.path, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Index file is not valid JSON at ${params.path}. First 120 chars: ${JSON.stringify(raw.slice(0, 120))}`);
  }
  if (parsed.version !== 1) throw new Error(`Unsupported index version: ${String(parsed.version)}`);
  const msJson = typeof parsed.miniSearchJson === "string" ? parsed.miniSearchJson : JSON.stringify(parsed.miniSearchJson);
  return MiniSearch.loadJSON(msJson, miniSearchOptions);
}
function searchIndex(params) {
  const results = params.index.search(params.query, { boost: { title: 2 } });
  return results.slice(0, params.topK).map((r) => ({
    sourceUrl: r.sourceUrl,
    title: r.title,
    snippet: String(r.content || "").slice(0, 900),
    score: typeof r.score === "number" ? r.score : 0
  }));
}

// src/api-common/readBody.ts
async function readBodyAny(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    const t = req.body.trim();
    return t ? JSON.parse(t) : {};
  }
  return await readJson(req);
}
async function readJson(req) {
  const raw = await new Promise((resolve5, reject) => {
    const parts = [];
    req.on("data", (chunk) => {
      try {
        if (Buffer.isBuffer(chunk)) parts.push(chunk);
        else if (typeof chunk === "string") parts.push(Buffer.from(chunk, "utf8"));
        else if (chunk && typeof chunk === "object") parts.push(Buffer.from(JSON.stringify(chunk), "utf8"));
        else parts.push(Buffer.from(String(chunk ?? ""), "utf8"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("end", () => resolve5(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Request body is not valid JSON. First 120 chars: ${JSON.stringify(trimmed.slice(0, 120))}`);
  }
}

// src/api-common/cors.ts
function setCors(req, res, allowHeaders = "content-type") {
  const origin = req.headers?.origin || "*";
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", allowHeaders);
  res.setHeader("access-control-max-age", "86400");
}

// src/api-common/jsonResponse.ts
function jsonResponse(req, res, status, body, corsHeaders) {
  setCors(req, res, corsHeaders);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

// src/rate-limit/config.ts
function rateLimitMessage(contactEmail) {
  return `Eagles Assistant: You've reached the limit for this bot. Please contact ${contactEmail} for more uses.`;
}

// src/rate-limit/store.ts
import { readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
var STORE_FILE = process.env.EAGLES_RATE_LIMIT_FILE?.trim() || join(tmpdir(), "eagles-chat-rate-limit.json");
var writeChain = Promise.resolve();
function prune(store, maxAgeMs) {
  const now = Date.now();
  for (const k of Object.keys(store)) {
    const e = store[k];
    if (e && now - e.updated > maxAgeMs) delete store[k];
  }
}
async function loadRaw() {
  try {
    const raw = await readFile2(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function withWriteLock(fn) {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => {
    },
    () => {
    }
  );
  return run;
}
var PRUNE_MAX_AGE_MS = 120 * 24 * 60 * 60 * 1e3;
async function getCount(key) {
  const store = await loadRaw();
  return store[key]?.count ?? 0;
}
async function incrementCount(key) {
  return withWriteLock(async () => {
    const store = await loadRaw();
    prune(store, PRUNE_MAX_AGE_MS);
    const now = Date.now();
    const prev = store[key]?.count ?? 0;
    const next = prev + 1;
    store[key] = { count: next, updated: now };
    await writeFile2(STORE_FILE, JSON.stringify(store), "utf8");
    return next;
  });
}

// src/rate-limit/key.ts
import { createHash } from "node:crypto";
function makeRateLimitKey(pepper, clientId, ipFallback) {
  const raw = (clientId && clientId.trim().length >= 8 ? clientId.trim() : `ip:${ipFallback}`) + "|" + pepper;
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

// src/rate-limit/check.ts
var RateLimitError = class extends Error {
  constructor(contactEmail) {
    super(rateLimitMessage(contactEmail));
    this.contactEmail = contactEmail;
    this.name = "RateLimitError";
  }
  contactEmail;
  code = "RATE_LIMIT";
};
function getClientIp(req) {
  const xf = req.headers?.["x-forwarded-for"];
  const first = Array.isArray(xf) ? xf[0] : typeof xf === "string" ? xf.split(",")[0]?.trim() : "";
  if (first) return first;
  const ri = req.headers?.["x-real-ip"];
  if (typeof ri === "string" && ri.trim()) return ri.trim();
  return req.socket?.remoteAddress || "0.0.0.0";
}
async function assertWithinChatLimit(clientId, req) {
  const e = env();
  const limit = e.CHAT_FREE_USES;
  const ip = getClientIp(req);
  const key = makeRateLimitKey(e.RATE_LIMIT_PEPPER, clientId, ip);
  const used = await getCount(key);
  if (used >= limit) {
    throw new RateLimitError(e.CONTACT_EMAIL);
  }
}
async function recordChatUse(clientId, req) {
  const e = env();
  const limit = e.CHAT_FREE_USES;
  const ip = getClientIp(req);
  const key = makeRateLimitKey(e.RATE_LIMIT_PEPPER, clientId, ip);
  const used = await incrementCount(key);
  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining };
}

// api/chat.ts
var BodySchema = z2.object({
  message: z2.string().min(1),
  /** Opaque id from the widget (e.g. random UUID). Short or missing values fall back to IP-based limiting. */
  clientId: z2.string().max(200).optional()
});
var cachedIndex = null;
async function loadIndexCached(path) {
  if (cachedIndex && cachedIndex.path === path) return cachedIndex.index;
  const index = await loadIndex({ path });
  cachedIndex = { path, index };
  return index;
}
function pickIndexPath(configured) {
  if (existsSync2(configured)) return configured;
  const tmp = "/tmp/eagles-index.json";
  if (existsSync2(tmp)) return tmp;
  return configured;
}
function formatServerError(err) {
  if (!(err instanceof Error)) return String(err);
  const parts = [err.message];
  let c = err.cause;
  for (let depth = 0; depth < 5 && c instanceof Error; depth++) {
    parts.push(c.message);
    c = c.cause;
  }
  const s = parts.filter(Boolean).join(" \u2014 ");
  return s.length > 800 ? `${s.slice(0, 797)}\u2026` : s;
}
async function handler(req, res) {
  if (req.method === "OPTIONS") return jsonResponse(req, res, 204, {});
  if (req.method !== "POST") return jsonResponse(req, res, 405, { error: "Method not allowed" });
  try {
    const bodyInput = await readBodyAny(req);
    const body = BodySchema.parse(bodyInput);
    const q = body.message.trim();
    const rawId = body.clientId?.trim();
    const clientId = rawId && rawId.length >= 8 ? rawId : void 0;
    await assertWithinChatLimit(clientId, req);
    const e = env();
    const configuredPath = isAbsolute(e.INDEX_PATH) ? e.INDEX_PATH : resolve2(process.cwd(), e.INDEX_PATH);
    const indexPath = pickIndexPath(configuredPath);
    let idx;
    try {
      idx = await loadIndexCached(indexPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse(req, res, 500, {
        error: `Failed to load local index at ${indexPath}. Did you run 'npm run reindex'?
${msg}`
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
      rateLimit
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return jsonResponse(req, res, 429, {
        error: err.message,
        code: err.code,
        contact: { email: err.contactEmail }
      });
    }
    if (err instanceof z2.ZodError) {
      const msg2 = err.issues[0]?.message || "Invalid request body";
      return jsonResponse(req, res, 400, { error: msg2 });
    }
    const msg = formatServerError(err);
    return jsonResponse(req, res, 500, { error: msg });
  }
}

// src/indexer.ts
import pLimit from "p-limit";

// src/http.ts
import { request } from "undici";
async function fetchText(url, init) {
  const timeoutMs = init?.timeoutMs ?? 3e4;
  const headers = {
    "user-agent": "eagles-rag-bot/1.0 (+indexer; contact=info@orlandoeaglessoccer.com)",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ...init?.headers
  };
  const res = await request(url, { method: "GET", headers, bodyTimeout: timeoutMs, headersTimeout: timeoutMs });
  const body = await res.body.text();
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Fetch failed ${res.statusCode} ${url}
${body.slice(0, 500)}`);
  }
  return body;
}
async function fetchBuffer(url, init) {
  const timeoutMs = init?.timeoutMs ?? 6e4;
  const headers = {
    "user-agent": "eagles-rag-bot/1.0 (+indexer; contact=info@orlandoeaglessoccer.com)",
    accept: "*/*",
    ...init?.headers
  };
  const res = await request(url, { method: "GET", headers, bodyTimeout: timeoutMs, headersTimeout: timeoutMs });
  const arr = await res.body.arrayBuffer();
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Fetch failed ${res.statusCode} ${url}`);
  }
  return Buffer.from(arr);
}

// src/chunk.ts
function stableId(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
function chunkText(params) {
  const maxChars = params.maxChars ?? 1400;
  const overlapChars = params.overlapChars ?? 150;
  const cleaned = params.text.trim();
  if (!cleaned) return [];
  const chunks = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(cleaned.length, i + maxChars);
    let slice = cleaned.slice(i, end);
    if (end < cleaned.length) {
      const lastBreak = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
      if (lastBreak > Math.floor(maxChars * 0.6)) {
        slice = slice.slice(0, lastBreak + 1).trimEnd();
      }
    }
    const content = slice.trim();
    if (content.length >= 200) {
      const id = stableId(`${params.sourceUrl}::${params.title}::${content.slice(0, 200)}::${i}`);
      chunks.push({
        id,
        sourceUrl: params.sourceUrl,
        title: params.title,
        content
      });
    }
    const next = i + Math.max(1, slice.length - overlapChars);
    if (next <= i) break;
    i = next;
  }
  return chunks;
}

// src/extract.ts
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
function htmlToText(html, url) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", () => {
  });
  const dom = new JSDOM(html, { url, virtualConsole: vc });
  const doc = dom.window.document;
  for (const sel of ["nav", "header", "footer", "script", "style", "noscript", "svg", "form"]) {
    doc.querySelectorAll(sel).forEach((n) => n.remove());
  }
  const reader = new Readability(doc);
  const article = reader.parse();
  const title = (article?.title || doc.title || "").trim();
  const text = (article?.textContent || doc.body?.textContent || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { title, text };
}
function isProbablyPdfUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}
function extractLinks(html, baseUrl) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", () => {
  });
  const dom = new JSDOM(html, { url: baseUrl, virtualConsole: vc });
  const doc = dom.window.document;
  const out = /* @__PURE__ */ new Set();
  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      out.add(abs);
    } catch {
    }
  });
  return [...out];
}

// src/pdf.ts
async function pdfBufferToText(buf) {
  const mod = await import("pdf-parse");
  const pdf = mod.default ?? mod;
  const data = await pdf(buf);
  const text = (data.text || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

// src/sitemap.ts
import { parseStringPromise } from "xml2js";
function normalizeUrl(url) {
  return url.trim();
}
async function readSitemapUrls(sitemapUrl) {
  const xml = await fetchText(sitemapUrl, { headers: { accept: "application/xml,text/xml,*/*" } });
  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
  if (parsed?.urlset?.url) {
    const urls = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    return urls.map((u) => typeof u.loc === "string" ? u.loc : u.loc?._).filter(Boolean).map(normalizeUrl);
  }
  if (parsed?.sitemapindex?.sitemap) {
    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap) ? parsed.sitemapindex.sitemap : [parsed.sitemapindex.sitemap];
    const sitemapUrls = sitemaps.map((s) => typeof s.loc === "string" ? s.loc : s.loc?._).filter(Boolean).map(normalizeUrl);
    const nested = await Promise.all(sitemapUrls.map((u) => readSitemapUrls(u)));
    return nested.flat();
  }
  throw new Error(`Unrecognized sitemap format: ${sitemapUrl}`);
}

// src/indexer.ts
import { isAbsolute as isAbsolute2, resolve as resolve3 } from "node:path";
function uniq(arr) {
  return [...new Set(arr)];
}
function keepUrl(url) {
  const lower = url.toLowerCase();
  if (lower.startsWith("mailto:") || lower.startsWith("tel:")) return false;
  if (lower.includes("/config") || lower.includes("/api")) return false;
  return true;
}
async function reindexSite() {
  const e = reindexEnv();
  const limit = pLimit(6);
  const urls = (await readSitemapUrls(e.SITE_SITEMAP_URL)).filter(keepUrl);
  const pageUrls = urls.filter((u) => !isProbablyPdfUrl(u));
  const discoveredPdfLinks = [];
  let pages = 0;
  let pdfs = 0;
  let chunks = 0;
  const docs = [];
  await Promise.all(
    pageUrls.map(
      (url) => limit(async () => {
        try {
          const html = await fetchText(url);
          const { title, text } = htmlToText(html, url);
          const links = extractLinks(html, url).filter(isProbablyPdfUrl).filter(keepUrl);
          discoveredPdfLinks.push(...links);
          const pageChunks = chunkText({ sourceUrl: url, title, text });
          if (pageChunks.length === 0) return;
          docs.push(
            ...pageChunks.map((c) => ({
              id: `page_${c.id}`,
              sourceUrl: c.sourceUrl,
              title: c.title,
              content: c.content
            }))
          );
          pages += 1;
          chunks += pageChunks.length;
        } catch (err) {
          console.warn(`[reindex] skipping page (fetch/parse failed): ${url}
${err?.message ?? err}`);
          return;
        }
      })
    )
  );
  const pdfUrls = uniq([...urls.filter(isProbablyPdfUrl), ...discoveredPdfLinks]).filter(keepUrl);
  await Promise.all(
    pdfUrls.map(
      (url) => limit(async () => {
        try {
          const buf = await fetchBuffer(url);
          const text = await pdfBufferToText(buf);
          const title = url.split("/").pop() || "PDF";
          const pdfChunks = chunkText({ sourceUrl: url, title, text, maxChars: 1600, overlapChars: 200 });
          if (pdfChunks.length === 0) return;
          docs.push(
            ...pdfChunks.map((c) => ({
              id: `pdf_${c.id}`,
              sourceUrl: c.sourceUrl,
              title: c.title,
              content: c.content
            }))
          );
          pdfs += 1;
          chunks += pdfChunks.length;
        } catch (err) {
          console.warn(`[reindex] skipping pdf (fetch/parse failed): ${url}
${err?.message ?? err}`);
          return;
        }
      })
    )
  );
  const idx = buildIndex(docs);
  const indexPath = isAbsolute2(e.INDEX_PATH) ? e.INDEX_PATH : resolve3(process.cwd(), e.INDEX_PATH);
  await saveIndex({ index: idx, path: indexPath });
  return { pages, pdfs, chunks };
}

// api/reindex.ts
import { copyFile } from "node:fs/promises";
import { existsSync as existsSync3 } from "node:fs";
var CORS_HEADERS = "content-type, x-reindex-secret";
async function handler2(req, res) {
  if (req.method === "OPTIONS") return jsonResponse(req, res, 204, {}, CORS_HEADERS);
  if (req.method !== "POST") return jsonResponse(req, res, 405, { error: "Method not allowed" }, CORS_HEADERS);
  try {
    if (typeof req.body === "string") {
      try {
        req.body = req.body.trim() ? JSON.parse(req.body) : {};
      } catch {
      }
    }
    const secret = process.env.REINDEX_SECRET || "";
    if (!secret) return jsonResponse(req, res, 500, { error: "REINDEX_SECRET not configured" }, CORS_HEADERS);
    if ((req.headers?.["x-reindex-secret"] || "") !== secret) return jsonResponse(req, res, 401, { error: "Unauthorized" }, CORS_HEADERS);
    const e = reindexEnv();
    const stats = await reindexSite();
    if (e.INDEX_PATH !== "/tmp/eagles-index.json" && existsSync3(e.INDEX_PATH)) {
      await copyFile(e.INDEX_PATH, "/tmp/eagles-index.json").catch(() => {
      });
    }
    return jsonResponse(req, res, 200, { ok: true, stats }, CORS_HEADERS);
  } catch (err) {
    return jsonResponse(req, res, 500, { error: err?.message ?? "Unknown error" }, CORS_HEADERS);
  }
}

// src/devServer.ts
var port = Number(process.env.PORT || 3e3);
function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}
function notFound(res) {
  send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "Not found");
}
async function readBody(req) {
  return await new Promise((resolve5, reject) => {
    const parts = [];
    req.on("data", (c) => {
      if (Buffer.isBuffer(c)) parts.push(c);
      else if (typeof c === "string") parts.push(Buffer.from(c, "utf8"));
      else if (c && typeof c === "object") parts.push(Buffer.from(JSON.stringify(c), "utf8"));
      else parts.push(Buffer.from(String(c ?? ""), "utf8"));
    });
    req.on("end", () => resolve5(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}
var server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return send(
        res,
        200,
        { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        JSON.stringify({ ok: true, ts: (/* @__PURE__ */ new Date()).toISOString(), devServer: "v3" })
      );
    }
    if (req.method === "GET" && url.pathname === "/api/env-status") {
      const host = (req.headers.host || "").split(":")[0] || "";
      if (host !== "localhost" && host !== "127.0.0.1") return notFound(res);
      return send(res, 200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, JSON.stringify(envLoadDiagnostics()));
    }
    if (req.method === "GET" && (url.pathname === "/eagles-widget.js" || url.pathname === "/public/eagles-widget.js")) {
      const p = resolve4(process.cwd(), "public", "eagles-widget.js");
      const js = await readFile3(p);
      return send(res, 200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" }, js);
    }
    if (req.method === "GET" && (url.pathname === "/orlando-eagles-logo.png" || url.pathname === "/public/orlando-eagles-logo.png")) {
      const p = resolve4(process.cwd(), "public", "orlando-eagles-logo.png");
      const png = await readFile3(p);
      return send(res, 200, { "content-type": "image/png", "cache-control": "public, max-age=86400" }, png);
    }
    if (req.method === "GET" && (url.pathname === "/demo" || url.pathname === "/demo.html")) {
      const p = resolve4(process.cwd(), "public", "demo.html");
      const html = await readFile3(p);
      return send(res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, html);
    }
    if (req.method === "GET" && (url.pathname === "/demo-themed" || url.pathname === "/demo-themed.html")) {
      const p = resolve4(process.cwd(), "public", "demo-themed.html");
      const html = await readFile3(p);
      return send(res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, html);
    }
    if (url.pathname === "/api/chat") {
      if (req.method === "POST" && !("body" in req)) {
        const raw = (await readBody(req)).trim();
        try {
          req.body = raw ? JSON.parse(raw) : {};
        } catch (e) {
          console.error("[dev] failed to JSON.parse raw body:", raw.slice(0, 300));
          return send(res, 400, { "content-type": "application/json; charset=utf-8" }, JSON.stringify({ error: `Bad JSON body`, rawPreview: raw.slice(0, 300) }));
        }
      }
      console.log("[dev] /api/chat body type:", typeof req.body);
      return await handler(req, res);
    }
    if (url.pathname === "/api/reindex") {
      if (req.method === "POST" && !("body" in req)) {
        const raw = (await readBody(req)).trim();
        req.body = raw ? JSON.parse(raw) : {};
      }
      return await handler2(req, res);
    }
    return notFound(res);
  } catch (e) {
    return send(res, 500, { "content-type": "text/plain; charset=utf-8" }, e?.message || "Server error");
  }
});
server.listen(port, () => {
  console.log(`Dev server running on http://localhost:${port}`);
  console.log(`Widget: http://localhost:${port}/eagles-widget.js`);
});
