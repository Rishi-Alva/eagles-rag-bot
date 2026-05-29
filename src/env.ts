import { config as loadEnv, parse as parseEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Folder with `package.json` — works for `src/*.ts` and for a bundle emitted next to `package.json` (e.g. `.dev-server.mjs`). */
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 14; i++) {
    if (existsSync(resolve(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir, "..");
}

// Load `.env` next to `package.json`, not from `resolve(__dirname,"..")` (breaks when the bundle’s `__dirname` is already the package root).
const ENV_FILE = resolve(findPackageRoot(__dirname), ".env");
const ENV_FILE_CWD = resolve(process.cwd(), ".env");

function mergeParsedEnvFile(path: string) {
  if (!existsSync(path)) return;
  let raw = readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const parsed = parseEnv(raw);
  for (const [k, v] of Object.entries(parsed)) {
    process.env[k] = v;
  }
}

// `override: true` — otherwise an empty ANTHROPIC_API_KEY already in the environment (shell / other dotenv) blocks the real value from .env
loadEnv({ path: ENV_FILE, override: true });
if (ENV_FILE_CWD !== ENV_FILE) {
  loadEnv({ path: ENV_FILE_CWD, override: true });
}

// Second pass: raw read + BOM strip (variable names must not start with \uFEFF)
mergeParsedEnvFile(ENV_FILE);
if (ENV_FILE_CWD !== ENV_FILE) mergeParsedEnvFile(ENV_FILE_CWD);

/** Used by `npm run reindex` and `/api/reindex` — does not need Anthropic. */
const ReindexEnvSchema = z.object({
  SITE_SITEMAP_URL: z.string().url().default("https://www.orlandoeaglessoccer.com/sitemap.xml"),
  INDEX_PATH: z.string().min(1).default("data/eagles-index.json"),
});

const EnvSchema = ReindexEnvSchema.extend({
  // LLM (answering) — only required for /api/chat
  ANTHROPIC_API_KEY: z.string().min(1),
  // Dated snapshots are stable; `-latest` aliases are often removed. See https://docs.anthropic.com/en/docs/about-claude/models
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-20250514"),

  SITE_BASE_URL: z.string().url().default("https://www.orlandoeaglessoccer.com"),

  CONTACT_EMAIL: z.string().email().default("info@orlandoeaglessoccer.com"),
  CONTACT_ADDRESS: z.string().min(1).default("1395 Campus View Ct, Oviedo, FL 32765"),

  /** Successful chat replies per browser/client id before the limit message (server-enforced). */
  CHAT_FREE_USES: z.coerce.number().int().min(1).max(1000).default(5),
  /** Salt for hashing client keys in the rate-limit store (change if counts should reset). */
  RATE_LIMIT_PEPPER: z.string().min(8).default("orlando-eagles-rate-v1"),
});

export type ReindexEnv = z.infer<typeof ReindexEnvSchema>;
export type Env = z.infer<typeof EnvSchema>;

let cachedReindex: ReindexEnv | null = null;
let cached: Env | null = null;

export function reindexEnv(): ReindexEnv {
  if (cachedReindex) return cachedReindex;
  const parsed = ReindexEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${msg}`);
  }
  cachedReindex = parsed.data;
  return cachedReindex;
}

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${msg}`);
  }
  cached = parsed.data;
  return cached;
}

function listParsedKeysFromFile(path: string): string[] {
  if (!existsSync(path)) return [];
  let raw = readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return Object.keys(parseEnv(raw)).sort();
}

/** Local debugging only — no secret values, only paths, key length, and .env key *names*. */
export function envLoadDiagnostics() {
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
    expectedKeyName: "ANTHROPIC_API_KEY",
  };
}

