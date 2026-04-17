export type Chunk = {
  id: string;
  sourceUrl: string;
  title: string;
  content: string;
};

function stableId(input: string) {
  // Simple stable hash (non-crypto) for IDs
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function chunkText(params: {
  sourceUrl: string;
  title: string;
  text: string;
  maxChars?: number;
  overlapChars?: number;
}): Chunk[] {
  const maxChars = params.maxChars ?? 1400;
  const overlapChars = params.overlapChars ?? 150;
  const cleaned = params.text.trim();
  if (!cleaned) return [];

  const chunks: Chunk[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(cleaned.length, i + maxChars);
    let slice = cleaned.slice(i, end);

    // Try to cut at a paragraph boundary if possible
    if (end < cleaned.length) {
      const lastBreak = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
      if (lastBreak > Math.floor(maxChars * 0.6)) {
        slice = slice.slice(0, lastBreak + 1).trimEnd();
      }
    }

    const content = slice.trim();
    if (content.length >= 200) {
      const id = stableId(`${params.sourceUrl}::${params.title}::${content.slice(0, 200)}::${i}`);
      chunks.push({
        id,
        sourceUrl: params.sourceUrl,
        title: params.title,
        content,
      });
    }

    const next = i + Math.max(1, slice.length - overlapChars);
    if (next <= i) break;
    i = next;
  }

  return chunks;
}

