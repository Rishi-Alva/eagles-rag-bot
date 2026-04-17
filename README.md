# Eagles RAG Bot (Squarespace) — Claude Sonnet + citations

This project indexes the Orlando Eagles Squarespace website (+ linked PDFs) into a local search index, then answers user questions conversationally with **clickable sources**.

## What’s included

- `api/chat.ts`: chat endpoint (retrieval + Claude Sonnet answer + sources)
- `api/reindex.ts`: protected reindex endpoint
- `src/reindex.ts`: local CLI reindex script
- `public/eagles-widget.js`: drop-in widget you can inject into Squarespace
- `squarespace-footer-snippet.html`: **canonical copy-paste** embed for Squarespace (same options as the local demo, with production URLs)

## Setup

1. Create a file `.env` (copy from `.env.example`) and fill values.
2. Install deps:

```bash
npm install
```

3. Run a local reindex (builds a local search index file):

```bash
npm run reindex
```

4. Run locally:

```bash
npm run dev
```

## API

### `POST /api/chat`
Body:

```json
{
  "message": "What is the Challenge program?",
  "clientId": "opaque-id-from-widget-optional"
}
```

The widget sends a stable `clientId` (localStorage) so usage can be capped per browser. If omitted or too short, limiting falls back to IP (noisier on shared networks).

Response (200):
- `answer`: conversational text prefixed with `Eagles Assistant:` (no duplicate URL list; links are in `sources` for the widget)
- `sources`: structured list of URLs/titles used
- `rateLimit`: `{ used, limit, remaining }` after each successful reply

**429** when the free tier is exhausted (`CHAT_FREE_USES` in `.env`, default 5): JSON includes `error` (user-facing message with contact email) and `code: "RATE_LIMIT"`.

### `POST /api/reindex`
Header:
- `x-reindex-secret: <REINDEX_SECRET>`

## Squarespace install (Code Injection)

**Use the checked-in file** [`squarespace-footer-snippet.html`](./squarespace-footer-snippet.html): open it, copy the `<script>…</script>` block (not the HTML comments if Squarespace strips them), replace `YOUR-DEPLOYMENT-DOMAIN` everywhere, and paste into **Settings → Advanced → Code Injection → Footer**.

Or paste the same block manually:

```html
<script
  src="https://YOUR-DEPLOYMENT-DOMAIN/eagles-widget.js"
  data-api-base="https://YOUR-DEPLOYMENT-DOMAIN"
  data-title="Eagles Assistant"
  data-position="right"
  data-demo="auto"
  data-logo="https://YOUR-DEPLOYMENT-DOMAIN/orlando-eagles-logo.png"
  defer
></script>
```

Replace `YOUR-DEPLOYMENT-DOMAIN` with your deployed API host (Vercel/custom domain). The logo file is `public/orlando-eagles-logo.png` → served as `/orlando-eagles-logo.png`. The snippet sets `data-logo` explicitly so the crest always loads from your API host (same fix as `public/demo.html` locally). You can omit `data-logo` if the script and PNG are on the same origin; the widget resolves `{origin}/orlando-eagles-logo.png` from the script URL.

When the API is live and paid, set `data-demo="off"` if you want to hide demo fallbacks when the API errors (optional).

**Default colors** match the Orlando Eagles crest: navy `#00213D`, cyan `#63C9D6`, white `#FFFFFF`. Override with `data-primary`, `data-accent`, `data-surface`, `data-text`, `data-muted` if needed.

## Notes

- The API supports CORS so Squarespace can call it.
- By design, the assistant answers only from retrieved sources; if it can’t find support, it falls back to the contact email/address.
- Local development uses `npm run dev` (no `vercel dev` required).
- **Demo mode**: if the API is unreachable (or `data-api-base` is missing) and `data-demo` is `auto`/`on`, the widget will show placeholder answers so you can preview the UI before connecting a paid API.

## Try the widget in the browser (full chat)

1. Configure `.env` (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, etc.) and run `npm run reindex` once.
2. Start the server: `npm run dev`
3. Open **`http://localhost:3000/demo`** — click **Chat**, type a question, **Send**. The demo page uses `data-api-base="http://localhost:3000"` so the widget calls your local `/api/chat`.

If the API errors (billing, wrong model), the widget still responds using **demo** fallback text.

## Widget-only local preview (no API required)

Run:

```bash
npm run dev
```

Then open:
- `http://localhost:3000/demo` (with API connected = real answers; without = demo fallback)

