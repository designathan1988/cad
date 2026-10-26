// The user's join choice at a wall end (schema.ts EndJoin; spec §2.1, Revit's Wall Joins and
// Disallow Join). An L by hand: a from (0, 0) to (4, 0), b from (0, 0) to (0, 3), 20 cm on their axes.
// a's band is y in [−0.1, 0.1], b's x in [−0.1, 0.1]; the corner square is [−0.1, 0.1]², its outer
// corner (−0.1, −0.1), its inner (0.1, 0.1).

import { describe, expect, it } from 'vitest';
import { computeWallGeometry } from '../../../src/elements/wall/geometry/footprint';
import type { EndJoin, Wall, WallType } from '../../../src/elements/wall/schema';
import type { Point2 } from '../../../src/core/vector';

const solid: WallType = { id: 'solid', name: 'solid', layers: [{ thickness: 0.2, function: 'structure', materialId: 'concrete' }] };
const layered: WallType = {
  id: 'layered',
  name: 'layered',
  layers: [
    { thickness: 0.02, function: 'finish1', materialId: 'plaster' },
    { thickness: 0.16, function: 'structure', materialId: 'brick' },
    { thickness: 0.02, function: 'finish2', materialId: 'plaster' },
  ],
};
const types = new Map([solid, layered].map((t) => [t.id, t]));

const L = (aJoin?: EndJoin, bJoin?: EndJoin, bType = 'solid'): Wall[] => [
  { id: 'a', wallTypeId: 'solid', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, referenceLine: 'centerline', ...(aJoin ? { joins: { start: aJoin } } : {}) },
  { id: 'b', wallTypeId: bType, start: { x: 0, y: 0 }, end: { x: 0, y: 3 }, referenceLine: 'centerline', ...(bJoin ? { joins: { start: bJoin } } : {}) },
];

/** Whether a point lies inside one of a wall's pieces (convex, counter-clockwise), not on an edge. */
function covers(walls: Wall[], id: string, p: Point2): boolean {
  const pieces = computeWallGeometry(walls, types).pieces.get(id) ?? [];
  return pieces.some((piece) =>
    piece.polygon.every((a, i) => {
      const b = piece.polygon[(i + 1) % piece.polygon.length]!;
      return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) > 1e-9;
    }),
  );
}

// Two points of the corner square: below its diagonal y = x (a's half in a miter), and above it.
const below = { x: 0.05, y: -0.05 };
const above = { x: -0.05, y: 0.05 };

describe('join choices at a wall end', () => {
  it('automatic, same type: a miter along the diagonal', () => {
    expect([covers(L(), 'a', below), covers(L(), 'a', above)]).toEqual([true, false]);
    expect([covers(L(), 'b', below), covers(L(), 'b', above)]).toEqual([false, true]);
  });

  it('a "through": a takes the whole corner square, b stops at its face (y = 0.1)', () => {
    const w = L('through');
    expect([covers(w, 'a', below), covers(w, 'a', above)]).toEqual([true, true]);
    expect([covers(w, 'b', above), covers(w, 'b', { x: 0, y: 0.11 })]).toEqual([false, true]);
  });

  it('a "stop" is b through: b takes the corner, a stops at x = 0.1', () => {
    const w = L('stop');
    expect([covers(w, 'b', below), covers(w, 'b', above)]).toEqual([true, true]);
    expect([covers(w, 'a', below), covers(w, 'a', { x: 0.11, y: 0 })]).toEqual([false, true]);
  });

  it('the same said from b: b "through" equals a "stop"', () => {
    const g = (w: Wall[]) => computeWallGeometry(w, types).pieces;
    expect(g(L(undefined, 'through'))).toEqual(g(L('stop')));
  });

  it('both "through": no single choice, so automatic again', () => {
    expect(computeWallGeometry(L('through', 'through'), types).pieces).toEqual(computeWallGeometry(L(), types).pieces);
  });

  it('a "off": not joined, both end square at the corner point: the outer corner is open, the inner one covered twice', () => {
    const w = L('off');
    const outer = { x: -0.05, y: -0.05 };
    const inner = { x: 0.05, y: 0.05 };
    expect([covers(w, 'a', outer), covers(w, 'b', outer)]).toEqual([false, false]);
    expect([covers(w, 'a', inner), covers(w, 'b', inner)]).toEqual([true, true]);
  });

  it('between different types (automatic: a butt), "miter" makes the diagonal', () => {
    const auto = L(undefined, undefined, 'layered');
    // Automatic between types: one goes through (the solid core of 0.20 is thicker than 0.16).
    expect(covers(auto, 'a', above)).toBe(true);
    const mitred = L('miter', undefined, 'layered');
    expect([covers(mitred, 'a', below), covers(mitred, 'a', above)]).toEqual([true, false]);
  });
});
