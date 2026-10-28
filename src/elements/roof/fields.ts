// The fields roofs show in the panel (ui/fields.ts builds the rows).

import { slopeFormat, slopeShown, slopeTyped, slopeUnit } from '../../ui/units';
import type { Field } from '../../ui/fields';
import { t } from '../../ui/i18n';
import type { RoofPatch } from './commands';
import type { RoofKind } from './schema';
import type { RoofSolid } from './geometry';

export interface RoofFieldActions {
  readonly updateRoofs: (ids: readonly string[], patch: RoofPatch) => void;
}

export function roofFields(roofs: readonly RoofSolid[], act: RoofFieldActions): Field<RoofSolid>[] {
  const ids = roofs.map((r) => r.roof.id);
  const one = roofs.length === 1 ? roofs[0]! : null;
  return [
    {
      id: 'kind',
      label: 'roof.kind',
      icon: 'roof',
      kind: 'select',
      get: (r) => r.roof.kind,
      set: (v) => act.updateRoofs(ids, { kind: v as RoofKind }),
      options: (['flat', 'shed', 'gable', 'hip'] as const).map((k) => ({ value: k, label: t(`roof.kind.${k}`) })),
    },
    {
      id: 'grade',
      label: 'roof.grade',
      icon: 'raise',
      kind: 'number',
      // As the project writes slopes (ui/units.ts): percent, degrees or 1:n.
      unit: slopeUnit(),
      min: 0,
      decimals: slopeFormat() === 'percent' ? 2 : 1,
      when: (rs) => rs.every((r) => r.roof.kind !== 'flat'),
      get: (r) => slopeShown(r.roof.edges.find((e) => e.grade !== null)?.grade ?? 0),
      set: (v) => act.updateRoofs(ids, { grade: slopeTyped(v) }),
    },
    { id: 'overhang', label: 'roof.overhang', icon: 'width', kind: 'number', min: 0, get: (r) => r.roof.edges[0]?.overhang ?? 0, set: (v) => act.updateRoofs(ids, { overhang: v }) },
    { id: 'thickness', label: 'roof.thickness', kind: 'number', min: 0.01, get: (r) => r.roof.thickness, set: (v) => act.updateRoofs(ids, { thickness: v }) },
    { id: 'baseOffset', label: 'roof.baseOffset', kind: 'number', get: (r) => r.roof.baseOffset, set: (v) => act.updateRoofs(ids, { baseOffset: v }) },
    // What it is covered with (roof/schema.ts: covering) is kept in the data but not shown: only the
    // thermal check read it, and the simulations left the app (tag escopo-completo-2026-10-28).
    {
      id: 'parapet',
      label: 'roof.parapet',
      icon: 'height',
      kind: 'number',
      min: 0,
      when: (rs) => rs.every((r) => r.roof.kind === 'flat'),
      get: (r) => r.roof.parapet ?? 0,
      set: (v) => act.updateRoofs(ids, { parapet: v }),
    },
    { id: 'warn', label: 'roof.notConvex', kind: 'note', when: (rs) => rs.some((r) => r.notConvex), text: () => t('roof.notConvex') },
    // Each side's slope, for one roof: 0 makes that side a gable (empena).
    ...(one && one.roof.kind !== 'flat'
      ? one.roof.edges.map(
          (e, i) =>
            ({
              id: `side${i}`,
              label: 'roof.side',
              labelVars: { n: i + 1 },
              icon: 'raise',
              kind: 'number',
              unit: slopeUnit(),
              min: 0,
              decimals: slopeFormat() === 'percent' ? 2 : 1,
              sub: true,
              get: () => slopeShown(e.grade ?? 0),
              set: (v: number) => act.updateRoofs(ids, { side: { index: i, grade: slopeTyped(v) } }),
            }) as const,
        )
      : []),
  ];
}
