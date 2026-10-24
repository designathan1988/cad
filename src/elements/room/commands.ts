// Commands on rooms and floors. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Floor, FloorId, Room, RoomId } from './schema';

export const addRoom = (room: Room): Command<Doc> => ({
  label: 'cmd.addRoom',
  apply: (doc) => ({ ...doc, rooms: [...doc.rooms, room] }),
});

/** Name and number. A blank name changes nothing. */
export const updateRoom = (id: RoomId, patch: Partial<Pick<Room, 'name' | 'number'>>): Command<Doc> => ({
  label: 'cmd.updateRoom',
  apply: (doc) => {
    if (patch.name !== undefined && patch.name.trim() === '') return doc;
    let changed = false;
    const rooms = doc.rooms.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) };
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
