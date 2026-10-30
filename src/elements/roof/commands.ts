// Commands on roofs. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import { edgesFor, type Roof, ROOF_GRADE, ROOF_OVERHANG, ROOF_PARAPET, type RoofKind, ROOF_COVERING } from './schema';

export const addRoof = (roof: Roof): Command<Doc> => ({
  label: 'cmd.addRoof',
  apply: (doc) => ({ ...doc, roofs: [...doc.roofs, roof] }),
});

export type RoofPatch = {
  readonly kind?: RoofKind;
  /** Every sloped side's slope (%); on a kind change, the slope the new sides get. */
  readonly grade?: number;
  /** Every side's overhang (m). */
  readonly overhang?: number;
  /** One side's slope (%; 0 makes it a gable). */
  readonly side?: { readonly index: number; readonly grade: number };
  readonly thickness?: number;
  readonly baseOffset?: number;
  readonly parapet?: number;
  readonly covering?: { readonly materialId?: string; readonly thickness?: number };
};

/** The slope a roof's sloped sides have (the first's), or the default when none slopes. */
const gradeOf = (r: Roof, fallback: number) => r.edges.find((e) => e.grade !== null)?.grade ?? fallback;

export const updateRoofs = (ids: readonly string[], patch: RoofPatch): Command<Doc> => ({
  label: 'cmd.updateRoof',
  apply: (doc) => {
    const nums = [patch.grade, patch.overhang, patch.thickness, patch.baseOffset, patch.parapet, patch.side?.grade];
    if (nums.some((v) => v !== undefined && !Number.isFinite(v))) return doc;
    if ((patch.thickness !== undefined && !(patch.thickness > 0)) || (patch.grade !== undefined && patch.grade < 0) || (patch.overhang !== undefined && patch.overhang < 0)) return doc;
    let changed = false;
    const roofs = doc.roofs.map((r) => {
      if (!ids.includes(r.id)) return r;
      let next: Roof = r;
      if (patch.kind !== undefined && patch.kind !== r.kind) {
        // A parapet roof has no overhang and gets its parapet; a sloped one coming from it gets its eaves back.
        const was = r.edges[0]?.overhang ?? 0;
        const overhang = patch.kind === 'flat' ? 0 : r.kind === 'flat' && was === 0 ? ROOF_OVERHANG : was;
        next = { ...next, kind: patch.kind, edges: edgesFor(patch.kind, r.outline, patch.grade ?? gradeOf(r, ROOF_GRADE), overhang) };
        if (patch.kind === 'flat' && next.parapet === undefined) next = { ...next, parapet: ROOF_PARAPET };
      } else if (patch.grade !== undefined) next = { ...next, edges: next.edges.map((e) => (e.grade === null ? e : { ...e, grade: patch.grade! })) };
      if (patch.overhang !== undefined) next = { ...next, edges: next.edges.map((e) => ({ ...e, overhang: patch.overhang! })) };
      if (patch.side && patch.side.index >= 0 && patch.side.index < next.edges.length) {
        const g = patch.side.grade;
        next = { ...next, edges: next.edges.map((e, i) => (i === patch.side!.index ? { ...e, grade: g > 0 ? g : null } : e)) };
      }
      if (patch.thickness !== undefined) next = { ...next, thickness: patch.thickness };
      if (patch.baseOffset !== undefined) next = { ...next, baseOffset: patch.baseOffset };
      if (patch.parapet !== undefined) next = { ...next, parapet: Math.max(0, patch.parapet) };
      if (patch.covering) {
        const c = { ...(next.covering ?? ROOF_COVERING), ...patch.covering };
        if (!(c.thickness > 0) || !Number.isFinite(c.thickness)) return r;
        next = { ...next, covering: c };
      }
      if (JSON.stringify(next) === JSON.stringify(r)) return r;
      changed = true;
      return next;
    });
    return changed ? { ...doc, roofs } : doc;
  },
});
