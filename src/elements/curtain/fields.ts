// The fields curtain walls show in the panel (ui/fields.ts builds the rows): its height and foot, how
// each direction is divided, its frame and its panels.

import { lengthText } from '../../ui/units';
import type { Field } from '../../ui/fields';
import { t } from '../../ui/i18n';
import type { CurtainPatch } from './commands';
import type { CurtainSolid } from './geometry';
import type { GridRule } from './schema';

export interface CurtainFieldActions {
  readonly updateCurtains: (ids: readonly string[], patch: CurtainPatch) => void;
}

const MODES = ['spacing', 'count', 'max'] as const;

export function curtainFields(items: readonly CurtainSolid[], act: CurtainFieldActions): Field<CurtainSolid>[] {
  const ids = items.map((s) => s.curtain.id);
  const same = (f: (s: CurtainSolid) => string) => (xs: readonly CurtainSolid[]) => (xs.every((x) => f(x) === f(xs[0]!)) ? f(xs[0]!) : t('panel.varies'));
  // A direction's division: its way (a select) and its value, a length or a number of panels.
  const grid = (key: 'vertical' | 'horizontal'): Field<CurtainSolid>[] => [
    {
      id: `${key}Mode`,
      label: `curtain.${key}`,
      kind: 'select',
      icon: key === 'vertical' ? 'width' : 'height',
      options: MODES.map((m) => ({ value: m, label: t(`curtain.mode.${m}`) })),
      get: (s) => s.curtain[key].mode,
      // A number of panels from a spacing keeps about the same panels, and back.
      set: (v) =>
        act.updateCurtains(ids, {
          [key]: ((): GridRule => {
            const c = items[0]!;
            const total = key === 'vertical' ? c.length : c.top - c.bottom;
            const lines = key === 'vertical' ? c.verticals : c.horizontals;
            const panels = Math.max(1, lines.length - 1);
            return v === 'count' ? { mode: 'count', value: panels } : { mode: v as GridRule['mode'], value: Math.round((total / panels) * 100) / 100 };
          })(),
        }),
    },
    {
      id: `${key}Length`,
      label: 'curtain.spacing',
      kind: 'number',
      sub: true,
      min: 0.1,
      when: (xs) => xs.every((s) => s.curtain[key].mode !== 'count'),
      get: (s) => s.curtain[key].value,
      set: (v) => act.updateCurtains(ids, { [key]: { mode: items[0]!.curtain[key].mode, value: v } }),
    },
    {
      id: `${key}Count`,
      label: 'curtain.panels',
      kind: 'number',
      sub: true,
      unit: '',
      decimals: 0,
      min: 1,
      when: (xs) => xs.every((s) => s.curtain[key].mode === 'count'),
      get: (s) => s.curtain[key].value,
      set: (v) => act.updateCurtains(ids, { [key]: { mode: 'count', value: Math.max(1, Math.round(v)) } }),
    },
  ];
  return [
    { id: 'length', label: 'curtain.length', kind: 'readout', text: same((s) => lengthText(s.length)) },
    { id: 'height', label: 'curtain.height', kind: 'number', icon: 'height', min: 0.1, get: (s) => s.top - s.bottom, set: (v) => act.updateCurtains(ids, { height: v }) },
    { id: 'baseOffset', label: 'curtain.baseOffset', kind: 'number', icon: 'raise', get: (s) => s.curtain.baseOffset, set: (v) => act.updateCurtains(ids, { baseOffset: v }) },
    ...grid('vertical'),
    ...grid('horizontal'),
    { id: 'mullion', label: 'curtain.mullion', kind: 'number', min: 0.01, decimals: 3, get: (s) => s.curtain.mullion, set: (v) => act.updateCurtains(ids, { mullion: v }) },
    { id: 'depth', label: 'curtain.depth', kind: 'number', min: 0.01, decimals: 3, get: (s) => s.curtain.depth, set: (v) => act.updateCurtains(ids, { depth: v }) },
    {
      id: 'panel',
      label: 'curtain.panel',
      kind: 'segmented',
      labelled: true,
      options: [
        { value: 'glass', label: t('curtain.panel.glass') },
        { value: 'opaque', label: t('curtain.panel.opaque') },
      ],
      get: (s) => s.curtain.panel,
      set: (v) => act.updateCurtains(ids, { panel: v === 'opaque' ? 'opaque' : 'glass' }),
    },
    { id: 'cells', label: 'curtain.cells', kind: 'readout', text: same((s) => String(s.panels.length)) },
  ];
}
