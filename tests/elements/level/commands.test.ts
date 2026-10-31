import type { ColumnId } from '../../../src/elements/column/schema';
import { describe, expect, it } from 'vitest';
import { cutHeightOf, type Doc, type DocWall, newDocument, wallHeights } from '../../../src/project/doc';
import { createStore } from '../../../src/core/store';
import { vec } from '../../../src/model/vector';
import { addLevel, deleteBlocker, deleteLevel, levelOverlaps, updateLevel } from '../../../src/elements/level/commands';
import type { WallId } from '../../../src/elements/wall/schema';
import { lid, tid, wid, xid } from '../../ids';
import type { LevelId } from '../../../src/project/doc';

const wall = (id: WallId, levelId: LevelId): DocWall => ({
  id,
  wallTypeId: tid('wt_masonry15'),
  start: vec(0, 0),
  end: vec(4, 0),
  referenceLine: 'centerline',
  levelId,
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

describe('levels', () => {
  it('a new level goes on top of the highest one, with the same height', () => {
    const s = createStore(newDocument());
    s.dispatch(addLevel(lid('lvl_1'), 'Level 1'));
    const l = s.get().levels.find((x) => x.id === 'lvl_1')!;
    expect(l).toEqual({ id: lid('lvl_1'), name: 'Level 1', elevation: 2.8, height: 2.8 });
    s.dispatch(updateLevel(lid('lvl_1'), { height: 3 }));
    s.dispatch(addLevel(lid('lvl_2'), 'Level 2'));
    expect(s.get().levels.find((x) => x.id === 'lvl_2')!.elevation).toBeCloseTo(5.8, 12);
  });

  it('rename, elevation and height change; walls on it follow because their heights are derived', () => {
    const s = createStore<Doc>({ ...newDocument(), walls: [wall(wid('w'), lid('lvl_ground'))] });
    s.dispatch(updateLevel(lid('lvl_ground'), { name: 'Térreo', elevation: 0.5, height: 3 }));
    const doc = s.get();
    expect(doc.levels[0]!.name).toBe('Térreo');
    expect(wallHeights(doc, doc.walls[0]!)).toEqual({ bottom: 0.5, top: 3.5 });
  });

  it('a height of zero or less, or a blank name, is refused: no change, no undo step', () => {
    const s = createStore(newDocument());
    s.dispatch(updateLevel(lid('lvl_ground'), { height: 0 }));
    s.dispatch(updateLevel(lid('lvl_ground'), { name: '   ' }));
    expect(s.canUndo()).toBe(false);
  });

  it('the cut height: 1.20 m when not set, changed by a command, zero or less refused', () => {
    const s = createStore(newDocument());
    expect(cutHeightOf(s.get().levels[0]!)).toBe(1.2);
    s.dispatch(updateLevel(lid('lvl_ground'), { cutHeight: 0 }));
    s.dispatch(updateLevel(lid('lvl_ground'), { cutHeight: -1 }));
    expect(s.canUndo()).toBe(false);
    s.dispatch(updateLevel(lid('lvl_ground'), { cutHeight: 1.5 }));
    expect(cutHeightOf(s.get().levels[0]!)).toBe(1.5);
    // A new level on top takes the highest one's cut height, as it takes its height.
    s.dispatch(addLevel(lid('lvl_1'), 'Level 1'));
    expect(cutHeightOf(s.get().levels.find((x) => x.id === 'lvl_1')!)).toBe(1.5);
  });

  it('deleting: refused for the last level and for a level that still has walls', () => {
    const s = createStore<Doc>({ ...newDocument(), walls: [wall(wid('w'), lid('lvl_ground'))] });
    s.dispatch(deleteLevel(lid('lvl_ground')));
    expect(s.get().levels).toHaveLength(1);
    s.dispatch(addLevel(lid('lvl_1'), 'Level 1'));
    s.dispatch(deleteLevel(lid('lvl_ground')));
    expect(s.get().levels).toHaveLength(2);
    s.dispatch(deleteLevel(lid('lvl_1')));
    expect(s.get().levels.map((l) => l.id)).toEqual(['lvl_ground']);
    s.undo();
    expect(s.get().levels).toHaveLength(2);
  });
});

describe('level checks', () => {
  it('a level reaching above the bottom of the next one is reported, with that level', () => {
    let doc = addLevel(lid('lvl_up'), 'Upper').apply(newDocument());
    expect(levelOverlaps(doc)).toEqual([]);
    doc = updateLevel(lid('lvl_ground'), { height: 3 }).apply(doc);
    // Ground 0 + 3.00 reaches 0.20 above Upper at 2.80.
    expect(levelOverlaps(doc)).toEqual([{ levelId: lid('lvl_ground'), aboveId: 'lvl_up', by: expect.closeTo(0.2, 12) }]);
  });

  it('why a level cannot be deleted: the last one, or walls on it', () => {
    const one = newDocument();
    expect(deleteBlocker(one, lid('lvl_ground'))).toBe('last');
    const two = { ...addLevel(lid('lvl_up'), 'Upper').apply(one), walls: [wall(wid('w'), lid('lvl_up'))] };
    expect(deleteBlocker(two, lid('lvl_up'))).toBe('walls');
    expect(deleteBlocker(two, lid('lvl_ground'))).toBeNull();
  });

  it('a level with other elements on it (a column) cannot be deleted either: they would be left on no level', () => {
    const doc = addLevel(lid('lvl_up'), 'Upper').apply(newDocument());
    const column = { id: xid<ColumnId>('column_a'), levelId: lid('lvl_up'), at: { x: 0, y: 0 }, width: 0.25, depth: 0.25, angle: 0 };
    expect(deleteBlocker({ ...doc, columns: [column] }, lid('lvl_up'))).toBe('elements');
    expect(deleteLevel(lid('lvl_up')).apply({ ...doc, columns: [column] }).levels).toHaveLength(2);
  });

  it('a column up to a deleted level keeps its top, now from its own level', () => {
    const doc = addLevel(lid('lvl_up'), 'Upper').apply(newDocument());
    const column = { id: xid<ColumnId>('column_a'), levelId: lid('lvl_ground'), at: { x: 0, y: 0 }, width: 0.25, depth: 0.25, angle: 0, topLevelId: lid('lvl_up'), topOffset: 0.1 };
    const next = deleteLevel(lid('lvl_up')).apply({ ...doc, columns: [column] });
    const c = next.columns[0]!;
    expect(c.topLevelId).toBeUndefined();
    // Upper's floor at 2.80 + 0.10, from the ground's top at 2.80: 0.10.
    expect(c.topOffset).toBeCloseTo(0.1, 12);
  });
});
