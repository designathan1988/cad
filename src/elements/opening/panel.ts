// Properties of the selected doors and windows, and of the next ones the tool places. It only reads
// state and sends changes; each change is one command, so one undo step.

import type { Doc } from '../../app/document';
import type { OpeningSolid } from '../../app/geometry';
import { el, numberField, row, section, segmented, select } from '../../ui/controls';
import { num, t, type MessageKey } from '../../ui/i18n';
import { icon } from '../../ui/icons';
import { alignCandidates, referenceCandidates } from './commands';
import type { OpeningWarning } from './derive';
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

/** A button across the whole row of a section. */
const wideButton = (text: string, onClick: () => void, enabled = true): HTMLElement => {
  const b = el('button', { type: 'button', class: 'icon-btn text-btn wide-btn' }, text);
  b.disabled = !enabled;
  b.addEventListener('click', onClick);
  return el('div', {}, b);
};

const kindName = (k: OpeningKind) => t(k === 'door' ? 'panel.door' : 'panel.window');

function common<T>(list: readonly Opening[], get: (o: Opening) => T): T | null {
  const v = get(list[0]!);
  return list.every((o) => get(o) === v) ? v : null;
}

/** Size fields shared by the selection panel and the next-opening panel. */
function sizeRows(kind: OpeningKind | null, value: (k: keyof OpeningSize) => number | null, set: (patch: Partial<OpeningSize>) => void): HTMLElement[] {
  return [
    row(t('panel.width'), numberField(value('width'), (v) => set({ width: v }), 0.01)),
    row(t('panel.height'), numberField(value('height'), (v) => set({ height: v }), 0.01)),
    ...(kind === 'door' ? [] : [row(t('panel.sill'), numberField(value('sill'), (v) => set({ sill: v }), 0))]),
  ];
}

export function openingPanel(
  doc: Doc,
  placed: ReadonlyMap<OpeningId, OpeningSolid>,
  selected: readonly OpeningSolid[],
  warnings: readonly OpeningWarning[],
  act: OpeningPanelActions,
): HTMLElement[] {
  const list = selected.map((s) => s.opening);
  const ids = list.map((o) => o.id);
  const kind = common(list, (o) => o.kind);
  const one = selected.length === 1 ? selected[0]! : null;
  const nodes: HTMLElement[] = [];
  const kindOptions = (['door', 'window'] as const).map((k) => ({ value: k, label: kindName(k), icon: k }));
  nodes.push(
    section(
      t('panel.general'),
      true,
      row(
        t('panel.kind'),
        segmented(kindOptions, kind, (k) => act.update(ids, { kind: k, sill: k === 'door' ? 0 : OPENING_DEFAULTS.window.sill }), true),
      ),
      ...sizeRows(kind, (k) => common(list, (o) => o[k]), (patch) => act.update(ids, patch)),
    ),
  );
  if (one) {
    const o = one.opening;
    const refs = referenceCandidates(doc, o.id);
    const aligns = alignCandidates(doc, o.id);
    const ruleOptions = (['fromStart', 'fromEnd', 'centered', 'fromOpening', 'aligned', 'inGroup'] as const)
      .filter((k) => k === o.rule.kind || (k === 'fromOpening' ? refs.length > 0 : k === 'aligned' ? aligns.length > 0 : k !== 'inGroup'))
      .map((k) => ({ value: k, label: t(`rule.${k}` as MessageKey) }));
    const rows = [
      row(
        t('panel.rule'),
        select(ruleOptions, o.rule.kind, (k) => act.setRule(o.id, k, k === 'aligned' ? aligns[0]?.id : nearest(refs, one, placed))),
      ),
    ];
    // Named by kind and where it starts on its wall: short enough for the field, and unique.
    const label = (r: Opening) => `${kindName(r.kind)} · ${num(placed.get(r.id)?.start ?? 0)} m`;
    const rule = o.rule;
    if (rule.kind === 'fromOpening') {
      rows.push(row(t('panel.refOpening'), select(refs.map((r) => ({ value: r.id, label: label(r) })), rule.openingId, (id) => act.setRule(o.id, 'fromOpening', id))));
    }
    if (rule.kind === 'aligned') {
      rows.push(
        row(t('panel.alignWith'), select(aligns.map((r) => ({ value: r.id, label: label(r) })), rule.openingId, (id) => act.update(ids, { rule: { ...rule, openingId: id } }))),
        row(
          t('panel.alignBy'),
          segmented((['start', 'center', 'end'] as const).map((v) => ({ value: v, label: t(`edge.${v}`) })), rule.edge, (edge) => act.update(ids, { rule: { ...rule, edge } }), true),
        ),
      );
    }
    if (hasDistance(rule)) {
      rows.push(row(t('panel.distance'), numberField(rule.distance, (v) => act.update(ids, { rule: { ...rule, distance: v } }))));
    }
    rows.push(row(t('panel.jambs'), el('div', { class: 'readout' }, `${num(one.start)} – ${num(one.end)} m`)));
    nodes.push(section(t('panel.position'), true, ...rows));
  }
  // The group the selection is in: one member, or every selected opening in the same group.
  const groupIds = new Set(list.map((o) => (o.rule.kind === 'inGroup' ? o.rule.groupId : null)));
  const group = groupIds.size === 1 ? doc.openingGroups.find((g) => groupIds.has(g.id)) : undefined;
  if (group) nodes.push(groupSection(group, placed, act));
  if (list.length >= 2) {
    const [first, ...others] = list;
    const oneWall = list.every((o) => o.wallId === first!.wallId);
    const canAlign = others.some((o) => alignCandidates(doc, o.id).some((r) => r.id === first!.id));
    nodes.push(
      section(
        t('panel.arrange'),
        true,
        el('div', {}, el('div', { class: 'panel-note' }, t('panel.arrangeHint', { ref: `${kindName(first!.kind)} · ${num(placed.get(first!.id)?.start ?? 0)} m` }))),
        wideButton(t('panel.distribute'), () => act.distribute(ids, { kind: 'equal' }), oneWall),
        wideButton(t('panel.alignPosition'), () => act.align(first!.id, ids, 'center'), canAlign),
        wideButton(t('panel.alignHeads'), () => act.alignHeads(first!.id, ids)),
      ),
    );
  }
  if (one) {
    const o = one.opening;
    if (o.kind === 'door') {
      nodes.push(
        section(
          t('panel.door.leaf'),
          true,
          row(t('panel.hinge'), segmented((['start', 'end'] as const).map((v) => ({ value: v, label: t(`hinge.${v}`) })), o.hinge, (v) => act.update(ids, { hinge: v }))),
          row(t('panel.swing'), segmented((['left', 'right'] as const).map((v) => ({ value: v, label: t(`swing.${v}`) })), o.swing, (v) => act.update(ids, { swing: v }))),
        ),
      );
    }
  }
  const mine = warnings.filter((w) => w.openings.some((id) => ids.includes(id)));
  if (mine.length > 0) {
    const box = el('div', { class: 'warn-list', role: 'status' });
    box.innerHTML = icon('warning', 16);
    box.append(el('div', {}, ...[...new Set(mine.map((w) => w.kind))].map((k) => el('div', {}, t(`warn.${k}` as MessageKey)))));
    nodes.push(box);
  }
  return nodes;
}

