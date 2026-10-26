// The thin lines over the walls in 3D (edges.ts): where the surface turns, never along a seam inside a
// plane, nor where it bends a little. Worked out by hand from boxes.

import { describe, expect, it } from 'vitest';
import { featureEdges, type Edge3 } from '../../../src/elements/wall/geometry/edges';
import { visibleFaces, type Prism } from '../../../src/elements/wall/geometry/faces';
import type { Point2 } from '../../../src/core/vector';

const box = (x0: number, y0: number, x1: number, y1: number, bottom: number, top: number): Prism => ({
  polygon: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
  bottom,
  top,
});

const r = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
/** Each line as "x,y,z x,y,z", its ends in order, rounded: comparable as a set. */
const lines = (edges: readonly Edge3[]) =>
  edges
    .map((e) => [e.a, e.b].map((p) => `${r(p.x)},${r(p.y)},${r(p.z)}`).sort().join(' '))
    .sort();

const edgesOf = (prisms: Prism[]) => featureEdges(prisms, visibleFaces(prisms));

const boxLines = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number) => {
  const c = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ] as const;
  const out: Edge3[] = [];
  c.forEach(([x, y], i) => {
    const [x2, y2] = c[(i + 1) % 4]!;
    for (const z of [z0, z1]) out.push({ a: { x, y, z }, b: { x: x2, y: y2, z } });
    out.push({ a: { x, y, z: z0 }, b: { x, y, z: z1 } });
  });
  return lines(out);
};

describe('lines over the walls in 3D', () => {
  it('a lone block: its twelve edges', () => {
    expect(lines(edgesOf([box(0, 0, 1, 0.2, 0, 2.8)]))).toEqual(boxLines(0, 0, 1, 0.2, 0, 2.8));
  });

  it('two walls joined in line: the twelve edges of the whole, no line at the joint', () => {
    expect(lines(edgesOf([box(0, 0, 1, 0.2, 0, 2.8), box(1, 0, 2, 0.2, 0, 2.8)]))).toEqual(boxLines(0, 0, 2, 0.2, 0, 2.8));
  });

  it('two layers side by side: one block outline, no line between the layers', () => {
    expect(lines(edgesOf([box(0, 0, 3, 0.02, 0, 2.8), box(0, 0.02, 3, 0.2, 0, 2.8)]))).toEqual(boxLines(0, 0, 3, 0.2, 0, 2.8));
  });

  it('a 15 cm wall on the axis of a 20 cm one: the step shows as two lines on the top below', () => {
    const low = box(0, -0.1, 3, 0.1, 0, 2.8);
    const high = box(0, -0.075, 3, 0.075, 2.8, 5.6);
    const faces = visibleFaces([low, high]);
    // The levels are drawn apart, each from its own faces: below, the edges of its top at its faces;
    // above, the foot of each face, 2.5 cm in from those.
    const below = lines(featureEdges([low], [faces[0]!]));
    expect(below).toContain('0,-0.1,2.8 3,-0.1,2.8');
    expect(below).toContain('0,0.1,2.8 3,0.1,2.8');
    const above = lines(featureEdges([high], [faces[1]!]));
    expect(above).toContain('0,-0.075,2.8 3,-0.075,2.8');
    expect(above).toContain('0,0.075,2.8 3,0.075,2.8');
    expect(above).toEqual(boxLines(0, -0.075, 3, 0.075, 2.8, 5.6));
  });

  it('a lower wall beside a higher one: the line where its top meets the higher face', () => {
    // Joined in line, the second only 1.5 m high: the first's end shows above it.
    const got = lines(edgesOf([box(0, 0, 1, 0.2, 0, 2.8), box(1, 0, 2, 0.2, 0, 1.5)]));
    expect(got).toContain('1,0,1.5 1,0.2,1.5');
    // No line down the faces at the joint below 1.5 m: the faces go on in one plane.
    expect(got).not.toContain('1,0,0 1,0,1.5');
    expect(got).toContain('1,0,1.5 1,0,2.8');
  });

  // Two walls of 20 cm meeting with a mitred joint, the second turned by `deg` from the first.
  const bend = (deg: number): { prisms: Prism[]; outer: Point2; inner: Point2 } => {
    const t = (deg * Math.PI) / 180;
    const k = 0.1 / Math.cos(t / 2);
    const nb = { x: -Math.sin(t / 2), y: Math.cos(t / 2) };
    const inner = { x: 1 + nb.x * k, y: nb.y * k };
    const outer = { x: 1 - nb.x * k, y: -nb.y * k };
    const d = { x: Math.cos(t), y: Math.sin(t) };
    const a: Prism = { polygon: [{ x: 0, y: -0.1 }, outer, inner, { x: 0, y: 0.1 }], bottom: 0, top: 2.8 };
    const b: Prism = { polygon: [outer, { x: outer.x + d.x, y: outer.y + d.y }, { x: inner.x + d.x, y: inner.y + d.y }, inner], bottom: 0, top: 2.8 };
    return { prisms: [a, b], outer, inner };
  };
  const verticalAt = (edges: readonly Edge3[], p: Point2) =>
    edges.some((e) => Math.hypot(e.a.x - p.x, e.a.y - p.y) < 1e-6 && Math.hypot(e.b.x - p.x, e.b.y - p.y) < 1e-6 && Math.abs(e.a.z - e.b.z) > 1);

  it('a bend of 10° (an arc segment) draws no line down the bend; one of 30° does', () => {
    const soft = bend(10);
    const e10 = edgesOf(soft.prisms);
    expect(verticalAt(e10, soft.outer)).toBe(false);
    expect(verticalAt(e10, soft.inner)).toBe(false);
    const hard = bend(30);
    const e30 = edgesOf(hard.prisms);
    expect(verticalAt(e30, hard.outer)).toBe(true);
    expect(verticalAt(e30, hard.inner)).toBe(true);
  });

  it('no line across the top at the joint of a bend', () => {
    const { prisms, outer, inner } = bend(30);
    const across = edgesOf(prisms).some((e) => {
      const ends = [e.a, e.b];
      return ends.some((p) => Math.hypot(p.x - outer.x, p.y - outer.y) < 1e-6) && ends.some((p) => Math.hypot(p.x - inner.x, p.y - inner.y) < 1e-6);
    });
    expect(across).toBe(false);
  });
});
