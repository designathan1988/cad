// Properties of the selected rooms and floors. It only reads state and sends changes.

import { el, numberField, row, section } from '../../ui/controls';
import { name, num, t } from '../../ui/i18n';
import { icon } from '../../ui/icons';
import type { FloorSolid, RoomSolid } from './derive';
import type { Floor, FloorId, Room, RoomId } from './schema';

export interface RoomPanelActions {
  readonly updateRoom: (id: RoomId, patch: Partial<Pick<Room, 'name' | 'number'>>) => void;
  readonly updateFloor: (ids: readonly FloorId[], patch: Partial<Pick<Floor, 'thickness' | 'offset'>>) => void;
}

/** A text field that commits on Enter or leaving, and restores on Esc. */
function textField(value: string, onCommit: (v: string) => void): HTMLElement {
  const input = el('input', { type: 'text', class: 'text-field', autocomplete: 'off', spellcheck: 'false' });
  input.value = value;
  const commit = () => {
    if (input.value !== value) onCommit(input.value);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = value;
      input.blur();
    }
  });
  input.addEventListener('blur', commit);
  return el('div', { class: 'num-field' }, input);
}

const readout = (text: string) => el('div', { class: 'readout' }, text);

export function roomPanel(rooms: readonly RoomSolid[], act: RoomPanelActions): HTMLElement[] {
  if (rooms.length !== 1) {
    const area = rooms.reduce((s, r) => s + r.area, 0);
    return [section(t('panel.general'), true, row(t('room.area'), readout(`${num(area)} m²`)))];
  }
  const r = rooms[0]!;
  const nodes: HTMLElement[] = [
    section(
      t('panel.general'),
      true,
      row(t('room.name'), textField(name(r.room.name), (v) => act.updateRoom(r.room.id, { name: v }))),
      row(t('room.number'), textField(r.room.number, (v) => act.updateRoom(r.room.id, { number: v }))),
      row(t('room.area'), readout(r.enclosed ? `${num(r.area)} m²` : '—')),
      row(t('room.perimeter'), readout(r.enclosed ? `${num(r.perimeter)} m` : '—')),
    ),
  ];
  if (!r.enclosed) {
    const box = el('div', { class: 'warn-list', role: 'status' });
    box.innerHTML = icon('warning', 16);
    box.append(el('div', {}, t('warn.roomNotEnclosed')));
    nodes.push(box);
  }
  return nodes;
}

export function floorPanel(floors: readonly FloorSolid[], roomName: (id: RoomId) => string, act: RoomPanelActions): HTMLElement[] {
  const ids = floors.map((f) => f.floor.id);
  const same = <T>(get: (f: Floor) => T): T | null => {
    const v = get(floors[0]!.floor);
    return floors.every((f) => get(f.floor) === v) ? v : null;
  };
  const source = floors.length === 1 ? floors[0]!.floor.source : null;
  return [
    section(
      t('panel.general'),
      true,
      row(t('floor.thickness'), numberField(same((f) => f.thickness), (v) => act.updateFloor(ids, { thickness: v }), 0.01)),
      row(t('floor.offset'), numberField(same((f) => f.offset), (v) => act.updateFloor(ids, { offset: v }))),
      row(
        t('floor.source'),
        readout(source === null ? t('panel.varies') : source.kind === 'room' ? roomName(source.roomId) : t('floor.outline')),
      ),
      row(t('room.area'), readout(`${num(floors.reduce((s, f) => s + f.area, 0))} m²`)),
    ),
  ];
}
