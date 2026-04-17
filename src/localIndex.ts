import MiniSearch, { type SearchResult } from "minisearch";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type IndexedDoc = {
  id: string;
  sourceUrl: string;
  title: string;
  content: string;
};

export type LocalIndexFile = {
  version: 1;
  miniSearchJson: any;
  builtAt: string;
};

const miniSearchOptions = {
  fields: ["title", "content"],
  storeFields: ["sourceUrl", "title", "content"],
  searchOptions: {
    boost: { title: 2 },
    fuzzy: 0.2,
    prefix: true,
  },
};

export function buildIndex(docs: IndexedDoc[]) {
  const ms = new MiniSearch(miniSearchOptions);
  ms.addAll(docs);
  return ms;
}

export async function saveIndex(params: { index: MiniSearch; path: string }) {
  await mkdir(dirname(params.path), { recursive: true });
  const payload: LocalIndexFile = {
    version: 1,
    miniSearchJson: params.index.toJSON(),
    builtAt: new Date().toISOString(),
  };
  await writeFile(params.path, JSON.stringify(payload), "utf8");
}

export async function loadIndex(params: { path: string }): Promise<MiniSearch> {
  const raw = await readFile(params.path, "utf8");
  let parsed: LocalIndexFile;
  try {
    parsed = JSON.parse(raw) as LocalIndexFile;
  } catch (e: any) {
    throw new Error(`Index file is not valid JSON at ${params.path}. First 120 chars: ${JSON.stringify(raw.slice(0, 120))}`);
  }
  if (parsed.version !== 1) throw new Error(`Unsupported index version: ${String((parsed as any).version)}`);
  // MiniSearch.loadJSON expects a JSON string in some builds; stringify to be safe.
  const msJson = typeof parsed.miniSearchJson === "string" ? parsed.miniSearchJson : JSON.stringify(parsed.miniSearchJson);
  return MiniSearch.loadJSON(msJson, miniSearchOptions);
}

export type LocalSearchHit = {
  sourceUrl: string;
  title: string;
  snippet: string;
  score: number;
};

export function searchIndex(params: { index: MiniSearch; query: string; topK: number }): LocalSearchHit[] {
  const results = params.index.search(params.query, { boost: { title: 2 } }) as SearchResult[];
  return results.slice(0, params.topK).map((r: any) => ({
    sourceUrl: r.sourceUrl,
    title: r.title,
    snippet: String(r.content || "").slice(0, 900),
    score: typeof r.score === "number" ? r.score : 0,
  }));
}

