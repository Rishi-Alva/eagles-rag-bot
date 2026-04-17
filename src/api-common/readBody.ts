/** Normalize Vercel + raw Node bodies into a parsed object. */
export async function readBodyAny(req: any): Promise<unknown> {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    const t = req.body.trim();
    return t ? JSON.parse(t) : {};
  }
  return await readJson(req);
}

async function readJson(req: any): Promise<unknown> {
  const raw = await new Promise<string>((resolve, reject) => {
    const parts: Buffer[] = [];
    req.on("data", (chunk: unknown) => {
      try {
        if (Buffer.isBuffer(chunk)) parts.push(chunk);
        else if (typeof chunk === "string") parts.push(Buffer.from(chunk, "utf8"));
        else if (chunk && typeof chunk === "object") parts.push(Buffer.from(JSON.stringify(chunk), "utf8"));
        else parts.push(Buffer.from(String(chunk ?? ""), "utf8"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });

  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Request body is not valid JSON. First 120 chars: ${JSON.stringify(trimmed.slice(0, 120))}`);
  }
}
