// The panel of parametric objects (phase 3): which object and type, and each parameter of its
// definition, read from the evaluated values and written as the instance's own (one undo step), with the
// way back to the type's value. Calculated parameters are shown, not edited. Several objects of one
// definition are edited together; of several definitions, only their place.

import { collisionsOn } from '../../core/collisions';
import { LENGTH_LIMITS, sizeParams } from './evaluate';
import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import type { Field } from '../../ui/fields';
import { getLang, materialLabel, t } from '../../ui/i18n';
import { lengthText } from '../../ui/units';
import { resetObjectValue, setObjectType, setObjectValues } from './commands';
import type { ObjectEval } from './evaluate';
import type { ObjectDefinition, ObjectInstance, Words } from './schema';

/** What the panel reads of each selected object. */
export interface ObjectItem {
  readonly object: ObjectInstance;
  readonly def: ObjectDefinition;
  readonly eval: ObjectEval;
}

export const words = (w: Words): string => (getLang() === 'pt' ? w.pt : w.en);

/**
 * The lengths of a definition measured up and down: dragged by a vertical handle, or in an upright part's
 * height or level (a rail lying along the width has its length in its height: not counted). One dragged
 * along x or y is across, whatever parts use it. Their fields get the height icon; the rest, the width one.
 */
function verticalParams(def: ObjectDefinition): Set<string> {
  const handles = def.handles ?? [];
  const across = new Set(handles.filter((h) => h.axis !== 'z').map((h) => h.param));
  const upright = def.parts.filter((p) => !('tilt' in p && p.tilt !== undefined) && !('roll' in p && p.roll !== undefined));
  const exprs = [...upright.flatMap((p) => [p.z, 'h' in p ? p.h : 0]), ...handles.filter((h) => h.axis === 'z').map((h) => h.param)];
  const text = exprs.map(String).join(' ');
  return new Set(def.params.filter((p) => !across.has(p.name) && new RegExp(`\\b${p.name}\\b`).test(text)).map((p) => p.name));
}

export function objectFields(items: readonly ObjectItem[], doc: Doc, dispatch: (c: Command<Doc>) => void): Field<ObjectItem>[] {
  const ids = items.map((i) => i.object.id);
  const first = items[0];
  if (!first) return [];
  const oneDefinition = items.every((i) => i.def.id === first.def.id);
  const fields: Field<ObjectItem>[] = [
    { id: 'objDefinition', label: 'object.definition', kind: 'readout', icon: 'box', text: (xs) => (xs.every((x) => x.def.id === xs[0]!.def.id) ? words(xs[0]!.def.name) : t('panel.varies')) },
  ];
  if (oneDefinition) {
    const def = first.def;
    const vertical = verticalParams(def);
    const sizes = sizeParams(def);
    fields.push({
      id: 'objType',
      label: 'object.type',
      kind: 'select',
      icon: 'tag',
      options: def.types.map((ty) => ({ value: ty.id, label: words(ty.name) })),
      get: (x) => x.object.typeId,
      set: (v) => dispatch(setObjectType(ids, v)),
    });
    for (const p of def.params) {
      if (p.when !== undefined && !items.every((i) => (i.eval.env[p.when!] ?? 1) !== 0)) continue;
      const label = { label: 'field.raw' as const, labelVars: { text: p.formula !== undefined ? `${words(p.label)} (${t('object.calculated')})` : words(p.label) } };
      const own = {
        own: (xs: readonly ObjectItem[]) => xs.some((x) => p.name in x.object.values),
        reset: () => dispatch(resetObjectValue(ids, p.name)),
        ownWords: { reset: 'object.reset' as const, note: 'object.ownNote' as const },
      };
      const set = (v: number | string) => dispatch(setObjectValues(ids.map((id) => ({ id, values: { [p.name]: v } }))));
      const id = `param.${p.name}`;
      if (p.formula !== undefined) {
        fields.push({ id, ...label, kind: 'readout', icon: 'hash', text: (xs) => shown(p.kind, xs.map((x) => x.eval.env[p.name] ?? 0)) });
      } else if (p.kind === 'length' || p.kind === 'number' || p.kind === 'integer') {
        fields.push({
          id,
          ...label,
          ...own,
          kind: 'number',
          icon: p.kind !== 'length' ? 'hash' : vertical.has(p.name) ? 'height' : 'width',
          // The object's own size: its least (below, it folds up); another length, a millimetre; a count, its own.
          ...(p.kind === 'length' ? { min: sizes.has(p.name) && p.min !== undefined ? p.min : LENGTH_LIMITS.min } : p.min !== undefined && (p.kind === 'integer' || p.min >= 0) ? { min: p.kind === 'integer' ? p.min : 0 } : {}),
          ...(p.kind === 'length' ? {} : { unit: '' }),
          // A plain number shows as many decimals as its step has (a lamp's 9 W, not 9,00 W).
          ...(p.kind === 'integer' ? { decimals: 0 } : p.kind === 'number' && p.step !== undefined ? { decimals: stepDecimals(p.step) } : {}),
          get: (x) => x.eval.env[p.name] ?? 0,
          set,
        });
      } else if (p.kind === 'bool') {
        fields.push({
          id,
          ...label,
          ...own,
          kind: 'segmented',
          icon: 'tag',
          options: [
            { value: '1', label: t('object.yes') },
            { value: '0', label: t('object.no') },
          ],
          get: (x) => String(x.eval.env[p.name] ?? 0),
          set: (v) => set(Number(v)),
        });
      } else if (p.kind === 'choice') {
        fields.push({
          id,
          ...label,
          ...own,
          kind: 'select',
          icon: 'tag',
          options: (p.options ?? []).map((o, i) => ({ value: String(i), label: words(o) })),
          get: (x) => String(x.eval.env[p.name] ?? 0),
          set: (v) => set(Number(v)),
        });
      } else {
        fields.push({
          id,
          ...label,
          ...own,
          kind: 'select',
          icon: 'slab',
          options: doc.materials.map((m) => ({ value: m.id, label: materialLabel(m) })),
          get: (x) => x.eval.materials[p.name] ?? '',
          set: (v) => set(v),
        });
      }
    }
  }
  fields.push({
    id: 'objElevation',
    label: 'object.elevation',
    kind: 'number',
    icon: 'height',
    // Not below its floor while collisions are on (app/collision.ts).
    min: () => (collisionsOn() ? 0 : -Infinity),
    get: (x) => x.object.elevation,
    set: (v) => dispatch(setObjectValues(ids.map((id) => ({ id, values: {}, elevation: v })))),
  });
  return fields;
}

/** A calculated value as the panel writes it: a count whole, a length in the project's unit. */
function shown(kind: string, values: readonly number[]): string {
  const v = values[0] ?? 0;
  if (!values.every((x) => Math.abs(x - v) < 1e-9)) return t('panel.varies');
  return kind === 'length' ? lengthText(v) : String(Math.round(v * 1000) / 1000).replace('.', getLang() === 'pt' ? ',' : '.');
}

/** How many decimals a step has: 1 and 100 none, 0.5 one, 0.25 two (at most three). */
export function stepDecimals(step: number): number {
  for (let d = 0; d < 3; d++) if (Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-9) return d;
  return 3;
}
