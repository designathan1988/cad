// The fields walls show in the panel, in three sections (ui/fields.ts builds the rows). Base offset
// and top are the wall's own or its type's (app/document.ts): an own one is marked, with the way back.

import { type Doc, type DocWall, type WallDefaults, wallBase, wallHeights, wallOverrides, wallTop } from '../../app/document';
import { distance } from '../../core/vector';
import type { Field } from '../../ui/fields';
import { name, num, t, type MessageKey } from '../../ui/i18n';
import { layerSwatch } from '../../ui/swatch';
import { referenceLength } from '../opening/derive';
import { arcOf } from './geometry/arc';
import type { ReferenceLine } from './schema';
import { canAlignWalls, canDistributeWalls } from '../../tools/arrange-walls';

export interface WallFieldActions {
  readonly updateWalls: (patch: Partial<Omit<DocWall, 'id'>>) => void;
  readonly resetToType: (fields: readonly ('top' | 'baseOffset')[]) => void;
  /** Opens the wall types dialog on the selected walls' type. */
  readonly editType: () => void;
  /** The one selected arc's radius, its ends kept. */
  readonly updateRadius: (radius: number) => void;
  /** Several parallel walls: onto the first selected one's line, or with equal spaces (tools/arrange-walls.ts). */
  readonly arrangeWalls: (how: 'align' | 'distribute') => void;
  /** The first selected wall, the reference for aligning: its number on the plan. */
  readonly firstWall?: string;
}

const REFS: readonly { value: ReferenceLine; key: MessageKey; icon: 'refCenter' | 'refExterior' | 'refInterior' }[] = [
  { value: 'centerline', key: 'ref.centerline', icon: 'refCenter' },
  { value: 'exteriorFace', key: 'ref.exteriorFace', icon: 'refExterior' },
  { value: 'interiorFace', key: 'ref.interiorFace', icon: 'refInterior' },
];

const thickness = (doc: Doc, w: DocWall) => (doc.wallTypes.find((x) => x.id === w.wallTypeId)?.layers ?? []).reduce((s, l) => s + l.thickness, 0);

export function wallFields(
  doc: Doc,
  act: WallFieldActions,
): { general: Field<DocWall>[]; constraints: Field<DocWall>[]; more: Field<DocWall>[]; arrange: Field<DocWall>[] } {
  const top = (w: DocWall) => wallTop(doc, w);
  const all = (kind: 'level' | 'fixed') => (ws: readonly DocWall[]) => ws.every((w) => top(w).kind === kind);
  const one = (ws: readonly DocWall[]) => ws.length === 1;
  return {
    general: [
      {
        id: 'type',
        label: 'panel.type',
        kind: 'search',
        // Types are many and alike: a list with search and a thumbnail of each one's layers.
        options: doc.wallTypes.map((w) => ({ value: w.id, label: name(w.name), keywords: w.name, thumb: layerSwatch(w.layers) })),
        get: (w) => w.wallTypeId,
        set: (v) => act.updateWalls({ wallTypeId: v }),
      },
      {
        id: 'editType',
        label: 'types.editThis',
        kind: 'action',
        sub: true,
        // One type among the selection: the dialog opens on it.
        when: (ws) => ws.every((w) => w.wallTypeId === ws[0]!.wallTypeId),
        run: act.editType,
      },
      {
        id: 'reference',
        label: 'panel.reference',
        kind: 'segmented',
        options: REFS.map((r) => ({ value: r.value, label: t(r.key), icon: r.icon })),
        get: (w) => w.referenceLine,
        set: (v) => act.updateWalls({ referenceLine: v as ReferenceLine }),
      },
    ],
    constraints: [
      {
        id: 'level',
        label: 'panel.base',
        kind: 'select',
        options: doc.levels.map((l) => ({ value: l.id, label: name(l.name) })),
        get: (w) => w.levelId,
        set: (v) => act.updateWalls({ levelId: v }),
      },
      {
        id: 'baseOffset',
        label: 'panel.baseOffset',
        kind: 'number',
        get: (w) => wallBase(doc, w),
        set: (v) => act.updateWalls({ baseOffset: v }),
        own: (ws) => ws.some((w) => wallOverrides(doc, w).baseOffset),
        reset: () => act.resetToType(['baseOffset']),
      },
      {
        id: 'top',
        label: 'panel.top',
        kind: 'select',
        options: [
          { value: 'level', label: t('panel.topLevel') },
          { value: 'fixed', label: t('panel.topFixed') },
        ],
        get: (w) => top(w).kind,
        set: (v) => act.updateWalls({ top: v === 'level' ? { kind: 'level', offset: 0 } : { kind: 'fixed', height: 2.8 } }),
        own: (ws) => ws.some((w) => wallOverrides(doc, w).top),
        reset: () => act.resetToType(['top']),
      },
      {
        id: 'topOffset',
        label: 'panel.offset',
        kind: 'number',
        sub: true,
        when: all('level'),
        get: (w) => {
          const r = top(w);
          return r.kind === 'level' ? r.offset : 0;
        },
        set: (v) => act.updateWalls({ top: { kind: 'level', offset: v } }),
      },
      // Up to the level's ceiling the height is not typed: said, so it is never a guess.
      {
        id: 'heightNow',
        label: 'panel.height',
        kind: 'readout',
        sub: true,
        when: all('level'),
        text: (ws) =>
          sameText(
            ws.map((w) => {
              const h = wallHeights(doc, w);
              return `${num(h.top - h.bottom)} m`;
            }),
          ),
      },
      {
        id: 'topHeight',
        label: 'panel.height',
        kind: 'number',
        sub: true,
        min: 0.01,
        when: all('fixed'),
        get: (w) => {
          const r = top(w);
          return r.kind === 'fixed' ? r.height : 0;
        },
        set: (v) => act.updateWalls({ top: { kind: 'fixed', height: v } }),
      },
    ],
    more: [
      { id: 'thickness', label: 'panel.thickness', kind: 'readout', text: (ws) => sameText(ws.map((w) => `${num(thickness(doc, w), 3)} m`)) },
      { id: 'length', label: 'panel.length', kind: 'readout', when: one, text: (ws) => `${num(referenceLength(ws[0]!))} m` },
      { id: 'chord', label: 'panel.chord', kind: 'readout', when: (ws) => one(ws) && !!ws[0]!.bulge, text: (ws) => `${num(distance(ws[0]!.start, ws[0]!.end))} m` },
      {
        id: 'radius',
        label: 'panel.radius',
        kind: 'number',
        when: (ws) => one(ws) && !!ws[0]!.bulge,
        // No arc on a chord has a radius under half of it.
        min: (ws) => distance(ws[0]!.start, ws[0]!.end) / 2,
        get: (w) => arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 })?.radius ?? 0,
        // The ends stay; the arc keeps its side, and stays a major arc if it was one.
        set: (v) => act.updateRadius(v),
      },
    ],
    // Several straight, parallel walls: their lines aligned, or spaced evenly between the outer two.
    arrange: [
      { id: 'arrangeHint', label: 'panel.arrange', kind: 'note', text: () => t('panel.arrangeWallsHint', { ref: act.firstWall ?? '' }) },
      { id: 'alignWalls', label: 'panel.alignWalls', kind: 'action', enabled: (ws) => canAlignWalls(doc, ws.map((w) => w.id)), run: () => act.arrangeWalls('align') },
      { id: 'distributeWalls', label: 'panel.distribute', kind: 'action', enabled: (ws) => canDistributeWalls(doc, ws.map((w) => w.id)), run: () => act.arrangeWalls('distribute') },
    ],
  };
}

