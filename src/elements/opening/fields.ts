// The fields doors and windows show in the panel, section by section (ui/fields.ts builds the rows):
// general (kind and size), position (rule and its reference), the door's leaf, the group the
// selection is in, and arranging several. Also the next opening the tool places, from the same fields.

import { lengthNum, lengthText } from '../../ui/units';
import { type Doc, wallNumber } from '../../app/document';
import { stopAfter, stopBefore, wallStops } from '../../app/wall-stops';
import { referenceLength } from './derive';
import type { RoomSolid } from '../room/derive';
import { openingSides } from './sides';
import type { OpeningSolid } from '../../app/geometry';
import type { Field } from '../../ui/fields';
import { name, t, type MessageKey } from '../../ui/i18n';
import { alignCandidates, alignFits, referenceCandidates } from './commands';
import { fitStyle, leafRange, modelOf, OPENING_MODELS, operationsOf, PANED } from './style';
import { parseLength } from '../../core/measure';
import { type AlignEdge, type GroupSpacing, hasDistance, OPENING_DEFAULTS, type Opening, type OpeningGroup, type OpeningGroupId, type OpeningId, type OpeningKind, type OpeningStyle, type Operation, type RuleKind, WINDOW_SCREENS, type WindowScreen, DOOR_HANDLES, type DoorHandle, LEAF_DESIGNS, type LeafDesign } from './schema';

export type OpeningSize = { readonly width: number; readonly height: number; readonly sill: number; readonly style?: OpeningStyle | undefined };

export interface OpeningPanelActions {
  /** The same patch for each, or one made from each opening as it is. */
  readonly update: (ids: readonly OpeningId[], patch: Partial<Omit<Opening, 'id'>> | ((o: Opening) => Partial<Omit<Opening, 'id'>>)) => void;
  /** A new kind of rule for one opening, keeping it where it is. */
  readonly setRule: (id: OpeningId, kind: RuleKind, referenceId?: OpeningId) => void;
  /** The others take the position (or head height) of the first. */
  readonly align: (refId: OpeningId, ids: readonly OpeningId[], edge: AlignEdge) => void;
  readonly alignHeads: (refId: OpeningId, ids: readonly OpeningId[]) => void;
  readonly distribute: (ids: readonly OpeningId[], spacing: GroupSpacing) => void;
  readonly setSpacing: (groupId: OpeningGroupId, spacing: GroupSpacing) => void;
  readonly ungroup: (groupId: OpeningGroupId) => void;
}

export const kindName = (k: OpeningKind): string => t(k === 'door' ? 'panel.door' : 'panel.window');

/** `marks`: every opening's type mark (marks.ts), the same as on the plan and in the schedule. */
export function openingFields(selected: readonly OpeningSolid[], update: OpeningPanelActions['update'], marks: ReadonlyMap<string, string> = new Map()): Field<OpeningSolid>[] {
  const ids = selected.map((s) => s.opening.id);
  return [
    {
      id: 'mark',
      label: 'panel.mark',
      kind: 'readout',
      text: (xs) => {
        const set = new Set(xs.map((x) => marks.get(x.opening.id) ?? ''));
        return set.size === 1 ? [...set][0]! : t('panel.varies');
      },
    },
    {
      id: 'kind',
      label: 'panel.kind',
      kind: 'segmented',
      labelled: true,
      options: (['door', 'window'] as const).map((k) => ({ value: k, label: kindName(k), icon: k })),
      get: (o) => o.opening.kind,
      // The new kind's usual height and sill: a door's 2,10 m over a window's sill would pass the wall.
      // A door's make is not a window's: the plain one of the new kind.
      set: (k) => update(ids, { kind: k as OpeningKind, height: OPENING_DEFAULTS[k as OpeningKind].height, sill: OPENING_DEFAULTS[k as OpeningKind].sill, style: undefined }),
    },
    modelField(selected.map((x) => x.opening), (style) => update(ids, { style })),
    { id: 'width', label: 'panel.width', kind: 'number', min: 0.01, get: (o) => o.opening.width, set: (v) => update(ids, { width: v }) },
    { id: 'height', label: 'panel.height', kind: 'number', min: 0.01, get: (o) => o.opening.height, set: (v) => update(ids, { height: v }) },
    // Doors have no sill: shown unless every selected opening is a door.
    {
      id: 'sill',
      label: 'panel.sill',
      kind: 'number',
      min: 0,
      when: (os) => !os.every((o) => o.opening.kind === 'door'),
      get: (o) => o.opening.sill,
      set: (v) => update(ids, { sill: v }),
    },
  ];
}

