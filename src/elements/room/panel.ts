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

export function roomPanel(rooms: readonly RoomSolid[], act: RoomPanelActions): HTMLElement[] {
  const nodes: HTMLElement[] = [fieldsSection(t('panel.general'), true, roomFields(rooms, act), rooms)];
  if (rooms.length === 1 && !rooms[0]!.enclosed) {
    const box = el('div', { class: 'warn-list', role: 'status' });
    box.innerHTML = icon('warning', 16);
    box.append(el('div', {}, t('warn.roomNotEnclosed')));
    nodes.push(box);
  }
  return nodes;
}

export function floorPanel(floors: readonly FloorSolid[], roomName: (id: RoomId) => string, act: RoomPanelActions): HTMLElement[] {
  return [fieldsSection(t('panel.general'), true, floorFields(floors, roomName, act), floors)];
}
