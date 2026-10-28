// Commands on levels. A wall's heights come from its level, so changing a level's elevation or height
// moves every wall on it without touching the walls.

import { type Doc, type Level, type LevelId, levelOf, NO_LEVEL, wallHeights } from '../../app/document';
import type { Command } from '../../core/store';
import { elementsOnLevel } from '../registry';

/** A new level on top of the highest one, with that one's height and cut height. */
export const addLevel = (id: LevelId, name: string): Command<Doc> => ({
  label: 'cmd.addLevel',
  apply: (doc) => {
    const top = [...doc.levels].sort((a, b) => b.elevation + b.height - (a.elevation + a.height))[0]!;
    const level = { id, name, elevation: top.elevation + top.height, height: top.height, ...(top.cutHeight !== undefined ? { cutHeight: top.cutHeight } : {}) };
    return { ...doc, levels: [...doc.levels, level] };
  },
});

/** Name, elevation, height or cut height. A blank name, or a height or cut height of zero or less, changes nothing. */
export const updateLevel = (id: LevelId, patch: Partial<Omit<Level, 'id'>>): Command<Doc> => ({
  label: 'cmd.updateLevel',
  apply: (doc) => {
    if (patch.name !== undefined && patch.name.trim() === '') return doc;
    if (patch.height !== undefined && !(patch.height > 0)) return doc;
    if (patch.cutHeight !== undefined && !(patch.cutHeight > 0 && Number.isFinite(patch.cutHeight))) return doc;
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

/**
 * Why a level cannot be deleted: it is the last one, walls stand on it, or other elements do (a floor,
 * furniture, a note: deleted with it they were left in the file on no level, never shown again). Null
 * when it can be.
 */
export function deleteBlocker(doc: Doc, id: LevelId): 'last' | 'walls' | 'elements' | 'missing' | null {
  if (!doc.levels.some((l) => l.id === id)) return 'missing';
  if (doc.levels.length <= 1) return 'last';
  if (doc.walls.some((w) => w.levelId === id)) return 'walls';
  return elementsOnLevel(doc, id) > 0 ? 'elements' : null;
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
  apply: (doc) => {
    if (!canDeleteLevel(doc, id)) return doc;
    // A wall that went up to it keeps its height, now fixed: its top had nothing left to follow.
    const walls = doc.walls.map((w) => {
      if (w.top?.kind !== 'toLevel' || w.top.levelId !== id) return w;
      const h = wallHeights(doc, w);
      return { ...w, top: { kind: 'fixed' as const, height: h.top - h.bottom } };
    });
    // A column that went up to it keeps its top where it was, now from its own level's top.
    const gone = doc.levels.find((l) => l.id === id)!;
    const columns = doc.columns.map((c) => {
      if (c.topLevelId !== id) return c;
      const own = levelOf(doc, c.levelId) ?? NO_LEVEL;
      const { topLevelId: _gone, ...rest } = c;
      return { ...rest, topOffset: gone.elevation + (c.topOffset ?? 0) - (own.elevation + own.height) };
    });
    return { ...doc, levels: doc.levels.filter((l) => l.id !== id), walls, columns };
  },
});
