// Commands on rooms and floors. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Floor, FloorId, Room, RoomId, RoomUse } from './schema';

export const addRoom = (room: Room): Command<Doc> => ({
  label: 'cmd.addRoom',
  apply: (doc) => ({ ...doc, rooms: [...doc.rooms, room] }),
});

/** A change to a room: null takes its use or its own height away (the level's height again). */
export type RoomPatch = Partial<Pick<Room, 'name' | 'number'>> & { readonly use?: RoomUse | null; readonly height?: number | null };

/** Name, number, use and own height. A blank name, or a height not above zero, changes nothing. */
export const updateRoom = (id: RoomId, patch: RoomPatch): Command<Doc> => updateRooms([id], patch);

/** The same change to several rooms, as one step. */
export const updateRooms = (ids: readonly RoomId[], patch: RoomPatch): Command<Doc> => ({
  label: 'cmd.updateRoom',
  apply: (doc) => {
    if (patch.name !== undefined && patch.name.trim() === '') return doc;
    if (patch.height !== undefined && patch.height !== null && !(patch.height > 0)) return doc;
    let changed = false;
    const rooms = doc.rooms.map((r) => {
      if (!ids.includes(r.id)) return r;
      const { use, height, ...rest } = patch;
      const { use: _u, height: _h, ...base } = r;
      const nextUse = use === undefined ? r.use : use === null ? undefined : use;
      const nextHeight = height === undefined ? r.height : height === null ? undefined : height;
      const next: Room = {
        ...base,
        ...rest,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(nextUse !== undefined ? { use: nextUse } : {}),
        ...(nextHeight !== undefined ? { height: nextHeight } : {}),
      };
      if (JSON.stringify(next) === JSON.stringify(r)) return r;
      changed = true;
      return next;
    });
    return changed ? { ...doc, rooms } : doc;
  },
});

export const addFloor = (floor: Floor): Command<Doc> => ({
  label: 'cmd.addFloor',
  apply: (doc) => ({ ...doc, floors: [...doc.floors, floor] }),
});

/** Thickness and offset. A thickness of zero or less changes nothing. */
export const updateFloor = (id: FloorId, patch: Partial<Pick<Floor, 'thickness' | 'offset'>>): Command<Doc> => ({
  label: 'cmd.updateFloor',
  apply: (doc) => {
    if (patch.thickness !== undefined && !(patch.thickness > 0)) return doc;
    if (patch.offset !== undefined && !Number.isFinite(patch.offset)) return doc;
    let changed = false;
    const floors = doc.floors.map((f) => {
      if (f.id !== id) return f;
      const next = { ...f, ...patch };
      if (JSON.stringify(next) === JSON.stringify(f)) return f;
      changed = true;
      return next;
    });
    return changed ? { ...doc, floors } : doc;
  },
});