/** A group's spacing: equal, or a fixed gap with the row centred or measured from one end. */
function groupSection(g: OpeningGroup, placed: ReadonlyMap<OpeningId, OpeningSolid>, act: OpeningPanelActions): HTMLElement {
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
  const rows = [
    row(t('panel.members'), el('div', { class: 'readout' }, t('panel.openings', { n: g.members.length }))),
    row(
      t('panel.spacing'),
      segmented(
        (['equal', 'fixed'] as const).map((v) => ({ value: v, label: t(`spacing.${v}`) })),
        sp.kind,
        (k) => act.setSpacing(g.id, k === 'equal' ? { kind: 'equal' } : fixed({})),
        true,
      ),
    ),
  ];
  if (sp.kind === 'fixed') {
    rows.push(
      row(t('panel.gap'), numberField(sp.gap, (v) => act.setSpacing(g.id, fixed({ gap: v })), 0)),
      row(
        t('panel.anchor'),
        select((['start', 'centered', 'end'] as const).map((v) => ({ value: v, label: t(`anchor.${v}`) })), sp.anchor, (v) => act.setSpacing(g.id, fixed({ anchor: v }))),
      ),
    );
    if (sp.anchor !== 'centered') rows.push(row(t('panel.distance'), numberField(sp.distance, (v) => act.setSpacing(g.id, fixed({ distance: v })))));
  }
  rows.push(wideButton(t('panel.ungroup'), () => act.ungroup(g.id)));
  return section(t('panel.group'), true, ...rows);
}

/** The title of the selection: one opening's kind and size, or how many. */
export function openingTitle(selected: readonly OpeningSolid[]): string {
  if (selected.length !== 1) return t('panel.openings', { n: selected.length });
  const o = selected[0]!.opening;
  return t('panel.openingSize', { kind: kindName(o.kind), w: num(o.width), h: num(o.height) });
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

export function nextOpeningPanel(kind: OpeningKind, size: OpeningSize, set: (patch: Partial<OpeningSize>) => void): HTMLElement[] {
  return [
    el('div', { class: 'panel-hint' }, t('panel.nextOpeningHint')),
    section(t('panel.general'), true, ...sizeRows(kind, (k) => size[k], set)),
  ];
}
