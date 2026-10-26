// The fields rooms and floors show in the panel (ui/fields.ts builds the rows).

import type { Field } from '../../ui/fields';
import { name, num, t } from '../../ui/i18n';
import type { RoomPatch } from './commands';
import type { FloorSolid, RoomSolid } from './derive';
import { type Floor, type FloorId, ROOM_USES, type RoomId, type RoomUse } from './schema';

export interface RoomFieldActions {
  readonly updateRoom: (id: RoomId, patch: RoomPatch) => void;
  /** The same change to all the selected rooms, one undo step. */
  readonly updateRooms: (ids: readonly RoomId[], patch: RoomPatch) => void;
  /** A level's height: a room's ceiling when it has none of its own. */
  readonly levelHeight: (levelId: string) => number;
  readonly updateFloor: (ids: readonly FloorId[], patch: Partial<Pick<Floor, 'thickness' | 'offset'>>) => void;
}

const one = <T>(xs: readonly T[]) => xs.length === 1;

export function roomFields(rooms: readonly RoomSolid[], act: RoomFieldActions): Field<RoomSolid>[] {
  const id = rooms[0]?.room.id;
  const ids = rooms.map((r) => r.room.id);
  const height = (r: RoomSolid) => r.room.height ?? act.levelHeight(r.room.levelId);
  return [
    { id: 'name', label: 'room.name', kind: 'text', when: one, get: (r) => name(r.room.name), set: (v) => id && act.updateRoom(id, { name: v }) },
    { id: 'number', label: 'room.number', kind: 'text', when: one, get: (r) => r.room.number, set: (v) => id && act.updateRoom(id, { number: v }) },
    {
      id: 'use',
      label: 'room.use',
      kind: 'select',
      options: [{ value: '', label: t('use.none') }, ...ROOM_USES.map((u) => ({ value: u, label: t(`use.${u}`) }))],
      get: (r) => r.room.use ?? '',
      set: (v) => act.updateRooms(ids, { use: v === '' ? null : (v as RoomUse) }),
    },
    {
      id: 'height',
      label: 'room.height',
      kind: 'number',
      min: 0.1,
      get: height,
      set: (v) => act.updateRooms(ids, { height: v }),
      own: (rs) => rs.some((r) => r.room.height !== undefined),
      reset: () => act.updateRooms(ids, { height: null }),
      ownWords: { reset: 'room.heightBack', note: 'room.heightOwn' },
    },
    // Several rooms: their total area.
    { id: 'area', label: 'room.area', kind: 'readout', text: (rs) => (rs.every((r) => r.enclosed) ? `${num(rs.reduce((s, r) => s + r.area, 0))} m²` : '—') },
    { id: 'perimeter', label: 'room.perimeter', kind: 'readout', when: one, text: (rs) => (rs[0]!.enclosed ? `${num(rs[0]!.perimeter)} m` : '—') },
    // Floor area times ceiling height: the air a room holds (a schedule's column too).
    { id: 'volume', label: 'room.volume', kind: 'readout', text: (rs) => (rs.every((r) => r.enclosed) ? `${num(rs.reduce((s, r) => s + r.area * height(r), 0))} m³` : '—') },
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
