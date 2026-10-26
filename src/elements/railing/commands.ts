// Commands on guardrails. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Railing } from './schema';

export const addRailing = (railing: Railing): Command<Doc> => ({
  label: 'cmd.addRailing',
  apply: (doc) => ({ ...doc, railings: [...doc.railings, railing] }),
});

export type RailingPatch = { readonly height?: number; readonly baseOffset?: number };

export const updateRailings = (ids: readonly string[], patch: RailingPatch): Command<Doc> => ({
  label: 'cmd.updateRailing',
  apply: (doc) => {
    if (patch.height !== undefined && !(Number.isFinite(patch.height) && patch.height > 0)) return doc;
    if (patch.baseOffset !== undefined && !Number.isFinite(patch.baseOffset)) return doc;
    let changed = false;
    const railings = doc.railings.map((r) => {
      if (!ids.includes(r.id)) return r;
      const next = { ...r, ...patch };
      if (JSON.stringify(next) === JSON.stringify(r)) return r;
      changed = true;
      return next;
    });
    return changed ? { ...doc, railings } : doc;
  },
});
