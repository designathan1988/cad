// The fields doors and windows show in the panel, section by section (ui/fields.ts builds the rows):
// general (kind and size), position (rule and its reference), the door's leaf, the group the
// selection is in, and arranging several. Also the size of the next opening the tool places.

import type { Doc } from '../../app/document';
import type { OpeningSolid } from '../../app/geometry';
import type { Field } from '../../ui/fields';
import { num, t, type MessageKey } from '../../ui/i18n';
import { alignCandidates, alignFits, referenceCandidates } from './commands';
import {
  type AlignEdge,
  type GroupSpacing,
  hasDistance,
  OPENING_DEFAULTS,
  type Opening,
  type OpeningGroup,
  type OpeningGroupId,
  type OpeningId,
  type OpeningKind,
  type RuleKind,
} from './schema';

export type OpeningSize = { readonly width: number; readonly height: number; readonly sill: number };

export interface OpeningPanelActions {
  readonly update: (ids: readonly OpeningId[], patch: Partial<Omit<Opening, 'id'>>) => void;
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

export function openingFields(selected: readonly OpeningSolid[], update: OpeningPanelActions['update']): Field<OpeningSolid>[] {
  const ids = selected.map((s) => s.opening.id);
  return [
    {
      id: 'kind',
      label: 'panel.kind',
      kind: 'segmented',
      labelled: true,
      options: (['door', 'window'] as const).map((k) => ({ value: k, label: kindName(k), icon: k })),
      get: (o) => o.opening.kind,
      // The new kind's usual height and sill: a door's 2,10 m over a window's sill would pass the wall.
      set: (k) => update(ids, { kind: k as OpeningKind, height: OPENING_DEFAULTS[k as OpeningKind].height, sill: OPENING_DEFAULTS[k as OpeningKind].sill }),
    },
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
  const label = (r: Opening) => `${kindName(r.kind)} · ${num(placed.get(r.id)?.start ?? 0)} m`;
  const ruleOptions = (['fromStart', 'fromEnd', 'centered', 'fromOpening', 'aligned', 'inGroup'] as const)
    .filter((k) => k === rule.kind || (k === 'fromOpening' ? refs.length > 0 : k === 'aligned' ? aligns.length > 0 : k !== 'inGroup'))
    .map((k) => ({ value: k, label: t(`rule.${k}` as MessageKey) }));
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
      options: aligns.map((r) => ({ value: r.id, label: label(r) })),
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
      get: (x) => (hasDistance(x.opening.rule) ? x.opening.rule.distance : 0),
      set: (v) => hasDistance(rule) && act.update([o.id], { rule: { ...rule, distance: v } }),
    },
    { id: 'jambs', label: 'panel.jambs', kind: 'readout', text: (xs) => `${num(xs[0]!.start)} – ${num(xs[0]!.end)} m` },
  ];
}

/** A door's leaf: which jamb it hangs on, and to which side it opens. */
export function leafFields(one: OpeningSolid, update: OpeningPanelActions['update']): Field<OpeningSolid>[] {
  const ids = [one.opening.id];
  return [
    {
      id: 'hinge',
      label: 'panel.hinge',
      kind: 'segmented',
      options: (['start', 'end'] as const).map((v) => ({ value: v, label: t(`hinge.${v}`) })),
      get: (x) => x.opening.hinge,
      set: (v) => update(ids, { hinge: v as 'start' | 'end' }),
    },
    {
      id: 'swing',
      label: 'panel.swing',
      kind: 'segmented',
      options: (['left', 'right'] as const).map((v) => ({ value: v, label: t(`swing.${v}`) })),
      get: (x) => x.opening.swing,
      set: (v) => update(ids, { swing: v as 'left' | 'right' }),
    },
  ];
}

/** A group's spacing: equal, or a fixed gap with the row centred or measured from one end. */
export function groupFields(g: OpeningGroup, placed: ReadonlyMap<OpeningId, OpeningSolid>, act: OpeningPanelActions): Field<OpeningGroup>[] {
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
      set: (v) => act.setSpacing(g.id, fixed({ anchor: v as 'start' | 'centered' | 'end' })),
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
    { id: 'hint', label: 'panel.arrange', kind: 'note', text: () => t('panel.arrangeHint', { ref: `${kindName(first!.kind)} · ${num(placed.get(first!.id)?.start ?? 0)} m` }) },
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

/** The size of the next opening the tool places (one set of values, not elements). */
export function nextOpeningFields(kind: OpeningKind, set: (patch: Partial<OpeningSize>) => void): Field<OpeningSize>[] {
  return [
    { id: 'width', label: 'panel.width', kind: 'number', min: 0.01, get: (s) => s.width, set: (v) => set({ width: v }) },
    { id: 'height', label: 'panel.height', kind: 'number', min: 0.01, get: (s) => s.height, set: (v) => set({ height: v }) },
    { id: 'sill', label: 'panel.sill', kind: 'number', min: 0, when: () => kind !== 'door', get: (s) => s.sill, set: (v) => set({ sill: v }) },
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
