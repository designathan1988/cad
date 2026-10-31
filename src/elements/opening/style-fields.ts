// A door's or window's make in the panel: its model and the fields of its style (opening, frame,
// trim, transom, leaves, glazing).

import { DOOR_HANDLES, type DoorHandle, LEAF_DESIGNS, type LeafDesign, type Opening, type OpeningStyle, type Operation, WINDOW_SCREENS, type WindowScreen } from './schema';
import type { OpeningPanelActions } from './fields';
import type { Field } from '../fields';
import type { OpeningSolid } from '../../project/derive';
import { type MessageKey, t } from '../../i18n/messages';
import { fitStyle, leafRange, modelOf, OPENING_MODELS, operationsOf, PANED } from './style';
import { lengthNum } from '../../i18n/units';
import { parseLength } from '../../core/measure';

/** An opening's model as said: the catalog's name, the operation's for one changed by hand, or plain. */
export function modelName(o: Pick<Opening, 'kind' | 'style'>): string {
  if (!o.style) return t('model.plain');
  const m = modelOf(o);
  return m ? t(`model.${m.id}` as MessageKey) : t(`op.${o.kind}.${o.style.operation}` as MessageKey);
}

/** The model from the catalog (style.ts): plain (no style), one of the kind's, or "changed" for one made by hand. */
export function modelField(list: readonly Pick<Opening, 'kind' | 'style'>[], set: (style: OpeningStyle | undefined) => void): Field<OpeningSolid> {
  const kind = list[0]?.kind ?? 'door';
  const models = OPENING_MODELS.filter((m) => m.kind === kind);
  const valueOf = (o: Pick<Opening, 'kind' | 'style'>) => (o.style ? (modelOf(o)?.id ?? 'custom') : '');
  return {
    id: 'model',
    label: 'panel.model',
    kind: 'select',
    icon: kind,
    when: () => list.every((o) => o.kind === kind),
    options: [
      { value: '', label: t('model.plain') },
      ...models.map((m) => ({ value: m.id, label: t(`model.${m.id}` as MessageKey) })),
      ...(list.some((o) => valueOf(o) === 'custom') ? [{ value: 'custom', label: t('model.custom') }] : []),
    ],
    get: (x) => valueOf(x.opening),
    set: (v) => {
      if (v === 'custom') return;
      set(models.find((m) => m.id === v)?.style);
    },
  };
}

/**
 * How the selected doors or windows are made and open (style.ts): the operation, the leaves, the frame,
 * the trim, the transom and a door's threshold. Each change keeps each opening's other properties.
 */
export const withoutScreen = (s: OpeningStyle): OpeningStyle => {
  const { screen: _gone, ...rest } = s;
  return rest;
};

/** A number of panes asked for: equal ones, the mullions placed by hand let go. */
export const withoutMullions = (s: OpeningStyle): OpeningStyle => {
  const { mullions: _gone, ...rest } = s;
  return rest;
};