/** The text when all agree, else "varies". */
const sameText = (texts: readonly string[]) => (texts.every((x) => x === texts[0]) ? texts[0]! : t('panel.varies'));

/** The settings of the next walls the tool draws: the same choices as a wall's, from the same fields. */
export function nextWallFields(doc: Doc, update: (patch: Partial<WallDefaults>) => void): Field<WallDefaults>[] {
  const types = doc.wallTypes.map((w) => ({ value: w.id, label: name(w.name), keywords: w.name, thumb: layerSwatch(w.layers) }));
  return [
    { id: 'type', label: 'panel.type', kind: 'search', options: types, get: (d) => d.wallTypeId, set: (v) => update({ wallTypeId: v }) },
    {
      id: 'reference',
      label: 'panel.reference',
      kind: 'segmented',
      options: REFS.map((r) => ({ value: r.value, label: t(r.key), icon: r.icon })),
      get: (d) => d.referenceLine,
      set: (v) => update({ referenceLine: v as ReferenceLine }),
    },
    { id: 'baseOffset', label: 'panel.baseOffset', kind: 'number', get: (d) => d.baseOffset, set: (v) => update({ baseOffset: v }) },
    {
      id: 'top',
      label: 'panel.top',
      kind: 'select',
      options: [
        { value: 'level', label: t('panel.topLevel') },
        { value: 'fixed', label: t('panel.topFixed') },
      ],
      get: (d) => d.top.kind,
      set: (v) => update({ top: v === 'level' ? { kind: 'level', offset: 0 } : { kind: 'fixed', height: 2.8 } }),
    },
    {
      id: 'topOffset',
      label: 'panel.offset',
      kind: 'number',
      sub: true,
      when: (ds) => ds[0]!.top.kind === 'level',
      get: (d) => (d.top.kind === 'level' ? d.top.offset : 0),
      set: (v) => update({ top: { kind: 'level', offset: v } }),
    },
    {
      id: 'topHeight',
      label: 'panel.height',
      kind: 'number',
      sub: true,
      min: 0.01,
      when: (ds) => ds[0]!.top.kind === 'fixed',
      get: (d) => (d.top.kind === 'fixed' ? d.top.height : 0),
      set: (v) => update({ top: { kind: 'fixed', height: v } }),
    },
  ];
}
