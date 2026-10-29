// The fields walls show in the panel, in three sections (ui/fields.ts builds the rows). Base offset
// and top are the wall's own or its type's (app/document.ts): an own one is marked, with the way back.

import { lengthText } from '../../ui/units';
import { type Doc, type DocWall, type WallDefaults, wallBase, wallHeights, wallOverrides, wallTop, type WallPhase } from '../../app/document';
import { distance } from '../../core/vector';
import type { Field } from '../../ui/fields';
import { name, t, type MessageKey } from '../../ui/i18n';
import { layerSwatch } from '../../ui/swatch';
import { referenceLength } from '../opening/derive';
import { arcOf } from './geometry/arc';
import type { EndJoin, HeightRule, ReferenceLine } from './schema';
import { canAlignWalls, canDistributeWalls } from '../../tools/arrange-walls';
import { withLiveType } from './types';
import type { WallPatch } from './commands';

export interface WallFieldActions {
  readonly updateWalls: (patch: WallPatch) => void;
  /** Another reference line for the selected walls, their bodies kept where they are. */
  readonly setReferenceLine: (line: ReferenceLine) => void;
  /** Another type for the selected walls: the face against their room kept, or their reference line (keepClear). */
  readonly setWallType: (typeId: string) => void;
  /** Whether a type changed keeps the clear span (the face against the room) or the reference line. */
  readonly keepClear: boolean;
  readonly setKeepClear: (on: boolean) => void;
  readonly resetToType: (fields: readonly ('top' | 'baseOffset')[]) => void;
  /** Opens the wall types dialog on the selected walls' type. */
  readonly editType: () => void;
  /** The one selected arc's radius, its ends kept. */
  readonly updateRadius: (radius: number) => void;
  /** Several parallel walls: onto the first selected one's line, or with equal spaces (tools/arrange-walls.ts). */
  readonly arrangeWalls: (how: 'align' | 'distribute') => void;
  /** How the one selected wall joins at an end (EndJoin); 'auto' clears the choice. */
  readonly setEndJoin: (end: 'start' | 'end', join: EndJoin | 'auto') => void;
  /** Where each end of the one selected wall is on the plan, to name it: its start, then its end. */
  readonly endSides?: readonly ['top' | 'bottom' | 'left' | 'right', 'top' | 'bottom' | 'left' | 'right'];
  /** The first selected wall, the reference for aligning: its number on the plan. */
  readonly firstWall?: string;
  /** Whether each end of the one selected wall is in an L of two straight walls (start, end): elsewhere a
   * chosen miter, through, stop or square does nothing (footprint.ts), so only automatic and off are offered. */
  readonly endChoosable?: readonly [boolean, boolean];
}

const REFS: readonly { value: ReferenceLine; key: MessageKey; short: MessageKey; icon: 'refCenter' | 'refExterior' | 'refInterior' }[] = [
  { value: 'centerline', key: 'ref.centerline', short: 'ref.short.centerline', icon: 'refCenter' },
  { value: 'exteriorFace', key: 'ref.exteriorFace', short: 'ref.short.exteriorFace', icon: 'refExterior' },
  { value: 'interiorFace', key: 'ref.interiorFace', short: 'ref.short.interiorFace', icon: 'refInterior' },
];

const JOINS = ['auto', 'miter', 'through', 'stop', 'square', 'off'] as const;

const thickness = (doc: Doc, w: DocWall) => (doc.wallTypes.find((x) => x.id === w.wallTypeId)?.layers ?? []).reduce((s, l) => s + l.thickness, 0);

