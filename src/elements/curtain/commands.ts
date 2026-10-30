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

export const updateCurtains = (ids: readonly string[], patch: CurtainPatch): Command<Doc> => ({
  label: 'cmd.updateCurtain',
  apply: (doc) => {
    if ([patch.height, patch.mullion, patch.depth].some((v) => v !== undefined && !(Number.isFinite(v) && v > 0))) return doc;
    if (patch.baseOffset !== undefined && !Number.isFinite(patch.baseOffset)) return doc;
    if ([patch.vertical, patch.horizontal].some((r) => r !== undefined && !isGridRule(r))) return doc;
    let changed = false;
    const curtains = doc.curtains.map((c) => {
      if (!ids.includes(c.id)) return c;
      const next = { ...c, ...patch };
      if (JSON.stringify(next) === JSON.stringify(c)) return c;
      changed = true;
      return next;
    });
    return changed ? { ...doc, curtains } : doc;
  },
});
