# Postgres analytics (self-hosted)

Track **language switches**, **chat opens**, **chat messages**, **rate limits**, and **errors** in one PostgreSQL database.

## Quick start (local)

```bash
cd eagles-rag-bot
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY, DATABASE_URL, STATS_SECRET

npm run db:up          # Docker Postgres on localhost:5432
npm run db:migrate     # creates analytics_events table

npm run dev
```

Health check: `curl http://localhost:3000/health` → `"analytics":{"database":true,"connected":true}`

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | For analytics | `postgresql://user:pass@host:5432/dbname` |
| `STATS_SECRET` | For `/api/stats` | Header `x-stats-secret` for reporting API |

Without `DATABASE_URL`, the bot still works; analytics calls return 503 and are skipped server-side.

## Events recorded

| `event_type` | Source |
|--------------|--------|
| `language_switch` | Squarespace header switcher → `POST /api/event` |
| `chat_open` | Widget when user opens chat |
| `chat_message` | Server after successful `/api/chat` |
| `chat_rate_limited` | Server on 429 |
| `chat_error` | Server on 500 |

Full chat text is **not** stored — only `message_length` and counts in metadata.

## API

### `POST /api/event`

```json
{
  "eventType": "language_switch",
  "locale": "es",
  "clientId": "optional-uuid",
  "pagePath": "/programs-es",
  "metadata": { "suffix": "-es" }
}
```

### `GET /api/stats?days=30`

Header: `x-stats-secret: YOUR_STATS_SECRET`

Returns totals and daily counts grouped by `event_type` and `locale`.

## Squarespace

1. Point widget `data-api-base` at **your server** (not Vercel) when using Postgres on the same host.
2. Patch the language switcher using `squarespace-lang-switcher-analytics-patch.js`.

## Production server

1. Install Postgres (or use Neon/Supabase with `DATABASE_URL` pointing to cloud).
2. Run `npm run db:migrate` once per deploy/environment.
3. Run `npm run dev` or `node .dev-server.mjs` behind nginx/Caddy with SSL.
4. Set `STATS_SECRET` and query stats from your machine:

```bash
curl -s -H "x-stats-secret: $STATS_SECRET" \
  "https://api.yourdomain.com/api/stats?days=7" | jq
```

## SQL examples

```sql
-- Chats today by language
SELECT locale, COUNT(*) FROM analytics_events
WHERE event_type = 'chat_message' AND created_at >= CURRENT_DATE
GROUP BY locale;

-- Language switches this week
SELECT COUNT(*) FROM analytics_events
WHERE event_type = 'language_switch'
  AND created_at >= NOW() - INTERVAL '7 days';
```
