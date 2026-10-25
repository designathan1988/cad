import { describe, expect, it } from 'vitest';
import { cutHeightOf, type Doc, type DocWall, newDocument, wallHeights } from '../../../src/app/document';
import { createStore } from '../../../src/core/store';
import { vec } from '../../../src/core/vector';
import { addLevel, deleteBlocker, deleteLevel, levelOverlaps, updateLevel } from '../../../src/elements/level/commands';

const wall = (id: string, levelId: string): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
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
    s.dispatch(addLevel('lvl_1', 'Level 1'));
    const l = s.get().levels.find((x) => x.id === 'lvl_1')!;
    expect(l).toEqual({ id: 'lvl_1', name: 'Level 1', elevation: 2.8, height: 2.8 });
    s.dispatch(updateLevel('lvl_1', { height: 3 }));
    s.dispatch(addLevel('lvl_2', 'Level 2'));
    expect(s.get().levels.find((x) => x.id === 'lvl_2')!.elevation).toBeCloseTo(5.8, 12);
  });

  it('rename, elevation and height change; walls on it follow because their heights are derived', () => {
    const s = createStore<Doc>({ ...newDocument(), walls: [wall('w', 'lvl_ground')] });
    s.dispatch(updateLevel('lvl_ground', { name: 'Térreo', elevation: 0.5, height: 3 }));
    const doc = s.get();
    expect(doc.levels[0]!.name).toBe('Térreo');
    expect(wallHeights(doc, doc.walls[0]!)).toEqual({ bottom: 0.5, top: 3.5 });
  });

  it('a height of zero or less, or a blank name, is refused: no change, no undo step', () => {
    const s = createStore(newDocument());
    s.dispatch(updateLevel('lvl_ground', { height: 0 }));
    s.dispatch(updateLevel('lvl_ground', { name: '   ' }));
    expect(s.canUndo()).toBe(false);
  });

  it('the cut height: 1.20 m when not set, changed by a command, zero or less refused', () => {
    const s = createStore(newDocument());
    expect(cutHeightOf(s.get().levels[0]!)).toBe(1.2);
    s.dispatch(updateLevel('lvl_ground', { cutHeight: 0 }));
    s.dispatch(updateLevel('lvl_ground', { cutHeight: -1 }));
    expect(s.canUndo()).toBe(false);
    s.dispatch(updateLevel('lvl_ground', { cutHeight: 1.5 }));
    expect(cutHeightOf(s.get().levels[0]!)).toBe(1.5);
    // A new level on top takes the highest one's cut height, as it takes its height.
    s.dispatch(addLevel('lvl_1', 'Level 1'));
    expect(cutHeightOf(s.get().levels.find((x) => x.id === 'lvl_1')!)).toBe(1.5);
  });

  it('deleting: refused for the last level and for a level that still has walls', () => {
    const s = createStore<Doc>({ ...newDocument(), walls: [wall('w', 'lvl_ground')] });
    s.dispatch(deleteLevel('lvl_ground'));
    expect(s.get().levels).toHaveLength(1);
    s.dispatch(addLevel('lvl_1', 'Level 1'));
    s.dispatch(deleteLevel('lvl_ground'));
    expect(s.get().levels).toHaveLength(2);
    s.dispatch(deleteLevel('lvl_1'));
    expect(s.get().levels.map((l) => l.id)).toEqual(['lvl_ground']);
    s.undo();
    expect(s.get().levels).toHaveLength(2);
  });
});

describe('level checks', () => {
  it('a level reaching above the bottom of the next one is reported, with that level', () => {
    let doc = addLevel('lvl_up', 'Upper').apply(newDocument());
    expect(levelOverlaps(doc)).toEqual([]);
    doc = updateLevel('lvl_ground', { height: 3 }).apply(doc);
    // Ground 0 + 3.00 reaches 0.20 above Upper at 2.80.
    expect(levelOverlaps(doc)).toEqual([{ levelId: 'lvl_ground', aboveId: 'lvl_up', by: expect.closeTo(0.2, 12) }]);
  });

  it('why a level cannot be deleted: the last one, or walls on it', () => {
    const one = newDocument();
    expect(deleteBlocker(one, 'lvl_ground')).toBe('last');
    const two = { ...addLevel('lvl_up', 'Upper').apply(one), walls: [wall('w', 'lvl_up')] };
    expect(deleteBlocker(two, 'lvl_up')).toBe('walls');
    expect(deleteBlocker(two, 'lvl_ground')).toBeNull();
  });
});
