// Commands on curtain walls. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import { type Curtain, type GridRule, isGridRule } from './schema';

export const addCurtain = (c: Curtain): Command<Doc> => ({
  label: 'cmd.addCurtain',
  apply: (doc) => ({ ...doc, curtains: [...doc.curtains, c] }),
});

export type CurtainPatch = {
  readonly baseOffset?: number;
  readonly height?: number;
  readonly vertical?: GridRule;
  readonly horizontal?: GridRule;
  readonly mullion?: number;
  readonly depth?: number;
  readonly panel?: 'glass' | 'opaque';
};

/** Whether a patch's values are ones a curtain wall may take. */
const validPatch = (patch: CurtainPatch): boolean =>
  ![patch.height, patch.mullion, patch.depth].some((v) => v !== undefined && !(Number.isFinite(v) && v > 0)) &&
  (patch.baseOffset === undefined || Number.isFinite(patch.baseOffset)) &&
  ![patch.vertical, patch.horizontal].some((r) => r !== undefined && !isGridRule(r));

/** The same patch on each, or one worked out from each (its own division kept, say). One bad patch: no change. */
export const updateCurtains = (ids: readonly string[], patchOf: CurtainPatch | ((c: Curtain) => CurtainPatch)): Command<Doc> => ({
  label: 'cmd.updateCurtain',
  apply: (doc) => {
    const patches = new Map(doc.curtains.filter((c) => ids.includes(c.id)).map((c) => [c.id, typeof patchOf === 'function' ? patchOf(c) : patchOf]));
    if ([...patches.values()].some((p) => !validPatch(p))) return doc;
    let changed = false;
    const curtains = doc.curtains.map((c) => {
      const patch = patches.get(c.id);
      if (!patch) return c;
      const next = { ...c, ...patch };
      if (JSON.stringify(next) === JSON.stringify(c)) return c;
      changed = true;
      return next;
    });
    return changed ? { ...doc, curtains } : doc;
  },
});