/** Where one opening sits: its rule, and what the rule measures from. */
export function positionFields(doc: Doc, one: OpeningSolid, placed: ReadonlyMap<OpeningId, OpeningSolid>, act: OpeningPanelActions): Field<OpeningSolid>[] {
  const o = one.opening;
  const rule = o.rule;
  const refs = referenceCandidates(doc, o.id);
  const aligns = alignCandidates(doc, o.id);
  // Named by kind and where it starts on its wall: short enough for the field, and unique.
  const label = (r: Opening) => `${kindName(r.kind)} · ${lengthText(placed.get(r.id)?.start ?? 0)}`;
  // One to align with is on another wall, maybe on another level: say which, so it can be found.
  const levelOf = (wallId: string) => doc.walls.find((w) => w.id === wallId)?.levelId;
  const alignLabel = (r: Opening) => {
    const where = [t('wall.tag', { n: wallNumber(doc, r.wallId) ?? '' })];
    const level = doc.levels.find((l) => l.id === levelOf(r.wallId));
    if (level && levelOf(r.wallId) !== levelOf(o.wallId)) where.push(name(level.name));
    return `${label(r)} · ${where.join(' · ')}`;
  };
  // The start and the end are measured from the face of the nearest wall meeting this one on that
  // side, as the plan's dimensions are (wall-stops.ts): the field shows and takes that gap.
  const host = doc.walls.find((w) => w.id === o.wallId);
  const stops = host ? wallStops(doc, host.id) : [];
  const length = host ? referenceLength(host) : 0;
  const baseOf = (x: OpeningSolid): number =>
    x.opening.rule.kind === 'fromStart' ? stopBefore(stops, x.start) : x.opening.rule.kind === 'fromEnd' ? length - stopAfter(stops, x.end, length) : 0;
  const startBase = stopBefore(stops, one.start);
  const endBase = length - stopAfter(stops, one.end, length);
  // The plan is always seen north up, so the start and the end of a straight wall are named by where
  // they lie on screen: the drawing direction they come from is never seen.
  const side = (fromStart: boolean): string | null => {
    const f = one.frame;
    if (!f || host?.bulge) return null;
    const v = fromStart ? { x: -f.dir.x, y: -f.dir.y } : f.dir;
    return t(Math.abs(v.x) >= Math.abs(v.y) ? (v.x < 0 ? 'side.left' : 'side.right') : v.y > 0 ? 'side.above' : 'side.below');
  };
  const ruleLabel = (k: RuleKind): string => {
    if (k !== 'fromStart' && k !== 'fromEnd') return t(`rule.${k}` as MessageKey);
    const where = side(k === 'fromStart');
    const face = (k === 'fromStart' ? startBase : endBase) > 0;
    if (where) return t(face ? 'rule.fromWallSide' : 'rule.fromEndSide', { side: where });
    return face ? t(k === 'fromStart' ? 'rule.fromStartFace' : 'rule.fromEndFace') : t(`rule.${k}` as MessageKey);
  };
  const ruleOptions = (['fromStart', 'fromEnd', 'centered', 'fromOpening', 'aligned', 'inGroup'] as const)
    .filter((k) => k === rule.kind || (k === 'fromOpening' ? refs.length > 0 : k === 'aligned' ? aligns.length > 0 : k !== 'inGroup'))
    .map((k) => ({ value: k, label: ruleLabel(k) }));
  return [
    {
      id: 'rule',
      label: 'panel.rule',
      kind: 'select',
      options: ruleOptions,
      get: (x) => x.opening.rule.kind,
      set: (k) => act.setRule(o.id, k as RuleKind, k === 'aligned' ? aligns[0]?.id : nearest(refs, one, placed)),
    },
    {
      id: 'refOpening',
      label: 'panel.refOpening',
      kind: 'select',
      when: () => rule.kind === 'fromOpening',
      options: refs.map((r) => ({ value: r.id, label: label(r) })),
      get: (x) => (x.opening.rule.kind === 'fromOpening' ? x.opening.rule.openingId : ''),
      set: (id) => act.setRule(o.id, 'fromOpening', id),
    },
    {
      id: 'alignWith',
      label: 'panel.alignWith',
      kind: 'select',
      when: () => rule.kind === 'aligned',
      options: aligns.map((r) => ({ value: r.id, label: alignLabel(r) })),
      get: (x) => (x.opening.rule.kind === 'aligned' ? x.opening.rule.openingId : ''),
      set: (id) => rule.kind === 'aligned' && act.update([o.id], { rule: { ...rule, openingId: id } }),
    },
    {
      id: 'alignBy',
      label: 'panel.alignBy',
      kind: 'segmented',
      labelled: true,
      when: () => rule.kind === 'aligned',
      // Only the edges that keep the opening inside its wall.
      options:
        rule.kind === 'aligned'
          ? (['start', 'center', 'end'] as const).filter((v) => v === rule.edge || alignFits(doc, o.id, rule.openingId, v)).map((v) => ({ value: v, label: t(`edge.${v}`) }))
          : [],
      get: (x) => (x.opening.rule.kind === 'aligned' ? x.opening.rule.edge : ''),
      set: (edge) => rule.kind === 'aligned' && act.update([o.id], { rule: { ...rule, edge: edge as AlignEdge } }),
    },
    {
      id: 'distance',
      label: 'panel.distance',
      kind: 'number',
      when: () => hasDistance(rule),
      get: (x) => (hasDistance(x.opening.rule) ? x.opening.rule.distance - baseOf(x) : 0),
      set: (v) => hasDistance(rule) && act.update([o.id], { rule: { ...rule, distance: baseOf(one) + v } }),
    },
    // From the same end as the distance above: measured from the wall's end, they read from there too (from
    // its start they showed 9,28 – 10,18 m beside a distance of 0,55 m).
    {
      id: 'jambs',
      label: 'panel.jambs',
      kind: 'readout',
      text: (xs) => {
        const x = xs[0]!;
        return x.opening.rule.kind === 'fromEnd' ? `${lengthNum(length - x.end)} – ${lengthText(length - x.start)}` : `${lengthNum(x.start)} – ${lengthText(x.end)}`;
      },
    },
    // In the middle of its room's stretch of wall: between the faces of the walls beside it (the
    // wall's ends when none), measured from the start from then on.
    {
      id: 'centerBetween',
      label: 'panel.centerBetween',
      kind: 'action',
      enabled: () => {
        const before = stopBefore(stops, one.start);
        const after = stopAfter(stops, one.end, length);
        const middle = (one.start + one.end) / 2;
        return rule.kind !== 'inGroup' && after - before >= one.end - one.start && Math.abs(middle - (before + after) / 2) > 1e-6;
      },
      run: () => {
        const before = stopBefore(stops, one.start);
        const after = stopAfter(stops, one.end, length);
        act.update([o.id], { rule: { kind: 'fromStart', distance: (before + after) / 2 - (one.end - one.start) / 2 } });
      },
    },
  ];
}

