import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument, wallHeights } from '../../../src/app/document';
import { createStore } from '../../../src/core/store';
import { vec } from '../../../src/core/vector';
import { addLevel, deleteLevel, updateLevel } from '../../../src/elements/level/commands';

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
