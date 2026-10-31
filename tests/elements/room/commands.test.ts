import { describe, expect, it } from 'vitest';
import { type Doc, newDocument } from '../../../src/project/doc';
import { createStore } from '../../../src/core/store';
import { vec } from '../../../src/model/vector';
import { addFloor, addRoom, updateFloor, updateRoom, updateRooms } from '../../../src/elements/room/commands';
import { readProject, writeProject } from '../../../src/project/file';
import { fid, rid } from '../../ids';

const room = { id: rid('r'), levelId: 'lvl_ground', seed: vec(4, 3), name: 'Room 1', number: '1' };
const floor = { id: fid('f'), levelId: 'lvl_ground', source: { kind: 'room' as const, roomId: rid('r') }, thickness: 0.15, offset: 0 };

describe('room and floor commands', () => {
  it('add and edit a room, each one undo step', () => {
    const s = createStore<Doc>(newDocument());
    s.dispatch(addRoom(room));
    s.dispatch(updateRoom(rid('r'), { name: 'Kitchen', number: '101' }));
    expect(s.get().rooms[0]).toMatchObject({ name: 'Kitchen', number: '101' });
    s.undo();
    expect(s.get().rooms[0]!.name).toBe('Room 1');
  });

  it("use and own height, for several rooms in one step; null gives back none and the level's height", () => {
    const other = { ...room, id: rid('q'), name: 'Room 2', number: '2' };
    const s = createStore<Doc>({ ...newDocument(), rooms: [room, other] });
    s.dispatch(updateRooms([rid('r'), rid('q')], { use: 'bedroom', height: 2.6 }));
    expect(s.get().rooms.map((r) => [r.use, r.height])).toEqual([
      ['bedroom', 2.6],
      ['bedroom', 2.6],
    ]);
    s.dispatch(updateRoom(rid('q'), { use: null, height: null }));
    expect(s.get().rooms[1]).not.toHaveProperty('use');
    expect(s.get().rooms[1]).not.toHaveProperty('height');
    // A height not above zero changes nothing.
    s.dispatch(updateRoom(rid('r'), { height: 0 }));
    expect(s.get().rooms[0]!.height).toBe(2.6);
    s.undo();
    s.undo();
    expect(s.get().rooms.every((r) => r.use === undefined && r.height === undefined)).toBe(true);
  });

  it('use and height are read back from the file; an unknown use or a height of zero drops the room, and says so', () => {
    const doc: Doc = { ...newDocument(), rooms: [{ ...room, use: 'kitchen', height: 2.7 }] };
    const back = readProject(writeProject(doc));
    expect(back.ok && back.doc.rooms[0]).toMatchObject({ use: 'kitchen', height: 2.7 });
    for (const bad of [{ use: 'ballroom' }, { height: 0 }]) {
      const r = readProject(JSON.stringify({ ...doc, rooms: [{ ...room, ...bad }] }));
      expect(r.ok && r.doc.rooms).toEqual([]);
      expect(r.ok && r.fixes.some((f) => f.kind === 'droppedRooms')).toBe(true);
    }
  });

  it('a blank room name is refused; no change, no step', () => {
    const s = createStore<Doc>({ ...newDocument(), rooms: [room] });
    s.dispatch(updateRoom(rid('r'), { name: '  ' }));
    expect(s.canUndo()).toBe(false);
  });

  it('a floor: add, thickness and offset; a thickness of zero is refused', () => {
    const s = createStore<Doc>({ ...newDocument(), rooms: [room] });
    s.dispatch(addFloor(floor));
    s.dispatch(updateFloor(fid('f'), { thickness: 0.2, offset: -0.05 }));
    expect(s.get().floors[0]).toMatchObject({ thickness: 0.2, offset: -0.05 });
    s.dispatch(updateFloor(fid('f'), { thickness: 0 }));
    expect(s.get().floors[0]!.thickness).toBe(0.2);
  });
});
