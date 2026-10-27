// The plan symbol of a door or window, in world coordinates, as plans draw it. Without a style (every
// file before styles): a door's leaf standing open at 90° from the hinge jamb on the side it opens to,
// and the quarter arc its edge sweeps back to the other jamb; a window's frame lines at both wall faces
// and the glass line between them. With a style (style.ts), by how it opens: one or two swinging
// leaves, a pivoting leaf, sliding leaves side by side on two tracks, folding leaves, an overhead or
// rolling door's dashed line; the frame in the jambs, the trim past them on both faces, the threshold.

import { add, distance, normalize, type Point2, scale, sub } from '../../core/vector';
import type { Opening } from './schema';
import { paneSpans } from './style';
import type { OpeningFrame } from './void';

type Placed = { readonly opening: Opening; readonly start: number; readonly end: number };

/** A leaf's line standing open and the arc its edge sweeps back to the wall. */
interface Sweep {
  readonly leaf: Point2[];
  readonly arc: Point2[];
}

/** Lines along and across the opening: `t` from the start jamb along the chord, `off` along the normal. */
function frameAt(f: OpeningFrame) {
  const along = normalize(sub(f.end, f.start));
  const width = distance(f.start, f.end);
  const P = (t: number, off: number): Point2 => add(add(f.start, scale(along, t)), scale(f.normal, off));
  return { along, width, P };
}

/** A quarter (or less) arc about `c` from `a` toward `b`, both of radius r. */
function arcPoints(c: Point2, u: Point2, v: Point2, r: number, steps = 24): Point2[] {
  const pts: Point2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push(add(c, add(scale(u, r * Math.cos(a)), scale(v, r * Math.sin(a)))));
  }
  return pts;
}

/** The leaves that swing (a door's, a casement window's), each with its arc. */
function sweeps(op: Placed, f: OpeningFrame): Sweep[] {
  const o = op.opening;
  const s = o.style;
  const [o0, o1] = f.faces;
  const left = o.swing === 'left';
  const face = left ? o1 : o0;
  const out = scale(f.normal, left ? 1 : -1);
  if (!s) {
    // Before styles: from jamb to jamb.
    const at = (p: Point2, off: number) => add(p, scale(f.normal, off));
    const hinge = at(o.hinge === 'start' ? f.start : f.end, face);
    const strike = at(o.hinge === 'start' ? f.end : f.start, face);
    // The chord between the jambs: on an arc wall it is a little shorter than the width along the arc.
    const width = distance(hinge, strike);
    const along = normalize(sub(strike, hinge));
    return [{ leaf: [hinge, add(hinge, scale(out, width))], arc: arcPoints(hinge, out, along, width) }];
  }
  const { along, width, P } = frameAt(f);
  const a = Math.min(s.frame, width / 4);
  const b = width - a;
  const clear = b - a;
  const back = scale(along, -1);
  const one = (t: number, toward: Point2, w: number): Sweep => {
    const hinge = P(t, face);
    return { leaf: [hinge, add(hinge, scale(out, w))], arc: arcPoints(hinge, out, toward, w) };
  };
  const startHinge = o.hinge === 'start';
  switch (s.operation) {
    case 'swing':
      return [startHinge ? one(a, along, clear) : one(b, back, clear)];
    case 'double':
      return [one(a, along, clear / 2), one(b, back, clear / 2)];
    case 'casement': {
      const spans = paneSpans(s, a, clear);
      if (spans.length === 1) return [startHinge ? one(a, along, clear) : one(b, back, clear)];
      // Pairs hung from the jambs and the mullions between them, opening away from each other.
      return spans.map(([t0, t1], i) => (i % 2 === 0 ? one(t0, along, t1 - t0) : one(t1, back, t1 - t0)));
    }
    case 'pivot': {
      // The pivot a sixth in from the hinge jamb: the long side sweeps out, the short side in.
      const short = clear / 6;
      const pt = startHinge ? a + short : b - short;
      const pivot = P(pt, (o0 + o1) / 2);
      const toward = startHinge ? along : back;
      const long = clear - short;
      return [
        { leaf: [add(pivot, scale(out, -short)), add(pivot, scale(out, long))], arc: arcPoints(pivot, out, toward, long) },
        { leaf: [], arc: arcPoints(pivot, scale(out, -1), scale(toward, -1), short, 8) },
      ];
    }
    default:
      return [];
  }
}

/** A thin rectangle from t0 to t1 centred at `off`, closed. */
function bar(P: (t: number, off: number) => Point2, t0: number, t1: number, off: number, half: number): Point2[] {
  return [P(t0, off - half), P(t1, off - half), P(t1, off + half), P(t0, off + half), P(t0, off - half)];
}

/** Dashes along `off` from t0 to t1. */
function dashes(P: (t: number, off: number) => Point2, t0: number, t1: number, off: number): Point2[][] {
  const out: Point2[][] = [];
  for (let t = t0; t < t1; t += 0.2) out.push([P(t, off), P(Math.min(t1, t + 0.1), off)]);
  return out;
}

