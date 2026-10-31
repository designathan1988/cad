// Commands on beams. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import type { Beam } from './schema';

export const addBeam = (beam: Beam): Command<Doc> => ({
  label: 'cmd.addBeam',
  apply: (doc) => ({ ...doc, beams: [...doc.beams, beam] }),
});

export type BeamPatch = {
  readonly width?: number;
  readonly depth?: number;
  readonly topOffset?: number;
  readonly endOffset?: number;
  readonly shape?: 'rect' | 'I';
  readonly plate?: number;
};

/** Section and top of the beams; a size not above zero changes nothing. */
export const updateBeams = (ids: readonly string[], patch: BeamPatch): Command<Doc> => ({
  label: 'cmd.updateBeam',
  apply: (doc) => {
    if ((patch.width !== undefined && !(patch.width > 0)) || (patch.depth !== undefined && !(patch.depth > 0))) return doc;
    if ([patch.topOffset, patch.endOffset].some((v) => v !== undefined && !Number.isFinite(v))) return doc;
    if (patch.plate !== undefined && !(patch.plate > 0)) return doc;
    let changed = false;
    const beams = doc.beams.map((b) => {
      if (!ids.includes(b.id)) return b;
      const next = { ...b, ...patch };
      if (JSON.stringify(next) === JSON.stringify(b)) return b;
      changed = true;
      return next;
    });
    return changed ? { ...doc, beams } : doc;
  },
});
