import { describe, expect, it } from 'vitest';
import { type Doc, newDocument } from '../../../src/app/document';
import { createStore } from '../../../src/core/store';
import { vec } from '../../../src/core/vector';
import { addFloor, addRoom, updateFloor, updateRoom } from '../../../src/elements/room/commands';

const room = { id: 'r', levelId: 'lvl_ground', seed: vec(4, 3), name: 'Room 1', number: '1' };
const floor = { id: 'f', levelId: 'lvl_ground', source: { kind: 'room' as const, roomId: 'r' }, thickness: 0.15, offset: 0 };

describe('room and floor commands', () => {
  it('add and edit a room, each one undo step', () => {
    const s = createStore<Doc>(newDocument());
    s.dispatch(addRoom(room));
    s.dispatch(updateRoom('r', { name: 'Kitchen', number: '101' }));
    expect(s.get().rooms[0]).toMatchObject({ name: 'Kitchen', number: '101' });
    s.undo();
    expect(s.get().rooms[0]!.name).toBe('Room 1');
  });

  it('a blank room name is refused; no change, no step', () => {
    const s = createStore<Doc>({ ...newDocument(), rooms: [room] });
    s.dispatch(updateRoom('r', { name: '  ' }));
    expect(s.canUndo()).toBe(false);
  });

  it('a floor: add, thickness and offset; a thickness of zero is refused', () => {
    const s = createStore<Doc>({ ...newDocument(), rooms: [room] });
    s.dispatch(addFloor(floor));
    s.dispatch(updateFloor('f', { thickness: 0.2, offset: -0.05 }));
    expect(s.get().floors[0]).toMatchObject({ thickness: 0.2, offset: -0.05 });
    s.dispatch(updateFloor('f', { thickness: 0 }));
    expect(s.get().floors[0]!.thickness).toBe(0.2);
  });
});
