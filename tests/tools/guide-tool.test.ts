// Placing guides, worked out by hand: a 20 cm wall along x from (0, 0) to (6, 0), drawn on its centre
// line, so its faces are at y = −0.1 and y = 0.1.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { draftAt, guideBaseAt, guideLine, guideMeasure, newGuide } from '../../src/elements/guide/tool';
import { vec } from '../../src/model/vector';
import type { WallId } from '../../src/elements/wall/schema';
import { lid, wid } from '../ids';

const wall = (id: WallId, a: [number, number], b: [number, number], bulge = 0): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: lid('lvl_ground'),
  ...(bulge ? { bulge } : {}),
});
const doc: Doc = { ...newDocument(), walls: [wall(wid('w'), [0, 0], [6, 0]), wall(wid('arc'), [0, 5], [6, 5], 0.3)] };
// 1 cm per pixel: the 6 px reach is 6 cm.
const MPP = 0.01;

describe('what a guide is set off from', () => {
  it('the straight wall whose body is under the pointer, or within 6 px of it', () => {
    expect(guideBaseAt(doc, lid('lvl_ground'), vec(3, 0.05), MPP)).toMatchObject({ wallId: wid('w'), faces: [-0.1, 0.1] });
    expect(guideBaseAt(doc, lid('lvl_ground'), vec(3, 0.15), MPP)?.wallId).toBe('w');
    expect(guideBaseAt(doc, lid('lvl_ground'), vec(3, 0.2), MPP)).toBeNull();
  });

  it('an arc has no face to keep parallel to; another level, or walls hidden, give nothing', () => {
    expect(guideBaseAt(doc, lid('lvl_ground'), vec(3, 5.5), MPP)).toBeNull();
    expect(guideBaseAt(doc, lid('other'), vec(3, 0), MPP)).toBeNull();
    expect(guideBaseAt(doc, lid('lvl_ground'), vec(3, 0), MPP, { walls: false, guides: true })).toBeNull();
  });

  it('a guide, off any wall: a line without a body', () => {
    const g = { id: 'guide_a', levelId: lid('lvl_ground'), point: vec(0, 2), dir: vec(1, 0) };
    const withGuide = { ...doc, guides: [g] };
    expect(guideBaseAt(withGuide, lid('lvl_ground'), vec(40, 2.03), MPP)).toMatchObject({ guideId: 'guide_a', faces: [0, 0] });
    expect(guideBaseAt(withGuide, lid('lvl_ground'), vec(40, 2.03), MPP, { walls: true, guides: false })).toBeNull();
  });
});

describe('the distance the pointer sets', () => {
  const base = guideBaseAt(doc, lid('lvl_ground'), vec(3, 0.05), MPP)!;

  it('from the face on its side: 1.2 m above the top face is y = 1.3; on the 5 cm grid with snaps', () => {
    const d = draftAt(base, vec(2, 1.31), true);
    expect(d.side).toBe(1);
    expect(d.offset).toBeCloseTo(1.2, 12);
    expect(guideLine(d).point.y).toBeCloseTo(1.3, 12);
    expect(guideLine(d).dir).toEqual(vec(1, 0));
    // Without snaps, as pointed.
    expect(draftAt(base, vec(2, 1.31), false).offset).toBeCloseTo(1.21, 12);
  });

  it('below the wall, from the bottom face; inside its body, nothing yet', () => {
    const d = draftAt(base, vec(2, -0.9), true);
    expect(d.side).toBe(-1);
    expect(d.offset).toBeCloseTo(0.8, 12);
    expect(guideLine(d).point.y).toBeCloseTo(-0.9, 12);
    expect(draftAt(base, vec(2, 0.04), true).offset).toBe(0);
  });

  it('a typed distance takes the side the pointer is on; its dimension runs across, where the pointer is', () => {
    const d = draftAt(base, vec(2.5, 0.06), true);
    expect(guideLine(d, 1.2).point.y).toBeCloseTo(1.3, 12);
    const m = guideMeasure(d, 1.2);
    expect(m.a.x).toBeCloseTo(2.5, 12);
    expect(m.a.y).toBeCloseTo(0.1, 12);
    expect(m.b.y).toBeCloseTo(1.3, 12);
    expect(newGuide('guide_x', lid('lvl_ground'), d, 1.2)).toMatchObject({ id: 'guide_x', levelId: lid('lvl_ground'), dir: vec(1, 0) });
  });
});
