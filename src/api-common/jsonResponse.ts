import { setCors } from "./cors.js";

export function jsonResponse(req: any, res: any, status: number, body: unknown, corsHeaders?: string) {
  setCors(req, res, corsHeaders);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
