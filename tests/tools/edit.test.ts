// Moving and stretching walls keeps their joins: corners follow, abutting ends slide to stay on the
// moved host. Every expected point is worked out by hand.

import { describe, expect, it } from 'vitest';
import { newDocument, type DocWall } from '../../src/app/document';
import { vec } from '../../src/core/vector';
import { moveWalls, rotateWalls, stretchAlong, stretchEnd } from '../../src/tools/edit';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: vec(a[0], a[1]),
  end: vec(b[0], b[1]),
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// 8 × 6 room, counter-clockwise, with a divider from the bottom wall's middle to the top wall's.
const room = () => ({
  ...newDocument(),
  walls: [
    wall('w0', [0, 0], [8, 0]),
    wall('w1', [8, 0], [8, 6]),
    wall('w2', [8, 6], [0, 6]),
    wall('w3', [0, 6], [0, 0]),
    wall('d', [4, 0], [4, 6]),
  ],
});
const byId = (ws: readonly DocWall[], id: string) => ws.find((w) => w.id === id)!;

describe('moving walls', () => {
  it('moves the selected walls by the offset', () => {
    const ws = moveWalls(room(), ['d'], vec(1, 0));
    expect(byId(ws, 'd').start).toEqual(vec(5, 0));
    expect(byId(ws, 'd').end).toEqual(vec(5, 6));
  });

  it('moving the right wall drags the corners: w0 and w2 stretch, the room stays closed', () => {
    const ws = moveWalls(room(), ['w1'], vec(2, 0));
    expect(byId(ws, 'w1').start).toEqual(vec(10, 0));
    expect(byId(ws, 'w0').end).toEqual(vec(10, 0));
    expect(byId(ws, 'w2').start).toEqual(vec(10, 6));
    expect(byId(ws, 'w0').start).toEqual(vec(0, 0));
  });

  it('moving the top wall up: the divider abutting it slides along itself to stay on it', () => {
    const ws = moveWalls(room(), ['w2'], vec(0.5, 1));
    // w2 is now y = 7; the divider runs along x = 4, so its top end goes to (4, 7), not (4.5, 7).
    expect(byId(ws, 'd').end).toEqual(vec(4, 7));
    expect(byId(ws, 'd').start).toEqual(vec(4, 0));
  });

  it('moved up and a little across, the top wall keeps its corners square: w1 and w3 keep their lines', () => {
    const ws = moveWalls(room(), ['w2'], vec(0.5, 1));
    const at = (p: { x: number; y: number }, x: number, y: number) => {
      expect(p.x).toBeCloseTo(x, 9);
      expect(p.y).toBeCloseTo(y, 9);
    };
    // The side walls stay at x = 8 and x = 0 and stretch to y = 7; w2 runs between them, from (8, 7) to (0, 7).
    at(byId(ws, 'w1').end, 8, 7);
    at(byId(ws, 'w3').start, 0, 7);
    at(byId(ws, 'w2').start, 8, 7);
    at(byId(ws, 'w2').end, 0, 7);
  });

  it('moving the whole room moves everything once, nothing stretched twice', () => {
    const ws = moveWalls(room(), ['w0', 'w1', 'w2', 'w3', 'd'], vec(1, 1));
    expect(byId(ws, 'w0').start).toEqual(vec(1, 1));
    expect(byId(ws, 'd').end).toEqual(vec(5, 7));
  });

  it('a wall not touching the moved ones is left alone', () => {
    const doc = { ...room(), walls: [...room().walls, wall('far', [20, 0], [25, 0])] };
    expect(byId(moveWalls(doc, ['w1'], vec(1, 0)), 'far')).toEqual(byId(doc.walls, 'far'));
  });
});

describe('stretching an end', () => {
  it('moves that end and the ends meeting it', () => {
    const ws = stretchEnd(room(), 'w1', 'end', vec(9, 7));
    expect(byId(ws, 'w1').end).toEqual(vec(9, 7));
    expect(byId(ws, 'w2').start).toEqual(vec(9, 7));
    expect(byId(ws, 'w1').start).toEqual(vec(8, 0));
  });

  it('a stretched host keeps its abutting walls on it where they still meet it', () => {
    // Lengthening the bottom wall to x = 10 does not move the divider at x = 4.
    const ws = stretchEnd(room(), 'w0', 'end', vec(10, 0));
    expect(byId(ws, 'd').start).toEqual(vec(4, 0));
  });
});

describe('rotate and stretch along', () => {
  const at = (walls: readonly DocWall[], id: string) => walls.find((w) => w.id === id)!;
  const close = (p: { x: number; y: number }, x: number, y: number) => {
    expect(p.x).toBeCloseTo(x, 9);
    expect(p.y).toBeCloseTo(y, 9);
  };

  it('rotating the divider 90° about its middle (4, 3): it lies from (7, 3) to (1, 3)', () => {
    const walls = rotateWalls(room(), ['d'], vec(4, 3), Math.PI / 2);
    close(at(walls, 'd').start, 7, 3);
    close(at(walls, 'd').end, 1, 3);
  });

  it('rotating the whole room 90° about the origin turns every wall, corners kept', () => {
    const walls = rotateWalls(room(), ['w0', 'w1', 'w2', 'w3', 'd'], vec(0, 0), Math.PI / 2);
    close(at(walls, 'w0').end, 0, 8);
    close(at(walls, 'w1').start, 0, 8);
    close(at(walls, 'w2').end, -6, 0);
  });

  it('rotating one wall drags the corners it shares: w1 turned about (8, 0) by 90° takes w2 with it', () => {
    const walls = rotateWalls(room(), ['w1'], vec(8, 0), Math.PI / 2);
    close(at(walls, 'w1').end, 2, 0);
    close(at(walls, 'w2').start, 2, 0);
  });

  it('stretching along: the end moves on the wall line only, to the foot of the cursor', () => {
    const walls = stretchAlong(room(), 'w0', 'end', vec(10, 3));
    expect(at(walls, 'w0').end).toEqual(vec(10, 0));
    // The corner follows.
    expect(at(walls, 'w1').start).toEqual(vec(10, 0));
  });
});

describe('walls of another level are not joined', () => {
  // The room's right wall on the ground floor, and one of the upper level standing on it: same ends.
  const upper = { ...wall('u', [8, 0], [8, 6]), levelId: 'lvl_up' };
  const twoLevels = () => {
    const d = room();
    return { ...d, levels: [...d.levels, { id: 'lvl_up', name: 'Upper', elevation: 2.8, height: 2.8 }], walls: [...d.walls, upper] };
  };

  it('moving the upper wall leaves the walls below where they are', () => {
    const ws = moveWalls(twoLevels(), ['u'], vec(0.5, 0));
    expect(byId(ws, 'u').start).toEqual(vec(8.5, 0));
    expect(byId(ws, 'w1')).toEqual(byId(twoLevels().walls, 'w1'));
    expect(byId(ws, 'w0')).toEqual(byId(twoLevels().walls, 'w0'));
  });

  it('dragging its end leaves the corner below where it is', () => {
    const ws = stretchEnd(twoLevels(), 'u', 'start', vec(8, -1));
    expect(byId(ws, 'u').start).toEqual(vec(8, -1));
    expect(byId(ws, 'w0').end).toEqual(vec(8, 0));
    expect(byId(ws, 'w1').start).toEqual(vec(8, 0));
  });
});