/**
 * A door's leaf: to which side it opens, then which jamb it hangs on. The sides are named by the room
 * on each (the other "outside"); with no room on either, by left and right of the wall. The hinge is
 * left or right as seen from the side it opens to (hingeOptions).
 */
export function leafFields(one: OpeningSolid, update: OpeningPanelActions['update'], rooms: readonly RoomSolid[] = []): Field<OpeningSolid>[] {
  const ids = [one.opening.id];
  const sides = openingSides(one, rooms);
  const sideLabel = (v: 'left' | 'right'): string => {
    if (!sides.left && !sides.right) return t(`swing.${v}`);
    const r = sides[v];
    return r ? name(r.room.name) : t('swing.outside');
  };
  return [
    {
      id: 'swing',
      label: 'panel.swing',
      kind: 'segmented',
      options: (['left', 'right'] as const).map((v) => ({ value: v, label: sideLabel(v) })),
      get: (x) => x.opening.swing,
      set: (v) => update(ids, { swing: v as 'left' | 'right' }),
    },
    {
      id: 'hinge',
      label: 'panel.hinge',
      kind: 'segmented',
      options: hingeOptions(one),
      get: (x) => x.opening.hinge,
      set: (v) => update(ids, { hinge: v as 'start' | 'end' }),
    },
    {
      id: 'hingeSeen',
      label: 'panel.hinge',
      kind: 'note',
      when: () => one.frame !== null,
      text: () => {
        const r = sides[one.opening.swing];
        return r ? t('hinge.seenFrom', { room: name(r.room.name) }) : t('hinge.seenFromOutside');
      },
    },
  ];
}

/**
 * The hinge jambs as left and right, as seen by someone on the side the door opens to, facing it: the
 * start and end of the wall's drawing direction mean nothing to the user. Left first. Without a frame
 * (no wall to stand on), start and end.
 */
