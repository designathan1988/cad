// Commands on references. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import { isPlacement, isReference, type Reference } from './schema';

export const addReference = (r: Reference): Command<Doc> => ({
  label: 'cmd.addReference',
  apply: (doc) => (!isReference(r) ? doc : { ...doc, references: [...doc.references, r] }),
});

/**
 * Its opacity, turn, scale or place; what would not be a reference changes nothing. Only those fields are
 * checked and compared: the picture or drawing is not touched, and serialising it (a scanned plan is
 * megabytes of data URL) at every step of a drag or a slider made tracing over it stutter.
 */
export const updateReferences = (ids: readonly string[], patch: Partial<Pick<Reference, 'opacity' | 'angle' | 'scale' | 'at'>>, label = 'cmd.updateReference'): Command<Doc> => ({
  label,
  apply: (doc) => {
    let changed = false;
    const references = doc.references.map((r) => {
      if (!ids.includes(r.id)) return r;
      const next = { ...r, ...patch };
      const same = next.opacity === r.opacity && next.angle === r.angle && next.scale === r.scale && next.at.x === r.at.x && next.at.y === r.at.y;
      if (same || !isPlacement(next as unknown as Record<string, unknown>)) return r;
      changed = true;
      return next;
    });
    return changed ? { ...doc, references } : doc;
  },
});

/** One reference as it is now (calibrated). */
export const setReference = (r: Reference, label = 'cmd.calibrateReference'): Command<Doc> => ({
  label,
  apply: (doc) => (!isReference(r) || !doc.references.some((x) => x.id === r.id) ? doc : { ...doc, references: doc.references.map((x) => (x.id === r.id ? r : x)) }),
});
