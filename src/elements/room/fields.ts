// The fields rooms and floors show in the panel (ui/fields.ts builds the rows).

import type { Field } from '../../ui/fields';
import { name, num, t } from '../../ui/i18n';
import type { FloorSolid, RoomSolid } from './derive';
import type { Floor, FloorId, Room, RoomId } from './schema';

export interface RoomFieldActions {
  readonly updateRoom: (id: RoomId, patch: Partial<Pick<Room, 'name' | 'number'>>) => void;
  readonly updateFloor: (ids: readonly FloorId[], patch: Partial<Pick<Floor, 'thickness' | 'offset'>>) => void;
}

const one = <T>(xs: readonly T[]) => xs.length === 1;

export function roomFields(rooms: readonly RoomSolid[], act: RoomFieldActions): Field<RoomSolid>[] {
  const id = rooms[0]?.room.id;
  return [
    { id: 'name', label: 'room.name', kind: 'text', when: one, get: (r) => name(r.room.name), set: (v) => id && act.updateRoom(id, { name: v }) },
    { id: 'number', label: 'room.number', kind: 'text', when: one, get: (r) => r.room.number, set: (v) => id && act.updateRoom(id, { number: v }) },
    // Several rooms: their total area.
    { id: 'area', label: 'room.area', kind: 'readout', text: (rs) => (rs.every((r) => r.enclosed) ? `${num(rs.reduce((s, r) => s + r.area, 0))} m²` : '—') },
    { id: 'perimeter', label: 'room.perimeter', kind: 'readout', when: one, text: (rs) => (rs[0]!.enclosed ? `${num(rs[0]!.perimeter)} m` : '—') },
  ];
}

export function floorFields(floors: readonly FloorSolid[], roomName: (id: RoomId) => string, act: RoomFieldActions): Field<FloorSolid>[] {
  const ids = floors.map((f) => f.floor.id);
  return [
    { id: 'thickness', label: 'floor.thickness', kind: 'number', min: 0.01, get: (f) => f.floor.thickness, set: (v) => act.updateFloor(ids, { thickness: v }) },
    { id: 'offset', label: 'floor.offset', kind: 'number', get: (f) => f.floor.offset, set: (v) => act.updateFloor(ids, { offset: v }) },
    {
      id: 'source',
      label: 'floor.source',
      kind: 'readout',
      text: (fs) => {
        const sources = new Set(fs.map((f) => (f.floor.source.kind === 'room' ? roomName(f.floor.source.roomId) : t('floor.outline'))));
        return sources.size === 1 ? [...sources][0]! : t('panel.varies');
      },
    },
    { id: 'area', label: 'room.area', kind: 'readout', text: (fs) => `${num(fs.reduce((s, f) => s + f.area, 0))} m²` },
  ];
}