function hingeOptions(one: OpeningSolid): { value: 'start' | 'end'; label: string }[] {
  const f = one.frame;
  if (!f) return (['start', 'end'] as const).map((v) => ({ value: v, label: t(`hinge.${v}`) }));
  // Standing on the swing side, facing the wall; their right hand is the facing direction turned −90°.
  const facing = one.opening.swing === 'left' ? { x: -f.normal.x, y: -f.normal.y } : f.normal;
  const right = { x: facing.y, y: -facing.x };
  // The start jamb lies back along the wall from the opening's middle.
  const startOnRight = -(f.dir.x * right.x + f.dir.y * right.y) > 0;
  const label = (v: 'start' | 'end') => t((v === 'start') === startOnRight ? 'hinge.right' : 'hinge.left');
  return (['start', 'end'] as const)
    .map((v) => ({ value: v, label: label(v) }))
    .sort((a, b) => (a.label === t('hinge.left') ? -1 : b.label === t('hinge.left') ? 1 : 0));
}

/**
 * A group's spacing: equal, or a fixed gap with the row centred or measured from one end. `stretch`: the part of
 * its wall the row keeps to (derive.ts: groupStretch), which the distance to an end is measured from.
 */
export function groupFields(
  g: OpeningGroup,
  placed: ReadonlyMap<OpeningId, OpeningSolid>,
  act: OpeningPanelActions,
  stretch: { readonly from: number; readonly to: number },
): Field<OpeningGroup>[] {
  const sp = g.spacing;
  // Switching to fixed starts from the mean gap there is now, so nothing jumps more than it must.
  const members = g.members.flatMap((id) => placed.get(id) ?? []);
  const inner = members.slice(1, -1).reduce((s, m) => s + m.end - m.start, 0);
  const gapNow = members.length >= 2 ? (members[members.length - 1]!.start - members[0]!.end - inner) / (members.length - 1) : 0;
  const fixed = (patch: Partial<Extract<GroupSpacing, { kind: 'fixed' }>>): GroupSpacing => ({
    kind: 'fixed',
    gap: sp.kind === 'fixed' ? sp.gap : Math.max(0, Math.round(gapNow * 1000) / 1000),
    anchor: sp.kind === 'fixed' ? sp.anchor : 'centered',
    distance: sp.kind === 'fixed' ? sp.distance : 0,
    ...patch,
  });
  const isFixed = () => sp.kind === 'fixed';
  // A new anchor takes the distance the row is at now from that end: the old distance, measured from the other
  // end or from nothing (centred), threw the row to that end.
  const distanceFrom = (anchor: 'start' | 'centered' | 'end'): number | undefined => {
    if (anchor === 'centered' || members.length === 0) return undefined;
    const d = anchor === 'start' ? members[0]!.start - stretch.from : stretch.to - members[members.length - 1]!.end;
    return Math.max(0, Math.round(d * 1000) / 1000);
  };
  return [
    { id: 'members', label: 'panel.members', kind: 'readout', text: () => t('panel.openings', { n: g.members.length }) },
    {
      id: 'spacing',
      label: 'panel.spacing',
      kind: 'segmented',
      labelled: true,
      options: (['equal', 'fixed'] as const).map((v) => ({ value: v, label: t(`spacing.${v}`) })),
      get: (x) => x.spacing.kind,
      set: (k) => act.setSpacing(g.id, k === 'equal' ? { kind: 'equal' } : fixed({})),
    },
    { id: 'gap', label: 'panel.gap', kind: 'number', min: 0, when: isFixed, get: (x) => (x.spacing.kind === 'fixed' ? x.spacing.gap : 0), set: (v) => act.setSpacing(g.id, fixed({ gap: v })) },
    {
      id: 'anchor',
      label: 'panel.anchor',
      kind: 'select',
      when: isFixed,
      options: (['start', 'centered', 'end'] as const).map((v) => ({ value: v, label: t(`anchor.${v}`) })),
      get: (x) => (x.spacing.kind === 'fixed' ? x.spacing.anchor : ''),
      set: (v) => {
        const anchor = v as 'start' | 'centered' | 'end';
        const distance = distanceFrom(anchor);
        act.setSpacing(g.id, fixed(distance === undefined ? { anchor } : { anchor, distance }));
      },
    },
    {
      id: 'anchorDistance',
      label: 'panel.distance',
      kind: 'number',
      when: () => sp.kind === 'fixed' && sp.anchor !== 'centered',
      get: (x) => (x.spacing.kind === 'fixed' ? x.spacing.distance : 0),
      set: (v) => act.setSpacing(g.id, fixed({ distance: v })),
    },
    { id: 'ungroup', label: 'panel.ungroup', kind: 'action', run: () => act.ungroup(g.id) },
  ];
}

