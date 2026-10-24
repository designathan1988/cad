// Crossing (X) expectations for the oracle. Own math only.

import type { WallEnd } from '../../../src/elements/wall/schema';
import type { TestWall as Wall } from './fixtures';
import { frameOf, inside, rectOf, shoelace, type P, type Region } from './oracle';
import { coreLayersOf, layerOffsetsOf } from './oracle-layers';

const pt = (x: number, y: number): P => ({ x, y });

/** Line through p along u meets line through q along w (Cramer). */
function meet(p: P, u: P, q: P, w: P): P {
  const det = u.x * -w.y - u.y * -w.x;
  const s = ((q.x - p.x) * -w.y - (q.y - p.y) * -w.x) / det;
  return pt(p.x + u.x * s, p.y + u.y * s);
}

/** Where the two reference lines cross. */
export const crossingOf = (a: Wall, b: Wall): P => meet(a.start, frameOf(a).d, b.start, frameOf(b).d);

const SPEC_POINT_TOL = 1e-3;

const coreThickness = (w: Wall) => {
  const [c0, c1] = coreLayersOf(w);
  let sum = 0;
  for (let k = c0; k <= c1; k++) sum += w.layers[k]!.thickness;
  return sum;
};

/** The spec's choice: the thicker core goes through; cores within 1 mm tie, and the lower id goes. */
export function throughOf(a: Wall, b: Wall): { through: Wall; cut: Wall } {
  const ca = coreThickness(a);
  const cb = coreThickness(b);
  const aThrough = Math.abs(ca - cb) <= SPEC_POINT_TOL ? a.id < b.id : ca > cb;
  return aThrough ? { through: a, cut: b } : { through: b, cut: a };
}

/** The overlap of the two bands: a parallelogram from the four face-line crossings. */
export function overlapOf(a: Wall, b: Wall): P[] {
  const fa = frameOf(a);
  const fb = frameOf(b);
  const on = (w: Wall, o: number) => {
    const f = frameOf(w);
    return pt(w.start.x + f.n.x * o, w.start.y + f.n.y * o);
  };
  return [
    meet(on(a, fa.o0), fa.d, on(b, fb.o0), fb.d),
    meet(on(a, fa.o0), fa.d, on(b, fb.o1), fb.d),
    meet(on(a, fa.o1), fa.d, on(b, fb.o1), fb.d),
    meet(on(a, fa.o1), fa.d, on(b, fb.o0), fb.d),
  ];
}

/** An X only redistributes material: the region is the union of both bands. */
export function expectedX(a: Wall, b: Wall): Region {
  const ra = rectOf(a);
  const rb = rectOf(b);
  const edges = (poly: P[]): [P, P][] => poly.map((v, i) => [v, poly[(i + 1) % poly.length]!]);
  return {
    area: shoelace(ra) + shoelace(rb) - shoelace(overlapOf(a, b)),
    contains: (p) => inside(ra, p) || inside(rb, p),
    edges: [...edges(ra), ...edges(rb)],
  };
}

/**
 * Each side of the crossing as a T: the cut wall up to the crossing, and from it. A piece belongs to
 * the side of the through wall's core midline its centroid lies on. (Stations along the cut wall do
 * not work: at a shallow angle a far layer of one side is cut so obliquely that its centroid falls
 * past the crossing.) A piece that wrongly crossed the midline lands on the other side and fails there.
 */
export function sidesOf(
  cut: Wall,
  through: Wall,
  x: P,
): { abutting: Wall; end: WallEnd; keep: (poly: readonly P[]) => boolean }[] {
  const ft = frameOf(through);
  const offs = layerOffsetsOf(through);
  const [c0, c1] = coreLayersOf(through);
  const mid = (offs[c0]! + offs[c1 + 1]!) / 2;
  const side = (poly: readonly P[]) => {
    const cx = poly.reduce((s, v) => s + v.x, 0) / poly.length;
    const cy = poly.reduce((s, v) => s + v.y, 0) / poly.length;
    return (cx - through.start.x) * ft.n.x + (cy - through.start.y) * ft.n.y - mid;
  };
  // The part before the crossing lies on the side the cut wall comes from.
  const startSide = Math.sign((cut.start.x - x.x) * ft.n.x + (cut.start.y - x.y) * ft.n.y);
  return [
    { abutting: { ...cut, end: x }, end: 'end', keep: (poly) => Math.sign(side(poly)) === startSide },
    { abutting: { ...cut, start: x }, end: 'start', keep: (poly) => Math.sign(side(poly)) === -startSide },
  ];
}