/** The polylines of an opening's plan symbol, in world coordinates. */
export function symbolLines(op: Placed, f: OpeningFrame | null): Point2[][] {
  if (!f) return [];
  const o = op.opening;
  const s = o.style;
  const [o0, o1] = f.faces;
  const mid = (o0 + o1) / 2;
  if (!s) {
    if (o.kind === 'window') {
      const at = (p: Point2, off: number) => add(p, scale(f.normal, off));
      return [o0, o1, mid].map((off) => [at(f.start, off), at(f.end, off)]);
    }
    const [sw] = sweeps(op, f);
    return sw ? [sw.leaf, sw.arc] : [];
  }
  const { width, P } = frameAt(f);
  const a = Math.min(s.frame, width / 4);
  const b = width - a;
  const clear = b - a;
  const lines: Point2[][] = [];
  const lo = Math.min(o0, o1);
  const hi = Math.max(o0, o1);
  // The frame in each jamb, across the wall.
  if (a > 0) for (const [t0, t1] of [[0, a], [b, width]] as const) lines.push([P(t0, lo), P(t1, lo), P(t1, hi), P(t0, hi), P(t0, lo)]);
  // The trim on both faces, just outside them, past each jamb.
  if (s.casing > 0) {
    for (const off of [lo - 0.012, hi + 0.012]) {
      lines.push(bar(P, -s.casing, 0, off, 0.008), bar(P, width, width + s.casing, off, 0.008));
    }
  }
  const leaves = s.leaves;
  // Sliding leaves or panes on two tracks, each overlapping the next.
  const tracks = (half: number) => {
    const lap = leaves > 1 ? 0.05 : 0;
    const w = Math.min(clear, (clear + lap * (leaves - 1)) / leaves);
    const gap = Math.min(0.02, (hi - lo) / 5);
    for (let i = 0; i < leaves; i++) {
      const t0 = leaves > 1 ? a + (i * (clear - w)) / (leaves - 1) : a;
      lines.push(bar(P, t0, t0 + w, mid + (i % 2 === 0 ? -gap : gap), half));
    }
  };
  if (o.kind === 'window') {
    // The frame's lines at the faces, as before styles, then the panes.
    lines.push([P(a, lo), P(b, lo)], [P(a, hi), P(b, hi)]);
    if (s.operation === 'sliding') tracks(0.004);
    else if (s.operation === 'doubleHung') {
      lines.push([P(a, mid - 0.012), P(b, mid - 0.012)], [P(a, mid + 0.012), P(b, mid + 0.012)]);
    } else {
      lines.push([P(a, mid), P(b, mid)]);
      for (const [t] of paneSpans(s, a, clear).slice(1)) lines.push([P(t, lo), P(t, hi)]);
      if (s.operation === 'casement') for (const sw of sweeps(op, f)) lines.push(sw.leaf, sw.arc);
    }
    return lines;
  }
  if (s.threshold) lines.push([P(-0.02, lo - 0.02), P(width + 0.02, lo - 0.02)], [P(-0.02, hi + 0.02), P(width + 0.02, hi + 0.02)]);
  switch (s.operation) {
    case 'sliding':
      tracks(0.015);
      break;
    case 'folding': {
      // Leaves folded at 30° against the hinge jamb, on the side it opens to.
      const out = o.swing === 'left' ? 1 : -1;
      const face = o.swing === 'left' ? hi : lo;
      const w = clear / leaves;
      const fold = Math.PI / 6;
      const startHinge = o.hinge === 'start';
      const zig: Point2[] = [];
      for (let i = 0; i <= leaves; i++) {
        const along = i * w * Math.cos(fold);
        const t = startHinge ? a + along : b - along;
        zig.push(P(t, face + (i % 2 === 1 ? out * w * Math.sin(fold) : 0)));
      }
      lines.push(zig);
      break;
    }
    case 'overhead':
      lines.push(...dashes(P, a, b, mid));
      break;
    case 'roller':
      lines.push([P(a, mid), P(b, mid)], ...dashes(P, a, b, o.swing === 'left' ? hi + 0.1 : lo - 0.1));
      break;
    default:
      for (const sw of sweeps(op, f)) {
        if (sw.leaf.length > 0) lines.push(sw.leaf);
        lines.push(sw.arc);
      }
  }
  return lines;
}

/**
 * The floor a door's leaves sweep, as a convex polygon: the hinge and the arc its edge draws, from the
 * leaf standing open back to the strike jamb (every third of the symbol's 24 steps, inside the disc);
 * for two leaves, the box over both. Null for a window and for doors that sweep no floor.
 */
export function swingRegion(op: Placed, f: OpeningFrame | null): Point2[] | null {
  if (!f || op.opening.kind !== 'door') return null;
  const all = sweeps(op, f).filter((s) => s.leaf.length === 2);
  if (all.length === 0) return null;
  if (all.length === 1) {
    const { leaf, arc } = all[0]!;
    return [leaf[0]!, ...arc.filter((_, i) => i % 3 === 0)];
  }
  const [x, y] = all as [Sweep, Sweep];
  return [x.leaf[0]!, x.leaf[1]!, y.leaf[1]!, y.leaf[0]!];
}
