// Walking (walk.ts): walls stop the walker, a doorway lets it through, a window's sill does not; a step
// along a wall slides. A 4 × 3 box of 15 cm walls on their axes: the door in the bottom wall (y = 0)
// at its middle, 0.90 wide; a window in the top wall (y = 3), sill at 1.00 m.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { BODY_RADIUS, moveWithCollision, obstaclesOf, startPoint, stepFor, type Walker } from '../../src/app/walk';
import { newOpening } from '../../src/elements/opening/schema';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

const doc: Doc = {
  ...newDocument(),
  walls: [wall('a', [0, 0], [4, 0]), wall('b', [4, 0], [4, 3]), wall('c', [4, 3], [0, 3]), wall('d', [0, 3], [0, 0])],
  openings: [
    { ...newOpening('door', 'a', 'door', { kind: 'centered' }), width: 0.9 },
    { ...newOpening('win', 'c', 'window', { kind: 'centered' }), width: 1.2, sill: 1.0, height: 1.2 },
  ],
  rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Room', number: '1' }],
};
const g = deriveGeometry(doc);
const obstacles = obstaclesOf(g, 'lvl_ground', 0);

describe('walking through a room', () => {
  it('starts in the middle of the largest room', () => {
    const p = startPoint(g, 'lvl_ground')!;
    expect(p.x).toBeCloseTo(2, 1);
    expect(p.y).toBeCloseTo(1.5, 1);
  });

  it('out through the doorway, down the middle of it: it gets outside', () => {
    const end = moveWithCollision({ x: 2, y: 1 }, { x: 0, y: -2 }, obstacles);
    expect(end.y).toBeCloseTo(-1, 6);
  });

  it('into the bottom wall beside the door: stopped one body radius from the face of the wall', () => {
    // At x = 0.8 the wall is whole; its inner face is at y = 0.075.
    const end = moveWithCollision({ x: 0.8, y: 1 }, { x: 0, y: -2 }, obstacles);
    expect(end.y).toBeGreaterThanOrEqual(0.075 + BODY_RADIUS - 0.06);
    expect(end.y).toBeLessThan(0.075 + BODY_RADIUS + 0.06);
  });

  it('into the window: its sill stops it as the wall does', () => {
    const end = moveWithCollision({ x: 2, y: 2 }, { x: 0, y: 2 }, obstacles);
    expect(end.y).toBeLessThan(3 - 0.075 - BODY_RADIUS + 0.06);
  });

  it('a piece of furniture in the way stops it too; the terrain under it does not', () => {
    const base = newDocument();
    const def = base.definitions[0]!;
    const table = { id: 'object_1', levelId: 'lvl_ground', definitionId: def.id, typeId: 'standard', at: { x: 2, y: 2 }, angle: 0, elevation: 0, values: {} };
    const terrain = { id: 'terrain_1', levelId: 'lvl_ground', outline: [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }], spots: [{ x: -10, y: -10, z: 0 }, { x: 10, y: 10, z: 1 }], interval: 0.5 };
    const g2 = deriveGeometry({ ...doc, objects: [table], terrains: [terrain] });
    const solid = g2.kinds.get('objects')!.get('object_1') as { outline: { x: number; y: number }[]; top: number; bottom: number };
    // Only when it stands a knee high (the first object of the library does).
    expect(solid.top - solid.bottom).toBeGreaterThan(0.4);
    const list = obstaclesOf(g2, 'lvl_ground', 0);
    expect(list.length).toBe(obstacles.length + 1);
    // From below it, walking up into it: stopped before its outline.
    const low = Math.min(...solid.outline.map((p) => p.y));
    const end = moveWithCollision({ x: 2, y: 0.6 }, { x: 0, y: 2 }, list);
    expect(end.y).toBeLessThan(low);
  });

  it('slanting into a wall: it slides along it instead of stopping', () => {
    // Toward the right wall (x = 4) and up: x stops at the wall, y goes on.
    const end = moveWithCollision({ x: 3, y: 1 }, { x: 2, y: 1 }, obstacles);
    expect(end.x).toBeLessThan(4 - 0.075 - BODY_RADIUS + 0.06);
    expect(end.y).toBeCloseTo(2, 6);
  });

  it('a step: forward along the yaw, sideways to the right of it, faster running', () => {
    const w: Walker = { x: 0, y: 0, levelId: 'l', yaw: Math.PI / 2, pitch: 0 };
    const f = stepFor(w, 1, 0, 1, false);
    expect([f.x, f.y].map((v) => Math.round(v * 100) / 100 + 0)).toEqual([0, 1.4]);
    const r = stepFor(w, 0, 1, 1, false);
    expect([r.x, r.y].map((v) => Math.round(v * 100) / 100 + 0)).toEqual([1.4, 0]);
    expect(Math.hypot(...Object.values(stepFor(w, 1, 1, 1, true)))).toBeCloseTo(3.5, 6);
  });
});
