import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import chatHandler from "../api/chat.js";
import reindexHandler from "../api/reindex.js";
import eventHandler from "../api/event.js";
import statsHandler from "../api/stats.js";
import { pingDatabase } from "./analytics/log.js";
import { isDatabaseConfigured } from "./db/pool.js";
import { envLoadDiagnostics } from "./env.js";

const port = Number(process.env.PORT || 3000);

function send(res: http.ServerResponse, status: number, headers: Record<string, string>, body?: string | Buffer) {
  res.writeHead(status, headers);
  res.end(body);
}

function notFound(res: http.ServerResponse) {
  send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "Not found");
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const parts: Buffer[] = [];
    req.on("data", (c: any) => {
      if (Buffer.isBuffer(c)) parts.push(c);
      else if (typeof c === "string") parts.push(Buffer.from(c, "utf8"));
      else if (c && typeof c === "object") parts.push(Buffer.from(JSON.stringify(c), "utf8"));
      else parts.push(Buffer.from(String(c ?? ""), "utf8"));
    });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      const dbConfigured = isDatabaseConfigured();
      const dbOk = dbConfigured ? await pingDatabase() : false;
      return send(
        res,
        200,
        { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        JSON.stringify({
          ok: true,
          ts: new Date().toISOString(),
          devServer: "v3",
          analytics: { database: dbConfigured, connected: dbOk },
        })
      );
    }

    // Local-only: why ANTHROPIC_API_KEY might be missing (no secret values returned)
    if (req.method === "GET" && url.pathname === "/api/env-status") {
      const host = (req.headers.host || "").split(":")[0] || "";
      if (host !== "localhost" && host !== "127.0.0.1") return notFound(res);
      return send(res, 200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, JSON.stringify(envLoadDiagnostics()));
    }

    // Static widget
    if (req.method === "GET" && (url.pathname === "/eagles-widget.js" || url.pathname === "/public/eagles-widget.js")) {
      const p = resolve(process.cwd(), "public", "eagles-widget.js");
      const js = await readFile(p);
      return send(res, 200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" }, js);
    }
    if (req.method === "GET" && (url.pathname === "/orlando-eagles-logo.png" || url.pathname === "/public/orlando-eagles-logo.png")) {
      const p = resolve(process.cwd(), "public", "orlando-eagles-logo.png");
      const png = await readFile(p);
      return send(res, 200, { "content-type": "image/png", "cache-control": "public, max-age=86400" }, png);
    }
    if (req.method === "GET" && (url.pathname === "/demo" || url.pathname === "/demo.html")) {
      const p = resolve(process.cwd(), "public", "demo.html");
      const html = await readFile(p);
      return send(res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, html);
    }
    if (req.method === "GET" && (url.pathname === "/demo-themed" || url.pathname === "/demo-themed.html")) {
      const p = resolve(process.cwd(), "public", "demo-themed.html");
      const html = await readFile(p);
      return send(res, 200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, html);
    }

    // API routes
    if (url.pathname === "/api/chat") {
      // Make local dev behave like serverless environments where req.body is already parsed.
      if (req.method === "POST" && !("body" in (req as any))) {
        const raw = (await readBody(req)).trim();
        try {
          (req as any).body = raw ? JSON.parse(raw) : {};
        } catch (e: any) {
          // eslint-disable-next-line no-console
          console.error("[dev] failed to JSON.parse raw body:", raw.slice(0, 300));
          return send(res, 400, { "content-type": "application/json; charset=utf-8" }, JSON.stringify({ error: `Bad JSON body`, rawPreview: raw.slice(0, 300) }));
        }
      }
      // eslint-disable-next-line no-console
      console.log("[dev] /api/chat body type:", typeof (req as any).body);
      return await (chatHandler as any)(req, res);
    }
    if (url.pathname === "/api/reindex") {
      if (req.method === "POST" && !("body" in (req as any))) {
        const raw = (await readBody(req)).trim();
        (req as any).body = raw ? JSON.parse(raw) : {};
      }
      return await (reindexHandler as any)(req, res);
    }
    if (url.pathname === "/api/event") {
      if (req.method === "POST" && !("body" in (req as any))) {
        const raw = (await readBody(req)).trim();
        try {
          (req as any).body = raw ? JSON.parse(raw) : {};
        } catch {
          return send(res, 400, { "content-type": "application/json; charset=utf-8" }, JSON.stringify({ error: "Bad JSON body" }));
        }
      }
      return await (eventHandler as any)(req, res);
    }
    if (url.pathname === "/api/stats") {
      return await (statsHandler as any)(req, res);
    }

    return notFound(res);
  } catch (e: any) {
    return send(res, 500, { "content-type": "text/plain; charset=utf-8" }, e?.message || "Server error");
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Dev server running on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Widget: http://localhost:${port}/eagles-widget.js`);
});

