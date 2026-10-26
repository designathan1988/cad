// Commands on stairs. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Stair, StairKind } from './schema';

export const addStair = (stair: Stair): Command<Doc> => ({
  label: 'cmd.addStair',
  apply: (doc) => ({ ...doc, stairs: [...doc.stairs, stair] }),
});

export type StairPatch = {
  readonly kind?: StairKind;
  readonly width?: number;
  readonly tread?: number;
  readonly turn?: 'left' | 'right';
  readonly height?: number;
  readonly railing?: boolean;
  readonly grade?: number;
};

export const updateStairs = (ids: readonly string[], patch: StairPatch): Command<Doc> => ({
  label: 'cmd.updateStair',
  apply: (doc) => {
    if ([patch.width, patch.tread, patch.height, patch.grade].some((v) => v !== undefined && !(Number.isFinite(v) && v > 0))) return doc;
    let changed = false;
    const stairs = doc.stairs.map((s) => {
      if (!ids.includes(s.id)) return s;
      const next = { ...s, ...patch };
      if (JSON.stringify(next) === JSON.stringify(s)) return s;
      changed = true;
      return next;
    });
    return changed ? { ...doc, stairs } : doc;
  },
});
