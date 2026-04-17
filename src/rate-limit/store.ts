import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** One JSON file; path works on local dev and Vercel (`/tmp` is writable). */
const STORE_FILE =
  process.env.EAGLES_RATE_LIMIT_FILE?.trim() || join(tmpdir(), "eagles-chat-rate-limit.json");

type Entry = { count: number; updated: number };

type Store = Record<string, Entry>;

let writeChain: Promise<void> = Promise.resolve();

function prune(store: Store, maxAgeMs: number) {
  const now = Date.now();
  for (const k of Object.keys(store)) {
    const e = store[k];
    if (e && now - e.updated > maxAgeMs) delete store[k];
  }
}

async function loadRaw(): Promise<Store> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Serialize writes to reduce lost updates under concurrent requests. */
function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

const PRUNE_MAX_AGE_MS = 120 * 24 * 60 * 60 * 1000; // 120 days

export async function getCount(key: string): Promise<number> {
  const store = await loadRaw();
  return store[key]?.count ?? 0;
}

export async function incrementCount(key: string): Promise<number> {
  return withWriteLock(async () => {
    const store = await loadRaw();
    prune(store, PRUNE_MAX_AGE_MS);
    const now = Date.now();
    const prev = store[key]?.count ?? 0;
    const next = prev + 1;
    store[key] = { count: next, updated: now };
    await writeFile(STORE_FILE, JSON.stringify(store), "utf8");
    return next;
  });
}
