// The plan symbol of a door or window, in world coordinates, as plans draw it: a door's leaf standing
// open at 90° from the hinge jamb on the side it opens to, and the quarter arc its edge sweeps back to
// the other jamb; a window's frame lines at both wall faces and the glass line between them.

import { add, distance, normalize, type Point2, scale, sub } from '../../core/vector';
import type { Opening } from './schema';
import type { OpeningFrame } from './void';

/** The polylines of an opening's plan symbol, in world coordinates. */
export function symbolLines(op: { readonly opening: Opening; readonly start: number; readonly end: number }, f: OpeningFrame | null): Point2[][] {
  if (!f) return [];
  const at = (p: Point2, off: number) => add(p, scale(f.normal, off));
  const [o0, o1] = f.faces;
  if (op.opening.kind === 'window') {
    const mid = (o0 + o1) / 2;
    return [o0, o1, mid].map((off) => [at(f.start, off), at(f.end, off)]);
  }
  // Door: the hinge on the face it opens to; the leaf perpendicular to the wall, the arc back.
  const left = op.opening.swing === 'left';
  const face = left ? o1 : o0;
  const out = scale(f.normal, left ? 1 : -1);
  const hinge = at(op.opening.hinge === 'start' ? f.start : f.end, face);
  const strike = at(op.opening.hinge === 'start' ? f.end : f.start, face);
  // The chord between the jambs: on an arc wall it is a little shorter than the width along the arc.
  const width = distance(hinge, strike);
  const tip = add(hinge, scale(out, width));
  const along = normalize(sub(strike, hinge));
  const arc: Point2[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    arc.push(add(hinge, add(scale(out, width * Math.cos(a)), scale(along, width * Math.sin(a)))));
  }
  return [[hinge, tip], arc];
}
