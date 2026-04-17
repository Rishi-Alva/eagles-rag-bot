import pLimit from "p-limit";
import { reindexEnv } from "./env.js";
import { fetchBuffer, fetchText } from "./http.js";
import { chunkText } from "./chunk.js";
import { extractLinks, htmlToText, isProbablyPdfUrl } from "./extract.js";
import { pdfBufferToText } from "./pdf.js";
import { readSitemapUrls } from "./sitemap.js";
import { buildIndex, type IndexedDoc, saveIndex } from "./localIndex.js";
import { isAbsolute, resolve } from "node:path";

type IndexedStats = {
  pages: number;
  pdfs: number;
  chunks: number;
};

function uniq<T>(arr: T[]) {
  return [...new Set(arr)];
}

function keepUrl(url: string) {
  // Avoid indexing admin/login, mailto, tel, etc.
  const lower = url.toLowerCase();
  if (lower.startsWith("mailto:") || lower.startsWith("tel:")) return false;
  if (lower.includes("/config") || lower.includes("/api")) return false;
  return true;
}

export async function reindexSite(): Promise<IndexedStats> {
  const e = reindexEnv();
  const limit = pLimit(6);

  const urls = (await readSitemapUrls(e.SITE_SITEMAP_URL)).filter(keepUrl);
  const pageUrls = urls.filter((u) => !isProbablyPdfUrl(u));

  const discoveredPdfLinks: string[] = [];

  let pages = 0;
  let pdfs = 0;
  let chunks = 0;
  const docs: IndexedDoc[] = [];

  // Index HTML pages
  await Promise.all(
    pageUrls.map((url) =>
      limit(async () => {
        try {
          const html = await fetchText(url);
          const { title, text } = htmlToText(html, url);
          const links = extractLinks(html, url).filter(isProbablyPdfUrl).filter(keepUrl);
          discoveredPdfLinks.push(...links);

          const pageChunks = chunkText({ sourceUrl: url, title, text });
          if (pageChunks.length === 0) return;

          docs.push(
            ...pageChunks.map((c) => ({
              id: `page_${c.id}`,
              sourceUrl: c.sourceUrl,
              title: c.title,
              content: c.content,
            }))
          );
          pages += 1;
          chunks += pageChunks.length;
        } catch (err: any) {
          // eslint-disable-next-line no-console
          console.warn(`[reindex] skipping page (fetch/parse failed): ${url}\n${err?.message ?? err}`);
          return;
        }
      })
    )
  );

  // Index PDFs (from sitemap or discovered links)
  const pdfUrls = uniq([...urls.filter(isProbablyPdfUrl), ...discoveredPdfLinks]).filter(keepUrl);
  await Promise.all(
    pdfUrls.map((url) =>
      limit(async () => {
        try {
          const buf = await fetchBuffer(url);
          const text = await pdfBufferToText(buf);
          const title = url.split("/").pop() || "PDF";
          const pdfChunks = chunkText({ sourceUrl: url, title, text, maxChars: 1600, overlapChars: 200 });
          if (pdfChunks.length === 0) return;

          docs.push(
            ...pdfChunks.map((c) => ({
              id: `pdf_${c.id}`,
              sourceUrl: c.sourceUrl,
              title: c.title,
              content: c.content,
            }))
          );
          pdfs += 1;
          chunks += pdfChunks.length;
        } catch (err: any) {
          // eslint-disable-next-line no-console
          console.warn(`[reindex] skipping pdf (fetch/parse failed): ${url}\n${err?.message ?? err}`);
          return;
        }
      })
    )
  );

  const idx = buildIndex(docs);
  const indexPath = isAbsolute(e.INDEX_PATH) ? e.INDEX_PATH : resolve(process.cwd(), e.INDEX_PATH);
  await saveIndex({ index: idx, path: indexPath });

  return { pages, pdfs, chunks };
}

