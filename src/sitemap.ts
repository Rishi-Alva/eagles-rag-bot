import { parseStringPromise } from "xml2js";
import { fetchText } from "./http.js";

function normalizeUrl(url: string) {
  return url.trim();
}

export async function readSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const xml = await fetchText(sitemapUrl, { headers: { accept: "application/xml,text/xml,*/*" } });
  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });

  // Supports either <urlset> or <sitemapindex>
  if (parsed?.urlset?.url) {
    const urls = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    return urls
      .map((u: any) => (typeof u.loc === "string" ? u.loc : u.loc?._))
      .filter(Boolean)
      .map(normalizeUrl);
  }

  if (parsed?.sitemapindex?.sitemap) {
    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap) ? parsed.sitemapindex.sitemap : [parsed.sitemapindex.sitemap];
    const sitemapUrls = sitemaps
      .map((s: any) => (typeof s.loc === "string" ? s.loc : s.loc?._))
      .filter(Boolean)
      .map(normalizeUrl);

    const nested = await Promise.all(sitemapUrls.map((u: string) => readSitemapUrls(u)));
    return nested.flat();
  }

  throw new Error(`Unrecognized sitemap format: ${sitemapUrl}`);
}

