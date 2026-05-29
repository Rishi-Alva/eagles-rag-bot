import { getPool, isDatabaseConfigured } from "../db/pool.js";
import type { AnalyticsEventType, LogEventInput, StatsSummary } from "./types.js";

function trimMeta(meta: LogEventInput["metadata"]): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined) continue;
    const key = k.slice(0, 64);
    if (typeof v === "string") out[key] = v.slice(0, 500);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[key] = v;
  }
  return out;
}

/** Insert one analytics row. Never throws — failures are logged only. */
export async function logEvent(input: LogEventInput): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const pool = getPool();
  if (!pool) return;

  const locale = input.locale?.trim().slice(0, 12) || null;
  const clientId = input.clientId?.trim().slice(0, 200) || null;
  const pagePath = input.pagePath?.trim().slice(0, 500) || null;
  const metadata = JSON.stringify(trimMeta(input.metadata));

  try {
    await pool.query(
      `INSERT INTO analytics_events (event_type, locale, client_id, page_path, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [input.eventType, locale, clientId, pagePath, metadata]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(`[analytics] logEvent(${input.eventType}) failed:`, msg);
  }
}

/** Fire-and-forget wrapper for request handlers. */
export function logEventAsync(input: LogEventInput): void {
  void logEvent(input);
}

export function isValidEventType(t: string): t is AnalyticsEventType {
  return (
    t === "language_switch" ||
    t === "chat_open" ||
    t === "chat_message" ||
    t === "chat_rate_limited" ||
    t === "chat_error"
  );
}

export async function fetchStats(days = 30): Promise<StatsSummary> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured");

  const safeDays = Math.min(Math.max(1, Math.floor(days)), 365);

  const totals = await pool.query<{ event_type: string; locale: string | null; count: string }>(
    `SELECT event_type, locale, COUNT(*)::text AS count
     FROM analytics_events
     WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
     GROUP BY event_type, locale
     ORDER BY count DESC`,
    [safeDays]
  );

  const daily = await pool.query<{ day: string; event_type: string; count: string }>(
    `SELECT DATE(created_at AT TIME ZONE 'UTC')::text AS day, event_type, COUNT(*)::text AS count
     FROM analytics_events
     WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
     GROUP BY day, event_type
     ORDER BY day DESC, event_type`,
    [safeDays]
  );

  const since = new Date(Date.now() - safeDays * 86400_000).toISOString();

  return {
    since,
    days: safeDays,
    totals: totals.rows.map((r) => ({
      event_type: r.event_type,
      locale: r.locale,
      count: Number(r.count),
    })),
    daily: daily.rows.map((r) => ({
      day: r.day,
      event_type: r.event_type,
      count: Number(r.count),
    })),
  };
}

export async function pingDatabase(): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
