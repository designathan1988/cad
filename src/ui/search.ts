// Finding entries by name, for the command palette: case and accents ignored, every word of the query
// must match. A label that starts with a word ranks first, then a word of it that starts with it, then
// anywhere in it, then the keywords, then the letters of one word in order with gaps; a label that
// starts with the whole query above them all.

export interface Searchable {
  readonly label: string;
  /** Other words that find the entry (the other language's name, synonyms), never shown. */
  readonly keywords?: string;
}

export const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

function score(label: string, keywords: string, word: string): number {
  if (label.startsWith(word)) return 4;
  if (label.split(/[\s:/·-]+/).some((w) => w.startsWith(word))) return 3;
  if (label.includes(word)) return 2;
  if (keywords.split(/\s+/).some((w) => w.startsWith(word))) return 1.5;
  if (keywords.includes(word)) return 1;
  // Letters in order with gaps, inside one word: across words almost anything would match a long label.
  const inOrder = (w: string) => {
    let i = 0;
    for (const ch of w) if (ch === word[i]) i++;
    return i === word.length;
  };
  return label.split(/[\s:/·-]+/).some(inOrder) ? 0.5 : 0;
}

export function searchEntries<T extends Searchable>(entries: readonly T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return [...entries];
  return entries
    .map((e, order) => {
      const label = fold(e.label);
      const keywords = fold(e.keywords ?? '');
      const scores = words.map((w) => score(label, keywords, w));
      // The whole query the start of the name ("mostrar paredes", Show walls) beats its words found apart
      // in a longer one (Show or hide the reference line of all walls), which came first in the list.
      const phrase = words.length > 1 && label.startsWith(words.join(' ')) ? 2 : 0;
      return { e, order, total: scores.every((s) => s > 0) ? scores.reduce((a, b) => a + b, 0) + phrase : 0 };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total || a.order - b.order)
    .map((x) => x.e);
}
