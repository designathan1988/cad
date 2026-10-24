// Properties of the selected doors and windows, and of the next ones the tool places. It only reads
// state and sends changes; each change is one command, so one undo step.

import type { Doc } from '../../app/document';
import type { OpeningSolid } from '../../app/geometry';
import { el, numberField, row, section, segmented, select } from '../../ui/controls';
import { num, t, type MessageKey } from '../../ui/i18n';
import { icon } from '../../ui/icons';
import { referenceCandidates } from './commands';
import type { OpeningWarning } from './derive';
import { OPENING_DEFAULTS, type Opening, type OpeningId, type OpeningKind, type RuleKind } from './schema';

export type OpeningSize = { readonly width: number; readonly height: number; readonly sill: number };

export interface OpeningPanelActions {
  readonly update: (ids: readonly OpeningId[], patch: Partial<Omit<Opening, 'id'>>) => void;
  /** A new kind of rule for one opening, keeping it where it is. */
  readonly setRule: (id: OpeningId, kind: RuleKind, referenceId?: OpeningId) => void;
}

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
    const ruleOptions = (['fromStart', 'fromEnd', 'centered', 'fromOpening'] as const)
      .filter((k) => k !== 'fromOpening' || refs.length > 0 || o.rule.kind === 'fromOpening')
      .map((k) => ({ value: k, label: t(`rule.${k}` as MessageKey) }));
    const rows = [row(t('panel.rule'), select(ruleOptions, o.rule.kind, (k) => act.setRule(o.id, k, nearest(refs, one, placed))))];
    if (o.rule.kind === 'fromOpening') {
      // Named by kind and where it starts on the wall: short enough for the field, and unique.
      const label = (r: Opening) => `${kindName(r.kind)} · ${num(placed.get(r.id)?.start ?? 0)} m`;
      rows.push(row(t('panel.refOpening'), select(refs.map((r) => ({ value: r.id, label: label(r) })), o.rule.openingId, (id) => act.setRule(o.id, 'fromOpening', id))));
    }
    if (o.rule.kind !== 'centered') {
      const rule = o.rule;
      rows.push(row(t('panel.distance'), numberField(rule.distance, (v) => act.update(ids, { rule: { ...rule, distance: v } }))));
    }
    rows.push(row(t('panel.jambs'), el('div', { class: 'readout' }, `${num(one.start)} – ${num(one.end)} m`)));
    nodes.push(section(t('panel.position'), true, ...rows));
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
