// What the project browser lists about the document (pure).

import type { Doc } from './document';

/** Every wall type, with how many walls use it (0 for an unused one), on one level or on all. */
export function typeUsage(doc: Doc, levelId?: string): Map<string, number> {
  const usage = new Map(doc.wallTypes.map((t) => [t.id, 0]));
  for (const w of doc.walls) {
    if (levelId !== undefined && w.levelId !== levelId) continue;
    if (usage.has(w.wallTypeId)) usage.set(w.wallTypeId, usage.get(w.wallTypeId)! + 1);
  }
  return usage;
}
