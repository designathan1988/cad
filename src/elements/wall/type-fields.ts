// The fields of a wall type (its dialog, ui/types-dialog.ts): name, top and base offset, rendered by
// the same schema renderer as the properties panel. The top at the level's height and a base offset
// of 0 are what a wall has without its type giving any: set to those, the type keeps none.

import type { Field } from '../../ui/fields';
import { name, t } from '../../ui/i18n';
import type { WallType } from './schema';
import type { WallTypePatch } from './types';
import { LEVEL_HEIGHT } from '../../app/document';

export interface WallTypeFieldActions {
  readonly update: (patch: WallTypePatch) => void;
  /** The type's top now, which a change of how it is set starts from. */
  readonly top: WallType['top'];
}

export function wallTypeFields(act: WallTypeFieldActions): Field<WallType>[] {
  const kind = (x: WallType) => x.top?.kind ?? 'level';
  return [
    { id: 'name', label: 'types.name', kind: 'text', get: (x) => name(x.name), set: (v) => act.update({ name: v }) },
    {
      id: 'top',
      label: 'panel.top',
      kind: 'segmented',
      options: [
        { value: 'level', label: t('panel.topLevel') },
        { value: 'fixed', label: t('panel.topFixed') },
      ],
      get: kind,
      // The type has no level: its heights are measured on a level of the usual height, so a switch keeps
      // its walls there as tall as they were (a level offset becomes that much more height, and back).
      set: (v) => {
        const top = act.top;
        if (v === 'fixed') act.update({ top: { kind: 'fixed', height: LEVEL_HEIGHT + (top?.kind === 'level' ? top.offset : 0) } });
        else {
          const offset = top?.kind === 'fixed' ? top.height - LEVEL_HEIGHT : 0;
          act.update({ top: Math.abs(offset) < 1e-9 ? undefined : { kind: 'level', offset } });
        }
      },
    },
    {
      id: 'topOffset',
      label: 'panel.offset',
      kind: 'number',
      sub: true,
      when: (xs) => xs.every((x) => kind(x) === 'level'),
      get: (x) => (x.top?.kind === 'level' ? x.top.offset : 0),
      set: (v) => act.update({ top: v === 0 ? undefined : { kind: 'level', offset: v } }),
    },
    {
      id: 'topHeight',
      label: 'panel.height',
      kind: 'number',
      sub: true,
      min: 0.01,
      when: (xs) => xs.every((x) => kind(x) === 'fixed'),
      get: (x) => (x.top?.kind === 'fixed' ? x.top.height : 0),
      set: (v) => act.update({ top: { kind: 'fixed', height: v } }),
    },
    {
      id: 'baseOffset',
      label: 'panel.baseOffset',
      kind: 'number',
      get: (x) => x.baseOffset ?? 0,
      set: (v) => act.update({ baseOffset: v === 0 ? undefined : v }),
    },
  ];
}
