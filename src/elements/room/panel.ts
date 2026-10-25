// Properties of the selected rooms and floors, built from their fields (fields.ts). It only reads
// state and sends changes.

import { el } from '../../ui/controls';
import { fieldsSection } from '../../ui/fields';
import { t } from '../../ui/i18n';
import { icon } from '../../ui/icons';
import type { FloorSolid, RoomSolid } from './derive';
import { floorFields, type RoomFieldActions, roomFields } from './fields';
import type { RoomId } from './schema';

export type RoomPanelActions = RoomFieldActions;

/** `tag`: how a room is named on its plan tag ("2 · Bedroom"), for a room sharing this one's space. */
export function roomPanel(rooms: readonly RoomSolid[], act: RoomPanelActions, tag: (id: RoomId) => string): HTMLElement[] {
  const nodes: HTMLElement[] = [fieldsSection(t('panel.general'), true, roomFields(rooms, act), rooms)];
  const one = rooms.length === 1 ? rooms[0]! : null;
  const problem = one && !one.enclosed ? t('warn.roomNotEnclosed') : one && one.sharing.length > 0 ? t('warn.roomShared', { rooms: one.sharing.map(tag).join(', ') }) : null;
  if (problem) {
    const box = el('div', { class: 'warn-list', role: 'status' });
    box.innerHTML = icon('warning', 16);
    box.append(el('div', {}, problem));
    nodes.push(box);
  }
  return nodes;
}

export function floorPanel(floors: readonly FloorSolid[], roomName: (id: RoomId) => string, act: RoomPanelActions): HTMLElement[] {
  return [fieldsSection(t('panel.general'), true, floorFields(floors, roomName, act), floors)];
}
