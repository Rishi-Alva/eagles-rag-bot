/** Shared CORS for Vercel-style `req` / `res` handlers. */
export function setCors(req: any, res: any, allowHeaders = "content-type") {
  const origin = req.headers?.origin || "*";
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", allowHeaders);
  res.setHeader("access-control-max-age", "86400");
}
