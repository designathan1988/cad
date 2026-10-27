// Properties of the selected doors and windows, and of the next ones the tool places, built from
// their fields (fields.ts). It only reads state and sends changes; each change is one command, so
// one undo step.

import { lengthNum, lengthText } from '../../ui/units';
import type { Doc } from '../../app/document';
import type { OpeningSolid } from '../../app/geometry';
import { el } from '../../ui/controls';
import { fieldsSection } from '../../ui/fields';
import { markPrefix, t, type MessageKey } from '../../ui/i18n';
import { icon } from '../../ui/icons';
import type { OpeningWarning } from './derive';
import type { RoomSolid } from '../room/derive';
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
  styleFields,
} from './fields';
import type { OpeningId, OpeningKind } from './schema';
import { openingMarks } from './marks';

export type { OpeningPanelActions, OpeningSize } from './fields';

export function openingPanel(
  doc: Doc,
  placed: ReadonlyMap<OpeningId, OpeningSolid>,
  selected: readonly OpeningSolid[],
  warnings: readonly OpeningWarning[],
  act: OpeningPanelActions,
  /** The rooms of the level, to name the sides a door opens to. */
  rooms: readonly RoomSolid[] = [],
): HTMLElement[] {
  const list = selected.map((s) => s.opening);
  const ids = list.map((o) => o.id);
  const one = selected.length === 1 ? selected[0]! : null;
  const marks = openingMarks(doc.openings, markPrefix());
  const nodes: HTMLElement[] = [fieldsSection(t('panel.general'), true, openingFields(selected, act.update, marks), selected)];
  if (one) nodes.push(fieldsSection(t('panel.position'), true, positionFields(doc, one, placed, act), selected));
  // The group the selection is in: one member, or every selected opening in the same group.
  const groupIds = new Set(list.map((o) => (o.rule.kind === 'inGroup' ? o.rule.groupId : null)));
  const group = groupIds.size === 1 ? doc.openingGroups.find((g) => groupIds.has(g.id)) : undefined;
  if (group) nodes.push(fieldsSection(t('panel.group'), true, groupFields(group, placed, act), [group]));
  if (list.length >= 2) nodes.push(fieldsSection(t('panel.arrange'), true, arrangeFields(doc, list, placed, act), list));
  // How they are made, when every one has a make and all are of one kind.
  if (list.every((o) => o.style) && list.every((o) => o.kind === list[0]!.kind)) nodes.push(fieldsSection(t('panel.make'), true, styleFields(selected, act.update), selected));
  // A door's leaf, or a casement window's: the side it opens to and its hinge.
  if (one && (one.opening.kind === 'door' || one.opening.style?.operation === 'casement')) nodes.push(fieldsSection(t('panel.door.leaf'), true, leafFields(one, act.update, rooms), selected));
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
  return t('panel.openingSize', { kind: kindName(o.kind), w: lengthNum(o.width), h: lengthText(o.height) });
}

export function nextOpeningPanel(kind: OpeningKind, size: OpeningSize, set: (patch: Partial<OpeningSize>) => void): HTMLElement[] {
  // Each tool keeps its own sizes: a door's do not change the next window.
  return [el('div', { class: 'panel-hint' }, t(kind === 'door' ? 'panel.nextDoorHint' : 'panel.nextWindowHint')), fieldsSection(t('panel.general'), true, nextOpeningFields(kind, set, size), [size])];
}
