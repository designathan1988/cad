// Another reference line for a wall keeps its body where it is, as in Revit and ArchiCAD: the line
// moves to the face. A 20 cm wall b from (0, 0) to (4, 0) on its centre line (body from y = −0.1 to
// 0.1, its exterior face at y = −0.1, on its right), with r going up from its end.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { changeReferenceLine } from '../../src/tools/edit';

const wall = (id: string, a: [number, number], b: [number, number], bulge = 0): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  ...(bulge ? { bulge } : {}),
});
const doc: Doc = { ...newDocument(), walls: [wall('b', [0, 0], [4, 0]), wall('r', [4, 0], [4, 3])] };
const body = (d: Doc, id: string) => {
  const ys = deriveGeometry(d).solids.get(id)!.pieces.flatMap((p) => p.polygon.map((v) => v.y));
  return [Math.min(...ys), Math.max(...ys)];
};

describe('changing the reference line', () => {
  it('to the exterior face: the line goes to y = −0.1, the body stays from −0.1 to 0.1', () => {
    const walls = changeReferenceLine(doc, ['b'], 'exteriorFace');
    const b = walls.find((w) => w.id === 'b')!;
    expect(b.referenceLine).toBe('exteriorFace');
    expect(b.start.y).toBeCloseTo(-0.1, 12);
    expect(b.end.y).toBeCloseTo(-0.1, 12);
    const [lo, hi] = body({ ...doc, walls }, 'b');
    expect(lo).toBeCloseTo(-0.1, 9);
    expect(hi).toBeGreaterThan(0.09);
  });

  it('the wall joined at its end keeps the join: its start goes with the line', () => {
    const walls = changeReferenceLine(doc, ['b'], 'exteriorFace');
    expect(walls.find((w) => w.id === 'r')!.start.y).toBeCloseTo(-0.1, 12);
  });

  it('an arc keeps its centre: its line takes the exterior face radius', () => {
    // A half circle from (0, 0) to (4, 0) bulging below: centre (2, 0), radius 2. Bulge 1 runs
    // counter-clockwise (arc.ts), so its left normal points to the centre, and the exterior face
    // (offset −0.1 along it) is the outer one, radius 2.1.
    const d: Doc = { ...newDocument(), walls: [wall('a', [0, 0], [4, 0], 1)] };
    const a = changeReferenceLine(d, ['a'], 'exteriorFace')[0]!;
    expect(Math.hypot(a.start.x - 2, a.start.y)).toBeCloseTo(2.1, 9);
    expect(Math.hypot(a.end.x - 2, a.end.y)).toBeCloseTo(2.1, 9);
    expect(a.bulge).toBe(1);
  });

  it('the same line again changes nothing', () => {
    expect(changeReferenceLine(doc, ['b'], 'centerline')).toEqual(doc.walls);
  });
});