export function wallFields(
  doc: Doc,
  act: WallFieldActions,
  /** The walls the fields are for: a new top up to a level takes the one above the first's. */
  selected: readonly DocWall[] = [],
): { general: Field<DocWall>[]; constraints: Field<DocWall>[]; more: Field<DocWall>[]; arrange: Field<DocWall>[] } {
  const top = (w: DocWall) => wallTop(doc, w);
  const all = (kind: HeightRule['kind']) => (ws: readonly DocWall[]) => ws.every((w) => top(w).kind === kind);
  const sel = () => selected;
  const one = (ws: readonly DocWall[]) => ws.length === 1;
  return {
    general: [
      {
        id: 'type',
        label: 'panel.type',
        kind: 'search',
        // Types are many and alike: a list with search and a thumbnail of each one's layers.
        options: doc.wallTypes.map((w) => ({ value: w.id, label: name(w.name), keywords: w.name, thumb: layerSwatch(w.layers, doc.materials) })),
        get: (w) => w.wallTypeId,
        set: (v) => act.setWallType(v),
      },
      {
        // What stays where it was when the type, and so the thickness, changes: the room's clear size,
        // the thickness going to the other side, or the reference line, the faces moving about it.
        id: 'keepOnType',
        label: 'panel.keepOnType',
        icon: 'refInterior',
        kind: 'segmented',
        sub: true,
        wide: true,
        labelled: true,
        options: [
          { value: 'clear', label: t('keep.clear'), short: t('keep.clear') },
          { value: 'line', label: t('keep.line'), short: t('keep.line') },
        ],
        get: () => (act.keepClear ? 'clear' : 'line'),
        set: (v) => act.setKeepClear(v === 'clear'),
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
        options: REFS.map((r) => ({ value: r.value, label: t(r.key), short: t(r.short), icon: r.icon })),
        // The icons alone did not say which line each was: their names beside them, across the panel.
        labelled: true,
        wide: true,
        get: (w) => w.referenceLine,
        // The body stays where it is; the line moves to its face or centre (edit.ts).
        set: (v) => act.setReferenceLine(v as ReferenceLine),
      },
      {
        // Its phase in a renovation: drawn in a colour of its own with the overrides on (layer-sets.ts).
        id: 'phase',
        label: 'panel.phase',
        kind: 'segmented',
        options: [
          { value: 'new', label: t('phase.new'), short: t('phase.new') },
          { value: 'existing', label: t('phase.existing'), short: t('phase.existing') },
          { value: 'demolish', label: t('phase.demolish'), short: t('phase.demolish') },
        ],
        labelled: true,
        wide: true,
        get: (w) => w.phase ?? 'new',
        set: (v) => act.updateWalls((v === 'new' ? { phase: undefined } : { phase: v as WallPhase }) as Partial<Omit<DocWall, 'id'>>),
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
        options: topOptions(doc),
        get: (w) => top(w).kind,
        set: (v) => act.updateWalls((w, d) => ({ top: topRule(d, w, v, levelAbove(d, sel()[0]?.levelId)) })),
        own: (ws) => ws.some((w) => wallOverrides(doc, w).top),
        reset: () => act.resetToType(['top']),
      },
      // Up to a level: which one, and how far above (+) or below (−) its floor.
      {
        id: 'topLevelId',
        label: 'panel.topToWhich',
        kind: 'select',
        sub: true,
        when: all('toLevel'),
        options: doc.levels.map((l) => ({ value: l.id, label: name(l.name) })),
        get: (w) => {
          const r = top(w);
          return r.kind === 'toLevel' ? r.levelId : '';
        },
        set: (v) => act.updateWalls({ top: { kind: 'toLevel', levelId: v, offset: 0 } }),
      },
      {
        id: 'topLevelOffset',
        label: 'panel.offset',
        kind: 'number',
        sub: true,
        when: (ws) => all('toLevel')(ws) && ws.every((w) => (top(w) as { levelId?: string }).levelId === (top(ws[0]!) as { levelId?: string }).levelId),
        get: (w) => {
          const r = top(w);
          return r.kind === 'toLevel' ? r.offset : 0;
        },
        set: (v) => {
          const r = top(sel()[0]!);
          if (r.kind === 'toLevel') act.updateWalls({ top: { ...r, offset: v } });
        },
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
        when: (ws) => all('level')(ws) || all('toLevel')(ws) || all('roof')(ws),
        text: (ws) =>
          sameText(
            ws.map((w) => {
              const h = wallHeights(doc, w);
              return `${lengthText(h.top - h.bottom)}`;
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
      { id: 'thickness', label: 'panel.thickness', kind: 'readout', text: (ws) => sameText(ws.map((w) => `${lengthText(thickness(doc, w), 3)}`)) },
      { id: 'length', label: 'panel.length', kind: 'readout', when: one, text: (ws) => `${lengthText(referenceLength(ws[0]!))}` },
      { id: 'chord', label: 'panel.chord', kind: 'readout', when: (ws) => one(ws) && !!ws[0]!.bulge, text: (ws) => `${lengthText(distance(ws[0]!.start, ws[0]!.end))}` },
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
      // How each end joins (Revit's Wall Joins: butt, miter, square off, disallow): automatic unless chosen.
      ...(['start', 'end'] as const).map(
        (end): Field<DocWall> => ({
          id: `join-${end}`,
          // Named by where the end is ("the top end"): which end is a wall's start is not seen.
          label: act.endSides ? (`panel.join.${act.endSides[end === 'start' ? 0 : 1]}` as const) : end === 'start' ? 'panel.joinStart' : 'panel.joinEnd',
          kind: 'select',
          when: one,
          // Not at an L: automatic and off only, and a choice kept from an L said to do nothing here.
          options: (() => {
            if (act.endChoosable?.[end === 'start' ? 0 : 1] ?? true) return JOINS.map((j) => ({ value: j, label: t(`join.${j}`) }));
            const kept = selected[0]?.joins?.[end];
            return JOINS.filter((j) => j === 'auto' || j === 'off' || j === kept).map((j) => ({
              value: j,
              label: j === 'auto' || j === 'off' ? t(`join.${j}`) : t('join.noEffect', { join: t(`join.${j}`) }),
            }));
          })(),
          get: (w) => w.joins?.[end] ?? 'auto',
          set: (v) => act.setEndJoin(end, v as EndJoin | 'auto'),
        }),
      ),
    ],
    // Several straight, parallel walls: their lines aligned, or spaced evenly between the outer two.
    arrange: [
      { id: 'arrangeHint', label: 'panel.arrange', kind: 'note', text: () => t('panel.arrangeWallsHint', { ref: act.firstWall ?? '' }) },
      { id: 'alignWalls', label: 'panel.alignWalls', kind: 'action', enabled: (ws) => canAlignWalls(doc, ws.map((w) => w.id)), run: () => act.arrangeWalls('align') },
      { id: 'distributeWalls', label: 'panel.distribute', kind: 'action', enabled: (ws) => canDistributeWalls(doc, ws.map((w) => w.id)), run: () => act.arrangeWalls('distribute') },
    ],
  };
}

/** The ways to set a top: the level's height, a fixed height, up to a level, under the roof. */
const topOptions = (doc: Doc) => [
  { value: 'level', label: t('panel.topLevel') },
  { value: 'fixed', label: t('panel.topFixed') },
  // Up to a level only when there is another level.
  ...(doc.levels.length > 1 ? [{ value: 'toLevel', label: t('panel.topToLevel') }] : []),
  { value: 'roof', label: t('panel.topRoof') },
];

/** The level just above a level (by its floor), else the highest other one. */
function levelAbove(doc: Doc, levelId: string | undefined): string | undefined {
  const own = doc.levels.find((l) => l.id === levelId);
  const others = [...doc.levels].filter((l) => l.id !== levelId).sort((a, b) => a.elevation - b.elevation);
  return (own ? others.find((l) => l.elevation > own.elevation) : undefined)?.id ?? others[others.length - 1]?.id;
}

/**
 * A new top of the kind chosen for a wall, from its top now: a fixed height is the height it has; at its
 * level's height or up to a level (the one given, above the walls'), the offset a level top had carries
 * over (Revit's Top Offset), and from a fixed or roof top the offset keeps the wall's top where it is.
 * Built from constants, a 3.20 m wall made "fixed" dropped to 2.80 m and an offset was lost.
 */
function topRule(doc: Doc, wall: DocWall, kind: string, above: string | undefined): HeightRule {
  const now = wallTop(doc, wall);
  const h = wallHeights(doc, wall);
  if (kind === now.kind) return now;
  if (kind === 'fixed') return { kind: 'fixed', height: h.top - h.bottom };
  if (kind === 'roof') return { kind: 'roof' };
  const level = doc.levels.find((l) => l.id === (kind === 'toLevel' && above ? above : wall.levelId));
  const kept = now.kind === 'level' || now.kind === 'toLevel' ? now.offset : level ? h.top - (kind === 'toLevel' ? level.elevation : level.elevation + level.height) : 0;
  if (kind === 'toLevel' && above) return { kind: 'toLevel', levelId: above, offset: kept };
  return { kind: 'level', offset: kept };
}

/** The text when all agree, else "varies". */
const sameText = (texts: readonly string[]) => (texts.every((x) => x === texts[0]) ? texts[0]! : t('panel.varies'));

/** The template's id: never a wall's (theirs start with "wall_"), as next-element.ts's NEXT_ID. */
const NEXT_WALL_ID = '__next__';

/** The fields a wall not yet drawn has: its type, line, base and top (its level is the one shown; its phase, joins and measures are a placed wall's). */
const NEXT_WALL = new Set(['type', 'reference', 'baseOffset', 'top', 'topLevelId', 'topLevelOffset', 'topOffset', 'topHeight']);

/**
 * The next walls the tool draws, as a wall (Revit's type and instance properties before the click; the
 * other kinds' next element, app/next-element.ts): a template wall made of the tool's settings on the
 * level shown, with the same fields as a selected wall (wallFields), those a placed wall alone has left
 * out. A change to the template is a change to the settings.
 */
export function nextWall(doc: Doc, chosen: WallDefaults, levelId: string, update: (patch: Partial<WallDefaults>) => void): { readonly fields: Field<DocWall>[]; readonly item: DocWall } {
  // Its type as the wall tool will draw it (types.ts: withLiveType), not one deleted since.
  const defaults = withLiveType(doc, chosen);
  const item: DocWall = { id: NEXT_WALL_ID, wallTypeId: defaults.wallTypeId, referenceLine: defaults.referenceLine, start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, levelId, baseOffset: defaults.baseOffset, top: defaults.top };
  // The type's own base and top: what "back to the type's" sets.
  const { baseOffset: _b, top: _t, ...bare } = item;
  const settings = (set: WallPatch) => {
    const patch = typeof set === 'function' ? set(item, doc) : set;
    update({
      ...(patch.wallTypeId !== undefined ? { wallTypeId: patch.wallTypeId } : {}),
      ...(patch.referenceLine !== undefined ? { referenceLine: patch.referenceLine } : {}),
      ...(patch.baseOffset !== undefined ? { baseOffset: patch.baseOffset } : {}),
      ...(patch.top !== undefined ? { top: patch.top } : {}),
    });
  };
  const act: WallFieldActions = {
    updateWalls: settings,
    setReferenceLine: (line) => update({ referenceLine: line }),
    setWallType: (typeId) => update({ wallTypeId: typeId }),
    keepClear: false,
    setKeepClear: () => undefined,
    resetToType: (fields) => update(Object.fromEntries(fields.map((f) => [f, f === 'top' ? wallTop(doc, bare) : wallBase(doc, bare)]))),
    editType: () => undefined,
    updateRadius: () => undefined,
    arrangeWalls: () => undefined,
    setEndJoin: () => undefined,
  };
  const all = wallFields(doc, act, [item]);
  const fields = [...all.general, ...all.constraints].filter((f) => NEXT_WALL.has(f.id));
  return { fields, item };
}
