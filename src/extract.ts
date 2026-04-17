import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";

export function htmlToText(html: string, url: string): { title: string; text: string } {
  const vc = new VirtualConsole();
  // Squarespace pages sometimes reference CSS that JSDOM can't parse; ignore those warnings.
  vc.on("jsdomError", () => {});
  const dom = new JSDOM(html, { url, virtualConsole: vc });
  const doc = dom.window.document;

  // Drop obvious boilerplate
  for (const sel of ["nav", "header", "footer", "script", "style", "noscript", "svg", "form"]) {
    doc.querySelectorAll(sel).forEach((n: Element) => n.remove());
  }

  const reader = new Readability(doc);
  const article = reader.parse();

  const title = (article?.title || doc.title || "").trim();
  const text = (article?.textContent || doc.body?.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text };
}

export function isProbablyPdfUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const vc = new VirtualConsole();
  vc.on("jsdomError", () => {});
  const dom = new JSDOM(html, { url: baseUrl, virtualConsole: vc });
  const doc = dom.window.document;
  const out = new Set<string>();
  doc.querySelectorAll("a[href]").forEach((a: Element) => {
    const href = a.getAttribute("href") || "";
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      out.add(abs);
    } catch {
      // ignore
    }
  });
  return [...out];
}

