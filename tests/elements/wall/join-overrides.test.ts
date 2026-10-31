// The user's join choice at a wall end (schema.ts EndJoin; spec §2.1, Revit's Wall Joins and
// Disallow Join). An L by hand: a from (0, 0) to (4, 0), b from (0, 0) to (0, 3), 20 cm on their axes.
// a's band is y in [−0.1, 0.1], b's x in [−0.1, 0.1]; the corner square is [−0.1, 0.1]², its outer
// corner (−0.1, −0.1), its inner (0.1, 0.1).

import { describe, expect, it } from 'vitest';
import { computeWallGeometry } from '../../../src/elements/wall/geometry/footprint';
import type { EndJoin, Wall, WallType } from '../../../src/elements/wall/schema';
import type { Point2 } from '../../../src/model/vector';
import { newDocument } from '../../../src/project/doc';
import { readProject, writeProject } from '../../../src/project/file';
import type { WallId } from '../../../src/elements/wall/schema';
import { lid, tid, wid } from '../../ids';

const solid: WallType = { id: tid('solid'), name: 'solid', layers: [{ thickness: 0.2, function: 'structure', materialId: 'concrete' }] };
const layered: WallType = {
  id: tid('layered'),
  name: 'layered',
  layers: [
    { thickness: 0.02, function: 'finish1', materialId: 'plaster' },
    { thickness: 0.16, function: 'structure', materialId: 'brick' },
    { thickness: 0.02, function: 'finish2', materialId: 'plaster' },
  ],
};
const types = new Map([solid, layered].map((t) => [t.id, t]));

const L = (aJoin?: EndJoin, bJoin?: EndJoin, bType = 'solid'): Wall[] => [
  { id: wid('a'), wallTypeId: tid('solid'), start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, referenceLine: 'centerline', ...(aJoin ? { joins: { start: aJoin } } : {}) },
  { id: wid('b'), wallTypeId: tid(bType), start: { x: 0, y: 0 }, end: { x: 0, y: 3 }, referenceLine: 'centerline', ...(bJoin ? { joins: { start: bJoin } } : {}) },
];

/** Whether a point lies inside one of a wall's pieces (convex, counter-clockwise), not on an edge. */
function covers(walls: Wall[], id: WallId, p: Point2): boolean {
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
    expect([covers(L(), wid('a'), below), covers(L(), wid('a'), above)]).toEqual([true, false]);
    expect([covers(L(), wid('b'), below), covers(L(), wid('b'), above)]).toEqual([false, true]);
  });

  it('a "through": a takes the whole corner square, b stops at its face (y = 0.1)', () => {
    const w = L('through');
    expect([covers(w, wid('a'), below), covers(w, wid('a'), above)]).toEqual([true, true]);
    expect([covers(w, wid('b'), above), covers(w, wid('b'), { x: 0, y: 0.11 })]).toEqual([false, true]);
  });

  it('a "stop" is b through: b takes the corner, a stops at x = 0.1', () => {
    const w = L('stop');
    expect([covers(w, wid('b'), below), covers(w, wid('b'), above)]).toEqual([true, true]);
    expect([covers(w, wid('a'), below), covers(w, wid('a'), { x: 0.11, y: 0 })]).toEqual([false, true]);
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
    expect([covers(w, wid('a'), outer), covers(w, wid('b'), outer)]).toEqual([false, false]);
    expect([covers(w, wid('a'), inner), covers(w, wid('b'), inner)]).toEqual([true, true]);
  });

  it('"square" at 90°: the butt with this one going on', () => {
    const g = (w: Wall[]) => computeWallGeometry(w, types).pieces;
    expect(g(L('square'))).toEqual(g(L('through')));
    expect(g(L(undefined, 'square'))).toEqual(g(L('stop')));
  });

  it('"square" at 120°: a goes on and ends square to its line, at the farther of its faces on b\'s outer face', () => {
    // b to (−1.5, 2.598): its outer face is n·p = −0.1, n = (0.866, 0.5). a's faces y = ±0.1 meet it at
    // x = −0.173 (y = 0.1) and x = −0.058 (y = −0.1): the square end is x = −0.173.
    const w: Wall[] = [
      { id: wid('a'), wallTypeId: tid('solid'), start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, referenceLine: 'centerline' },
      { id: wid('b'), wallTypeId: tid('solid'), start: { x: 0, y: 0 }, end: { x: -1.5, y: 1.5 * Math.sqrt(3) }, referenceLine: 'centerline' },
    ];
    const square = [{ ...w[0]!, joins: { start: 'square' as const } }, w[1]!];
    const through = [{ ...w[0]!, joins: { start: 'through' as const } }, w[1]!];
    const corner = { x: -0.17, y: -0.09 };
    expect([covers(square, wid('a'), corner), covers(through, wid('a'), corner)]).toEqual([true, false]);
    expect(covers(square, wid('a'), { x: -0.18, y: 0.09 })).toBe(false);
    // Inside both bands: a's, and b abuts it.
    const shared = { x: -0.1, y: 0.05 };
    expect([covers(square, wid('a'), shared), covers(square, wid('b'), shared)]).toEqual([true, false]);
    expect(covers(square, wid('b'), { x: -0.2, y: 0.25 })).toBe(true);
  });

  it('between different types (automatic: a butt), "miter" makes the diagonal', () => {
    const auto = L(undefined, undefined, 'layered');
    // Automatic between types: one goes through (the solid core of 0.20 is thicker than 0.16).
    expect(covers(auto, wid('a'), above)).toBe(true);
    const mitred = L('miter', undefined, 'layered');
    expect([covers(mitred, wid('a'), below), covers(mitred, wid('a'), above)]).toEqual([true, false]);
  });

  it('every choice is read back from the file; an unknown one drops the wall and says so', () => {
    const joins: EndJoin[] = ['off', 'through', 'stop', 'miter', 'square'];
    const walls = joins.map((j, k) => ({ ...L()[0]!, id: wid(`w${k}`), levelId: lid('lvl_ground'), joins: { start: j } }));
    const back = readProject(writeProject({ ...newDocument(), walls }));
    expect(back.ok && back.doc.walls.map((w) => w.joins?.start)).toEqual(joins);
    const bad = readProject(JSON.stringify({ ...newDocument(), walls: [{ ...walls[0]!, joins: { start: 'bevel' } }] }));
    expect(bad.ok && bad.doc.walls).toEqual([]);
    expect(bad.ok && bad.fixes.some((f) => f.kind === 'droppedWalls')).toBe(true);
  });
});
