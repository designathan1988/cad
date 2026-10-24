// Properties of the selected doors and windows, and of the next ones the tool places, built from
// their fields (fields.ts). It only reads state and sends changes; each change is one command, so
// one undo step.

import type { Doc } from '../../app/document';
import type { OpeningSolid } from '../../app/geometry';
import { el } from '../../ui/controls';
import { fieldsSection } from '../../ui/fields';
import { num, t, type MessageKey } from '../../ui/i18n';
import { icon } from '../../ui/icons';
import type { OpeningWarning } from './derive';
import {
  arrangeFields,
  groupFields,
  kindName,
  leafFields,
  nextOpeningFields,
  openingFields,
  type OpeningPanelActions,
  type OpeningSize,
  positionFields,
} from './fields';
import type { OpeningId, OpeningKind } from './schema';

export type { OpeningPanelActions, OpeningSize } from './fields';

export function openingPanel(
  doc: Doc,
  placed: ReadonlyMap<OpeningId, OpeningSolid>,
  selected: readonly OpeningSolid[],
  warnings: readonly OpeningWarning[],
  act: OpeningPanelActions,
): HTMLElement[] {
  const list = selected.map((s) => s.opening);
  const ids = list.map((o) => o.id);
  const one = selected.length === 1 ? selected[0]! : null;
  const nodes: HTMLElement[] = [fieldsSection(t('panel.general'), true, openingFields(selected, act.update), selected)];
  if (one) nodes.push(fieldsSection(t('panel.position'), true, positionFields(doc, one, placed, act), selected));
  // The group the selection is in: one member, or every selected opening in the same group.
  const groupIds = new Set(list.map((o) => (o.rule.kind === 'inGroup' ? o.rule.groupId : null)));
  const group = groupIds.size === 1 ? doc.openingGroups.find((g) => groupIds.has(g.id)) : undefined;
  if (group) nodes.push(fieldsSection(t('panel.group'), true, groupFields(group, placed, act), [group]));
  if (list.length >= 2) nodes.push(fieldsSection(t('panel.arrange'), true, arrangeFields(doc, list, placed, act), list));
  if (one && one.opening.kind === 'door') nodes.push(fieldsSection(t('panel.door.leaf'), true, leafFields(one, act.update), selected));
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

export function nextOpeningPanel(kind: OpeningKind, size: OpeningSize, set: (patch: Partial<OpeningSize>) => void): HTMLElement[] {
  return [el('div', { class: 'panel-hint' }, t('panel.nextOpeningHint')), fieldsSection(t('panel.general'), true, nextOpeningFields(kind, set), [size])];
}
