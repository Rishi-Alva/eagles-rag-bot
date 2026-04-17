import { request } from "undici";

export async function fetchText(url: string, init?: { timeoutMs?: number; headers?: Record<string, string> }) {
  const timeoutMs = init?.timeoutMs ?? 30_000;
  const headers = {
    "user-agent": "eagles-rag-bot/1.0 (+indexer; contact=info@orlandoeaglessoccer.com)",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ...init?.headers,
  };

  const res = await request(url, { method: "GET", headers, bodyTimeout: timeoutMs, headersTimeout: timeoutMs });
  const body = await res.body.text();
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Fetch failed ${res.statusCode} ${url}\n${body.slice(0, 500)}`);
  }
  return body;
}

export async function fetchBuffer(url: string, init?: { timeoutMs?: number; headers?: Record<string, string> }) {
  const timeoutMs = init?.timeoutMs ?? 60_000;
  const headers = {
    "user-agent": "eagles-rag-bot/1.0 (+indexer; contact=info@orlandoeaglessoccer.com)",
    accept: "*/*",
    ...init?.headers,
  };

  const res = await request(url, { method: "GET", headers, bodyTimeout: timeoutMs, headersTimeout: timeoutMs });
  const arr = await res.body.arrayBuffer();
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Fetch failed ${res.statusCode} ${url}`);
  }
  return Buffer.from(arr);
}

