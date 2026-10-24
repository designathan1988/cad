// Commands on levels. A wall's heights come from its level, so changing a level's elevation or height
// moves every wall on it without touching the walls.

import type { Doc, Level, LevelId } from '../../app/document';
import type { Command } from '../../core/store';

/** A new level on top of the highest one, with that one's height. */
export const addLevel = (id: LevelId, name: string): Command<Doc> => ({
  label: 'cmd.addLevel',
  apply: (doc) => {
    const top = [...doc.levels].sort((a, b) => b.elevation + b.height - (a.elevation + a.height))[0]!;
    return { ...doc, levels: [...doc.levels, { id, name, elevation: top.elevation + top.height, height: top.height }] };
  },
});

/** Name, elevation or height. A blank name or a height of zero or less changes nothing. */
export const updateLevel = (id: LevelId, patch: Partial<Omit<Level, 'id'>>): Command<Doc> => ({
  label: 'cmd.updateLevel',
  apply: (doc) => {
    if (patch.name !== undefined && patch.name.trim() === '') return doc;
    if (patch.height !== undefined && !(patch.height > 0)) return doc;
    if (patch.elevation !== undefined && !Number.isFinite(patch.elevation)) return doc;
    let changed = false;
    const levels = doc.levels.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) };
      if (JSON.stringify(next) === JSON.stringify(l)) return l;
      changed = true;
      return next;
    });
    return changed ? { ...doc, levels } : doc;
  },
});

/** Why a level cannot be deleted: it is the last one, or walls stand on it. Null when it can be. */
export function deleteBlocker(doc: Doc, id: LevelId): 'last' | 'walls' | 'missing' | null {
  if (!doc.levels.some((l) => l.id === id)) return 'missing';
  if (doc.levels.length <= 1) return 'last';
  return doc.walls.some((w) => w.levelId === id) ? 'walls' : null;
}

export const canDeleteLevel = (doc: Doc, id: LevelId): boolean => deleteBlocker(doc, id) === null;

/** Levels whose floor-to-floor height reaches above the floor of the next level up, and by how much. */
export function levelOverlaps(doc: Doc): { levelId: LevelId; aboveId: LevelId; by: number }[] {
  const sorted = [...doc.levels].sort((a, b) => a.elevation - b.elevation);
  return sorted.flatMap((l, i) => {
    const above = sorted[i + 1];
    const by = above ? l.elevation + l.height - above.elevation : 0;
    return above && by > 1e-9 ? [{ levelId: l.id, aboveId: above.id, by }] : [];
  });
}

export const deleteLevel = (id: LevelId): Command<Doc> => ({
  label: 'cmd.deleteLevel',
  apply: (doc) => (canDeleteLevel(doc, id) ? { ...doc, levels: doc.levels.filter((l) => l.id !== id) } : doc),
});