export function styleFields(selected: readonly OpeningSolid[], update: OpeningPanelActions['update'], materials: readonly { readonly id: string; readonly label: string }[] = []): Field<OpeningSolid>[] {
  const ids = selected.map((s) => s.opening.id);
  const kind = selected[0]?.opening.kind ?? 'door';
  const change = (patch: Partial<OpeningStyle>) => update(ids, (o) => (o.style ? { style: fitStyle(o.kind, { ...o.style, ...patch }) } : {}));
  const style = (x: OpeningSolid) => x.opening.style!;
  const leafMax = Math.max(...selected.map((x) => leafRange(style(x).operation)[1]));
  return [
    {
      id: 'operation',
      label: 'panel.operation',
      kind: 'select',
      options: operationsOf(kind).map((op) => ({ value: op, label: t(`op.${kind}.${op}` as MessageKey) })),
      get: (x) => style(x).operation,
      set: (v) => change({ operation: v as Operation }),
    },
    { id: 'leaves', label: kind === 'door' ? 'panel.leaves' : 'panel.panes', kind: 'number', unit: '', decimals: 0, min: 1, when: () => leafMax > 1, get: (x) => style(x).leaves, set: (v) => update(ids, (o) => (o.style ? { style: fitStyle(o.kind, { ...withoutMullions(o.style), leaves: v }) } : {})) },
    // A window's panes split where wanted: the mullions from the start jamb, the transoms from the bottom ("0,45; 0,90").
    ...(['mullions', 'transoms'] as const).map(
      (key): Field<OpeningSolid> => ({
        id: key,
        label: `panel.${key}`,
        kind: 'text',
        // Empty, the panes are equal: said in the field (the note under them is not always shown).
        placeholder: t('panel.splitsEmpty'),
        when: () => kind === 'window' && selected.every((x) => PANED.includes(style(x).operation)),
        get: (x) => (style(x)[key] ?? []).map((m) => lengthNum(m)).join('; '),
        set: (v) => {
          const parts = v.split(';').map((p) => p.trim()).filter((p) => p !== '');
          const read = parts.map((p) => parseLength(p));
          if (read.some((r) => !r.ok || r.value < 0)) return;
          const values = read.map((r) => (r.ok ? r.value : 0));
          update(ids, (o) => {
            if (!o.style) return {};
            const { [key]: _old, ...rest } = o.style;
            return { style: fitStyle(o.kind, values.length > 0 ? { ...rest, [key]: values } : rest) };
          });
        },
      }),
    ),
    { id: 'splitsNote', label: 'panel.splitsNote', kind: 'note', when: () => kind === 'window' && selected.every((x) => PANED.includes(style(x).operation)), text: () => t('panel.splitsNote') },
    { id: 'frame', label: 'panel.frame', kind: 'number', min: 0, get: (x) => style(x).frame, set: (v) => change({ frame: Math.min(0.3, v) }) },
    { id: 'casing', label: 'panel.casing', kind: 'number', min: 0, get: (x) => style(x).casing, set: (v) => change({ casing: Math.min(0.3, v) }) },
    { id: 'transom', label: 'panel.transom', kind: 'number', min: 0, get: (x) => style(x).transom, set: (v) => change({ transom: v }) },
    {
      // A window's protection outside: none, a shutter, a grille.
      id: 'screen',
      label: 'panel.screen',
      kind: 'select',
      when: () => kind === 'window',
      options: [{ value: '', label: t('screen.none') }, ...WINDOW_SCREENS.map((v) => ({ value: v, label: t(`screen.${v}` as MessageKey) }))],
      get: (x) => style(x).screen ?? '',
      set: (v) => update(ids, (o) => (o.style ? { style: fitStyle(o.kind, v === '' ? withoutScreen(o.style) : { ...o.style, screen: v as WindowScreen }) } : {})),
    },
    {
      id: 'threshold',
      label: 'panel.threshold',
      kind: 'segmented',
      when: () => kind === 'door',
      options: [
        { value: '1', label: t('object.yes') },
        { value: '0', label: t('object.no') },
      ],
      get: (x) => (style(x).threshold ? '1' : '0'),
      set: (v) => change({ threshold: v === '1' }),
    },
    // How far it stands open (kept with it: drawn so in 3D, in renders and exports).
    { id: 'openAmount', label: 'panel.openAmount', kind: 'number', unit: '%', decimals: 0, min: 0, get: (x) => Math.round((style(x).open ?? 0) * 100), set: (v) => change({ open: Math.max(0, Math.min(1, v / 100)) }) },
    {
      // A door leaf's design.
      id: 'design',
      label: 'panel.design',
      kind: 'select',
      when: () => kind === 'door',
      options: LEAF_DESIGNS.map((d) => ({ value: d, label: t(`design.${d}` as MessageKey) })),
      get: (x) => style(x).design ?? (style(x).operation === 'overhead' || style(x).operation === 'roller' ? 'grooves' : 'flush'),
      set: (v) => change({ design: v as LeafDesign }),
    },
    {
      id: 'handle',
      label: 'panel.handle',
      kind: 'select',
      when: () => kind === 'door',
      options: DOOR_HANDLES.map((h) => ({ value: h, label: t(`handle.${h}` as MessageKey) })),
      get: (x) => style(x).handle ?? (['sliding', 'pivot'].includes(style(x).operation) ? 'pull' : ['overhead', 'roller', 'folding'].includes(style(x).operation) ? 'none' : 'lever'),
      set: (v) => change({ handle: v as DoorHandle }),
    },
    {
      id: 'glazing',
      label: 'panel.glazing',
      kind: 'segmented',
      options: [
        { value: 'clear', label: t('glazing.clear') },
        { value: 'frosted', label: t('glazing.frosted') },
      ],
      get: (x) => style(x).glazing ?? 'clear',
      set: (v) => change({ glazing: v as 'clear' | 'frosted' }),
    },
    {
      // Glazing bars dividing each pane: none, or 2 to 6 across and up.
      id: 'muntins',
      label: 'panel.muntins',
      kind: 'select',
      when: () => kind === 'window',
      options: [{ value: '0', label: t('screen.none') }, ...[2, 3, 4, 5, 6].map((k) => ({ value: String(k), label: `${k} × ${k}` }))],
      get: (x) => String(style(x).muntins ?? 0),
      set: (v) => update(ids, (o) => {
        if (!o.style) return {};
        const { muntins: _m, ...rest } = o.style;
        return { style: fitStyle(o.kind, v === '0' ? rest : { ...rest, muntins: Number(v) }) };
      }),
    },
    ...(materials.length > 0
      ? (['leafMaterial', 'frameMaterial'] as const).map(
          (key): Field<OpeningSolid> => ({
            id: key,
            label: `panel.${key}`,
            kind: 'select',
            options: [{ value: '', label: t('panel.sceneMaterial') }, ...materials.map((m) => ({ value: m.id, label: m.label }))],
            get: (x) => style(x)[key] ?? '',
            set: (v) =>
              update(ids, (o) => {
                if (!o.style) return {};
                const { [key]: _old, ...rest } = o.style;
                return { style: fitStyle(o.kind, v === '' ? rest : { ...rest, [key]: v }) };
              }),
          }),
        )
      : []),
  ];
}