/** Several openings: distribute them, or align the others with the first selected. */
export function arrangeFields(doc: Doc, list: readonly Opening[], placed: ReadonlyMap<OpeningId, OpeningSolid>, act: OpeningPanelActions): Field<Opening>[] {
  const [first, ...others] = list;
  const ids = list.map((o) => o.id);
  return [
    { id: 'hint', label: 'panel.arrange', kind: 'note', text: () => t('panel.arrangeHint', { ref: `${kindName(first!.kind)} · ${lengthText(placed.get(first!.id)?.start ?? 0)}` }) },
    { id: 'distribute', label: 'panel.distribute', kind: 'action', enabled: (os) => os.every((o) => o.wallId === first!.wallId), run: () => act.distribute(ids, { kind: 'equal' }) },
    {
      id: 'alignPosition',
      label: 'panel.alignPosition',
      kind: 'action',
      enabled: () => others.some((o) => alignCandidates(doc, o.id).some((r) => r.id === first!.id)),
      run: () => act.align(first!.id, ids, 'center'),
    },
    { id: 'alignHeads', label: 'panel.alignHeads', kind: 'action', run: () => act.alignHeads(first!.id, ids) },
  ];
}

/** The fields of a placed opening that one not yet placed has not: its mark, its kind (the tool's), its notes and actions. */
const notNextOpening = (f: Field<OpeningSolid>) => f.id === 'mark' || f.id === 'kind' || f.kind === 'note' || f.kind === 'readout' || f.kind === 'action';

/**
 * The next opening the tool places, as an opening (as walls' nextWall and the other kinds' next element,
 * app/next-element.ts): a template of the tool's size and make, shown with a selected opening's fields
 * (openingFields; styleFields for one with a make), their changes made to the tool's size. A model chosen
 * for it brings the size it is usually made in too.
 */
export function nextOpening(kind: OpeningKind, size: OpeningSize, set: (patch: Partial<OpeningSize>) => void): { readonly fields: Field<OpeningSolid>[]; readonly item: OpeningSolid } {
  const opening = { id: '__next__', kind, width: size.width, height: size.height, sill: size.sill, style: size.style } as unknown as Opening;
  const item = { opening } as unknown as OpeningSolid;
  const update: OpeningPanelActions['update'] = (_ids, patch) => {
    const out = typeof patch === 'function' ? patch(opening) : patch;
    const model = 'style' in out && !('width' in out) ? OPENING_MODELS.find((m) => m.kind === kind && m.style === out.style) : undefined;
    set({
      ...(out.width !== undefined ? { width: out.width } : {}),
      ...(out.height !== undefined ? { height: out.height } : {}),
      ...(out.sill !== undefined ? { sill: out.sill } : {}),
      ...('style' in out ? { style: out.style } : {}),
      ...(model ? { width: model.width, height: model.height, sill: model.sill } : {}),
    });
  };
  const fields = [...openingFields([item], update), ...(size.style ? styleFields([item], update) : [])].filter((f) => !notNextOpening(f));
  return { fields, item };
}

/** An opening's model as said: the catalog's name, the operation's for one changed by hand, or plain. */
export function modelName(o: Pick<Opening, 'kind' | 'style'>): string {
  if (!o.style) return t('model.plain');
  const m = modelOf(o);
  return m ? t(`model.${m.id}` as MessageKey) : t(`op.${o.kind}.${o.style.operation}` as MessageKey);
}

/** The model from the catalog (style.ts): plain (no style), one of the kind's, or "changed" for one made by hand. */
function modelField(list: readonly Pick<Opening, 'kind' | 'style'>[], set: (style: OpeningStyle | undefined) => void): Field<OpeningSolid> {
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
const withoutScreen = (s: OpeningStyle): OpeningStyle => {
  const { screen: _gone, ...rest } = s;
  return rest;
};
/** A number of panes asked for: equal ones, the mullions placed by hand let go. */
const withoutMullions = (s: OpeningStyle): OpeningStyle => {
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
        // Empty, the panes are equal: said in the field (the note under them is not in the ribbon).
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

/** The reference opening nearest to this one, jamb to jamb: the default for "from another opening". */
function nearest(refs: readonly Opening[], me: OpeningSolid, placed: ReadonlyMap<OpeningId, OpeningSolid>): OpeningId | undefined {
  let best: OpeningId | undefined;
  let bestD = Infinity;
  for (const r of refs) {
    const p = placed.get(r.id);
    if (!p) continue;
    const d = Math.abs(me.start >= p.end ? me.start - p.end : p.start - me.end);
    if (d < bestD) {
      best = r.id;
      bestD = d;
    }
  }
  return best;
}
