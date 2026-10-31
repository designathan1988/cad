import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { createStore } from '../../src/core/store';
import { addWalls, updateWalls } from '../../src/elements/wall/commands';
import { lid, tid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';
import { deleteElements } from '../../src/elements/opening/commands';

const wall = (id: WallId, x: number) => ({
  id,
  wallTypeId: tid('wt_masonry15'),
  start: { x, y: 0 },
  end: { x: x + 1, y: 0 },
  referenceLine: 'centerline' as const,
  levelId: lid('lvl_ground'),
  baseOffset: 0,
  top: { kind: 'level' as const, offset: 0 },
});

describe('store', () => {
  it('each command is one undo step; redo comes back', () => {
    const s = createStore(newDocument());
    s.dispatch(addWalls([wall(wid('a'), 0), wall(wid('b'), 2)]));
    s.dispatch(updateWalls([wid('a')], { referenceLine: 'exteriorFace' }));
    expect(s.get().walls[0]!.referenceLine).toBe('exteriorFace');
    s.undo();
    expect(s.get().walls[0]!.referenceLine).toBe('centerline');
    s.undo();
    expect(s.get().walls).toHaveLength(0);
    s.redo();
    expect(s.get().walls).toHaveLength(2);
  });

  it('a command that changes nothing adds no undo step', () => {
    const s = createStore(newDocument());
    s.dispatch(deleteElements([wid('missing')]));
    s.dispatch(updateWalls([], { baseOffset: 1 }));
    expect(s.canUndo()).toBe(false);
  });

  it('a new command clears redo', () => {
    const s = createStore(newDocument());
    s.dispatch(addWalls([wall(wid('a'), 0)]));
    s.undo();
    s.dispatch(addWalls([wall(wid('b'), 0)]));
    expect(s.canRedo()).toBe(false);
  });

  it('any sequence of commands, undone, gives back the original document', () => {
    const cmd = fc.oneof(
      fc.nat(9).map((i) => addWalls([wall(wid(`w${i}`), i)])),
      fc.nat(9).map((i) => deleteElements([wid(`w${i}`)])),
      fc.tuple(fc.nat(9), fc.double({ min: -1, max: 1, noNaN: true })).map(([i, o]) => updateWalls([wid(`w${i}`)], { baseOffset: o })),
    );
    fc.assert(
      fc.property(fc.array(cmd, { maxLength: 30 }), (cmds) => {
        const start = newDocument();
        const s = createStore(start);
        cmds.forEach((c) => s.dispatch(c));
        while (s.undo());
        expect(s.get()).toBe(start);
      }),
      { numRuns: 200, seed: 20261024 },
    );
  });
  it('names what an undo and a redo would take back: the label of that step', () => {
    const s = createStore(newDocument());
    expect(s.undoLabel()).toBeNull();
    s.dispatch(addWalls([wall(wid('a'), 0)]));
    s.dispatch(deleteElements([wid('a')]));
    expect(s.undoLabel()).toBe('cmd.deleteElements');
    s.undo();
    expect([s.undoLabel(), s.redoLabel()]).toEqual(['cmd.addWalls', 'cmd.deleteElements']);
    s.redo();
    expect([s.undoLabel(), s.redoLabel()]).toEqual(['cmd.deleteElements', null]);
  });
});
