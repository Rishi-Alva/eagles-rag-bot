export async function pdfBufferToText(buf: Buffer): Promise<string> {
  const mod = await import("pdf-parse");
  const pdf = (mod as any).default ?? mod;
  const data = await pdf(buf);
  const text = (data.text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

