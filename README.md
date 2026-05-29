# Orlando Eagles RAG Chatbot

A retrieval-augmented (RAG) chat assistant for the [Orlando Eagles Soccer](https://www.orlandoeaglessoccer.com) Squarespace site. It answers parent questions from indexed site content (and PDFs), cites sources, supports English/Spanish URLs, and can log usage to **PostgreSQL** when self-hosted.

---

## What’s in this repo

| Piece | Description |
|--------|-------------|
| `api/chat.ts` | Chat API — search index + Claude answer + rate limits |
| `api/event.ts` | Analytics events (language switch, chat open) → Postgres |
| `api/stats.ts` | Protected usage summary (`STATS_SECRET`) |
| `api/reindex.ts` | Refresh search index from sitemap |
| `public/eagles-widget.js` | Embeddable chat widget for Squarespace |
| `data/eagles-index.json` | Pre-built search index (run `npm run reindex` to refresh) |
| `db/schema.sql` | Postgres analytics table |
| `docker-compose.yml` | Local Postgres for development |

---

## What to do next (checklist)

Use this as your roadmap. You can deploy on **Vercel** (simplest) or your **own server** (full Postgres analytics).

### Phase 1 — Get it running locally

- [ ] **1.** Clone this repo and install dependencies  
  ```bash
  git clone https://github.com/Rishi-Alva/eagles-rag-bot.git
  cd eagles-rag-bot
  npm install
  ```
- [ ] **2.** Copy env file and add your Anthropic key  
  ```bash
  cp .env.example .env
  ```  
  Edit `.env`: set `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com).
- [ ] **3.** (Optional) Start Postgres for analytics  
  ```bash
  npm run db:up
  npm run db:migrate
  ```  
  Add to `.env`: `DATABASE_URL=postgresql://eagles:eagles@localhost:5432/eagles_analytics` and `STATS_SECRET=some-long-random-string`.
- [ ] **4.** Run the dev server  
  ```bash
  npm run dev
  ```
- [ ] **5.** Open **http://localhost:3000/demo** — click **Chat** and ask e.g. *“Where are you located?”*

### Phase 2 — Deploy the API

Pick **one** path:

#### Option A — Vercel (easiest, no Postgres required)

- [ ] Create a project at [vercel.com](https://vercel.com) linked to this repo  
- [ ] Framework: **Other** — leave Build Command and Output Directory **empty**  
- [ ] Add environment variables from `.env.example` (at minimum `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `INDEX_PATH=data/eagles-index.json`)  
- [ ] Deploy → note your URL, e.g. `https://eagles-rag-bot.vercel.app`  
- [ ] Test:  
  ```bash
  curl -X POST https://YOUR-URL.vercel.app/api/chat \
    -H 'Content-Type: application/json' \
    -d '{"message":"What is Challenge?","clientId":"test-001"}'
  ```

**Note:** Without `DATABASE_URL`, analytics endpoints return 503; chat still works. For Postgres on Vercel, use [Neon](https://neon.tech) or [Supabase](https://supabase.com) and set `DATABASE_URL`.

#### Option B — Your own server (recommended for Postgres analytics)

- [ ] Provision a VPS (DigitalOcean, Hetzner, etc.) or use Railway/Render  
- [ ] Install Node 20+, Postgres, and clone this repo on the server  
- [ ] Set `.env` (see `.env.example`) including `DATABASE_URL` and `STATS_SECRET`  
- [ ] Run `npm run db:migrate` once  
- [ ] Run with PM2: `pm2 start "npm run dev" --name eagles-bot` (or `node .dev-server.mjs`)  
- [ ] Put nginx/Caddy in front with SSL, e.g. `https://api.orlandoeaglessoccer.com`  
- [ ] See **[docs/POSTGRES-ANALYTICS.md](./docs/POSTGRES-ANALYTICS.md)** for event types and SQL examples  

### Phase 3 — Add to Squarespace

Requires Squarespace **Business** (or higher) for site-wide Code Injection.

- [ ] **Footer** — paste from [`squarespace-footer-snippet.html`](./squarespace-footer-snippet.html)  
  - Replace the host with your deployed API URL (Vercel or your server)  
  - Set `data-free-uses` to match `CHAT_FREE_USES` in env (e.g. `10`)  
  - Set `data-demo="off"` for production  
- [ ] **Header** (language switcher + analytics) — paste from [`squarespace-header-lang-switcher-analytics.html`](./squarespace-header-lang-switcher-analytics.html)  
  - Set `EAGLES_API_BASE` to the **same** API URL as the widget  
- [ ] Save and test on **https://www.orlandoeaglessoccer.com**

### Phase 4 — Maintain

- [ ] When the Eagles site changes, refresh the index:  
  ```bash
  npm run reindex
  git add data/eagles-index.json && git commit -m "Refresh search index" && git push
  ```  
  (Vercel redeploys automatically; on your server, restart after pull.)  
- [ ] View chat stats (self-hosted + Postgres):  
  ```bash
  curl -H "x-stats-secret: YOUR_STATS_SECRET" \
    "https://YOUR-API/api/stats?days=30"
  ```
- [ ] Remote reindex (optional): `POST /api/reindex` with header `x-reindex-secret`

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes (chat) | Claude API key |
| `ANTHROPIC_MODEL` | Recommended | e.g. `claude-sonnet-4-20250514` |
| `SITE_SITEMAP_URL` | For reindex | Eagles sitemap |
| `CONTACT_EMAIL` | Recommended | Shown when limit hit |
| `CONTACT_ADDRESS` | Recommended | Fallback contact |
| `CHAT_FREE_USES` | Optional | Free replies per browser (default `5`) |
| `RATE_LIMIT_PEPPER` | Optional | Change to reset rate-limit counts |
| `INDEX_PATH` | Optional | Default `data/eagles-index.json` |
| `REINDEX_SECRET` | For `/api/reindex` | Protects reindex endpoint |
| `DATABASE_URL` | For analytics | Postgres connection string |
| `STATS_SECRET` | For `/api/stats` | Reporting API auth |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local server on port 3000 |
| `npm run reindex` | Crawl site → rebuild `data/eagles-index.json` |
| `npm run db:up` | Start Docker Postgres |
| `npm run db:migrate` | Create analytics tables |
| `npm run typecheck` | TypeScript check |

---

## API overview

### `POST /api/chat`

```json
{
  "message": "What is the Challenge program?",
  "clientId": "stable-browser-id",
  "locale": "en",
  "pagePath": "/challenge"
}
```

### `POST /api/event` (Postgres required)

```json
{
  "eventType": "language_switch",
  "locale": "es",
  "pagePath": "/programs-es"
}
```

Event types: `language_switch`, `chat_open`, `chat_message`, `chat_rate_limited`, `chat_error`.

### `GET /api/stats?days=30`

Header: `x-stats-secret: YOUR_STATS_SECRET`

---

## Squarespace files

| File | Where to paste |
|------|----------------|
| [`squarespace-footer-snippet.html`](./squarespace-footer-snippet.html) | Code Injection → **Footer** |
| [`squarespace-header-lang-switcher-analytics.html`](./squarespace-header-lang-switcher-analytics.html) | Code Injection → **Header** |

---

## Architecture

```
Squarespace (orlandoeaglessoccer.com)
    ├── Header: language switcher → POST /api/event
    └── Footer: eagles-widget.js → POST /api/chat
              ↓
        Your API (Vercel or VPS)
              ├── MiniSearch index (eagles-index.json)
              ├── Anthropic Claude (answers)
              └── PostgreSQL (analytics_events) [optional]
```

---

## Docs

- **[docs/POSTGRES-ANALYTICS.md](./docs/POSTGRES-ANALYTICS.md)** — Database setup, SQL queries, self-hosting

---

## License

Private / org use for Orlando Eagles Soccer. Adjust as needed for your deployment.
