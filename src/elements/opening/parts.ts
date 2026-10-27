// The solids of a door or window in 3D (phase 5), for the 3D view and the GLB alike: upright prisms over
// convex plan polygons, each with its role (leaf, glass, frame) for its material. Without a style, the
// plain leaf or pane every file before styles had: one slab in the middle of the wall, a door's standing
// open square to the wall when doors are drawn open. With one (style.ts): the frame in the jambs and
// head (and a window's sill), the trim on both faces, the transom and its glass, the threshold, and the
// leaves or panes by how they open; drawn open (walking), swinging leaves stand square to the wall and
// sliding ones are pushed to one side.

import { add, distance, normalize, type Point2, scale, sub } from '../../core/vector';
import type { Opening } from './schema';
import { paneRows, paneSpans } from './style';
import { symbolLines } from './symbol';
import type { OpeningFrame } from './void';

export interface OpeningPart {
  /** Counter-clockwise. */
  readonly polygon: Point2[];
  readonly bottom: number;
  readonly top: number;
  readonly role: 'leaf' | 'glass' | 'frame';
  /** Turned about a level axis (a window tilted open): through `origin`, along `axis` in plan, by `angle` radians. */
  readonly turn?: { readonly origin: { readonly x: number; readonly y: number; readonly z: number }; readonly axis: Point2; readonly angle: number };
}

type Placed = { readonly opening: Opening; readonly start: number; readonly end: number; readonly bottom: number; readonly top: number };

const ccw = (ring: Point2[]): Point2[] => {
  const area = ring.reduce((s, p, i) => s + p.x * ring[(i + 1) % ring.length]!.y - ring[(i + 1) % ring.length]!.x * p.y, 0);
  return area > 0 ? ring : ring.reverse();
};

/** A slab of thickness 2·half along the segment p→q. */
function slabAlong(p: Point2, q: Point2, half: number): Point2[] {
  const d = sub(q, p);
  const len = Math.hypot(d.x, d.y) || 1;
  const n = { x: (-d.y / len) * half, y: (d.x / len) * half };
  return ccw([add(p, scale(n, -1)), add(q, scale(n, -1)), add(q, n), add(p, n)]);
}

export function openingParts(o: Placed, f: OpeningFrame, open: boolean): OpeningPart[] {
  const op = o.opening;
  const s = op.style;
  const door = op.kind === 'door';
  const [o0, o1] = f.faces;
  const mid = (o0 + o1) / 2;
  if (!s) {
    const half = door ? 0.02 : 0.01;
    const at = (p: Point2, off: number) => add(p, scale(f.normal, off));
    let poly = ccw([at(f.start, mid - half), at(f.end, mid - half), at(f.end, mid + half), at(f.start, mid + half)]);
    // Open, as the plan draws it (symbol.ts): the leaf square to the wall from its hinge.
    const leaf = door && open ? symbolLines(o, f)[0] : undefined;
    if (leaf && leaf.length === 2) poly = slabAlong(leaf[0]!, leaf[1]!, half);
    return [{ polygon: poly, bottom: o.bottom, top: o.top, role: door ? 'leaf' : 'glass' }];
  }
  const along = normalize(sub(f.end, f.start));
  const width = distance(f.start, f.end);
  const P = (t: number, off: number): Point2 => add(add(f.start, scale(along, t)), scale(f.normal, off));
  const box = (t0: number, t1: number, off0: number, off1: number) => ccw([P(t0, off0), P(t1, off0), P(t1, off1), P(t0, off1)]);
  const lo = Math.min(o0, o1);
  const hi = Math.max(o0, o1);
  const parts: OpeningPart[] = [];
  // A pane or leaf tilted open goes with its turn (see OpeningPart).
  let turning: OpeningPart['turn'] | undefined;
  const push = (polygon: Point2[], bottom: number, top: number, role: OpeningPart['role']) => {
    if (top - bottom > 1e-4) parts.push({ polygon, bottom, top, role, ...(turning ? { turn: turning } : {}) });
  };
  const fr = Math.min(s.frame, width / 4, (o.top - o.bottom) / 4);
  const a = fr;
  const b = width - fr;
  const clear = b - a;
  // The frame: both jambs and the head, a window's sill too, the wall's whole depth.
  if (fr > 0) {
    push(box(0, a, lo, hi), o.bottom, o.top, 'frame');
    push(box(b, width, lo, hi), o.bottom, o.top, 'frame');
    push(box(a, b, lo, hi), o.top - fr, o.top, 'frame');
    if (!door) push(box(a, b, lo, hi), o.bottom, o.bottom + fr, 'frame');
  }
  // The trim on both faces: past each jamb and over the head.
  if (s.casing > 0) {
    const c = s.casing;
    for (const [off0, off1] of [[lo - 0.015, lo], [hi, hi + 0.015]] as const) {
      push(box(-c, 0, off0, off1), o.bottom, o.top + c, 'frame');
      push(box(width, width + c, off0, off1), o.bottom, o.top + c, 'frame');
      push(box(0, width, off0, off1), o.top, o.top + c, 'frame');
    }
  }
  const threshold = door && s.threshold ? 0.02 : 0;
  if (threshold > 0) push(box(-0.02, width + 0.02, lo - 0.02, hi + 0.02), o.bottom, o.bottom + threshold, 'frame');
  // The transom: a bar under it and its glass over it.
  let top = o.top - fr;
  if (s.transom > 0 && s.transom < top - o.bottom - 0.3) {
    push(box(a, b, mid - 0.004, mid + 0.004), top - s.transom, top, 'glass');
    top -= s.transom;
    push(box(a, b, lo, hi), top - Math.max(fr, 0.04), top, 'frame');
    top -= Math.max(fr, 0.04);
  }
  const bottom = door ? o.bottom + Math.max(threshold, 0.01) : o.bottom + fr;
  const leaf = (t0: number, t1: number, off: number, half: number, z0 = bottom, z1 = top) => push(box(t0, t1, off - half, off + half), z0, z1, 'leaf');
  // A window's pane: its sash (4 bars) and its glass.
  const pane = (t0: number, t1: number, off: number, z0 = bottom, z1 = top) => {
    const k = Math.min(0.04, (t1 - t0) / 5, (z1 - z0) / 5);
    const d = 0.025;
    push(box(t0, t0 + k, off - d, off + d), z0, z1, 'frame');
    push(box(t1 - k, t1, off - d, off + d), z0, z1, 'frame');
    push(box(t0 + k, t1 - k, off - d, off + d), z0, z0 + k, 'frame');
    push(box(t0 + k, t1 - k, off - d, off + d), z1 - k, z1, 'frame');
    push(box(t0 + k, t1 - k, off - 0.004, off + 0.004), z0 + k, z1 - k, 'glass');
  };
  const n = s.leaves;
  const gap = Math.min(0.025, (hi - lo) / 5);
  // Leaves or panes on two tracks, each overlapping the next; open, all pushed to the hinge side.
  const sliding = (make: (t0: number, t1: number, off: number) => void) => {
    const lap = n > 1 ? 0.05 : 0;
    const w = Math.min(clear, (clear + lap * (n - 1)) / n);
    for (let i = 0; i < n; i++) {
      const spread = n > 1 ? (i * (clear - w)) / (n - 1) : 0;
      const t0 = open ? (op.hinge === 'start' ? a + Math.min(spread, 0.04 * i) : b - w - Math.min(spread, 0.04 * i)) : a + spread;
      make(t0, t0 + w, mid + (i % 2 === 0 ? -gap : gap));
    }
  };
  if (door) {
    switch (s.operation) {
      case 'sliding':
        sliding((t0, t1, off) => leaf(t0, t1, off, 0.018));
        break;
      case 'overhead':
      case 'roller':
        // Open: lifted up to the head.
        if (open) leaf(a, b, mid, 0.02, top - 0.06, top);
        else leaf(a, b, mid, 0.02);
        break;
      case 'folding':
        if (open) {
          // Folded against the hinge jamb, standing out on the side it opens to.
          const w = clear / n;
          const out = op.swing === 'left' ? 1 : -1;
          for (let i = 0; i < n; i++) {
            const t = op.hinge === 'start' ? a + 0.02 + i * 0.04 : b - 0.02 - i * 0.04;
            push(slabAlong(P(t, mid), P(t, mid + out * w), 0.016), bottom, top, 'leaf');
          }
          break;
        }
        for (let i = 0; i < n; i++) leaf(a + (i * clear) / n + 0.003, a + ((i + 1) * clear) / n - 0.003, mid, 0.018);
        break;
      default: {
        // Swinging: closed in the middle of the wall; open, as the plan draws them (symbol.ts).
        if (open) {
          const lines = symbolLines(o, f);
          // Leaves are the two-point lines that leave the wall (the frame's and trim's are closed rings).
          const leaves = lines.filter((l) => l.length === 2 && Math.abs((l[1]!.x - l[0]!.x) * along.x + (l[1]!.y - l[0]!.y) * along.y) < 1e-4 && distance(l[0]!, l[1]!) > 0.1);
          for (const l of leaves) push(slabAlong(l[0]!, l[1]!, 0.02), bottom, top, 'leaf');
          if (leaves.length > 0) break;
        }
        const parts2 = s.operation === 'double' ? 2 : 1;
        for (let i = 0; i < parts2; i++) leaf(a + (i * clear) / parts2 + (i > 0 ? 0.003 : 0), a + ((i + 1) * clear) / parts2 - (parts2 > 1 && i === 0 ? 0.003 : 0), mid, 0.02);
      }
    }
    return parts;
  }
  // Tilting toward the outside (the exterior face's side) by `angle`, about the level line at `z`.
  const outside = o0 < o1 ? -1 : 1;
  // Its protection, just outside the exterior face, over the opening between the jambs: a shutter's
  // slats (5 cm apart, laid back 2 cm), or a grille's bars (12 mm, 12 cm apart, two cross bars). A
  // shutter is drawn closed, and pushed aside when the window is drawn open (walking); a grille stays.
  const face = o0 + outside * 0.03;
  if (s.screen === 'grille') {
    const bars = Math.max(1, Math.floor(width / 0.12 + 1e-9));
    for (let i = 1; i < bars; i++) {
      const t = (i * width) / bars;
      push(box(t - 0.006, t + 0.006, face - 0.006, face + 0.006), o.bottom, o.top, 'frame');
    }
    for (const z of [o.bottom + 0.1, o.top - 0.1]) push(box(0, width, face - 0.006, face + 0.006), z - 0.006, z + 0.006, 'frame');
  } else if (s.screen === 'shutter' && !open) {
    push(box(0, 0.03, face - 0.015, face + 0.015), o.bottom, o.top, 'frame');
    push(box(width - 0.03, width, face - 0.015, face + 0.015), o.bottom, o.top, 'frame');
    for (let z = o.bottom + 0.03; z + 0.03 <= o.top; z += 0.05) push(box(0.03, width - 0.03, face - 0.01, face + 0.01), z, z + 0.03, 'leaf');
  }
  // The panes side by side and one over another: at the mullions and transoms where they are wanted, else equal.
  const panes = () => {
    for (const [t0, t1] of paneSpans(s, a, clear)) for (const [z0, z1] of paneRows(s, bottom, top)) pane(t0, t1, mid, z0, z1);
  };
  const tilt = (z: number, angle: number) => {
    turning = { origin: { ...P(width / 2, mid), z }, axis: along, angle: outside * angle };
  };
  switch (s.operation) {
    case 'sliding':
      sliding((t0, t1, off) => pane(t0, t1, off));
      break;
    case 'doubleHung': {
      // Two sashes, the upper outside the lower, overlapping a little; open, the lower one raised.
      const h = (top - bottom) / 2;
      const up = open ? h * 0.85 : 0;
      pane(a, b, mid - gap, bottom + up, bottom + h + 0.025 + up);
      pane(a, b, mid + gap, bottom + h - 0.025, top);
      break;
    }
    case 'casement':
      if (open) {
        // Each pane swung square to the wall from its hinge, as the plan draws it.
        const lines = symbolLines(o, f).filter((l) => l.length === 2 && Math.abs((l[1]!.x - l[0]!.x) * along.x + (l[1]!.y - l[0]!.y) * along.y) < 1e-4 && distance(l[0]!, l[1]!) > 0.1);
        for (const l of lines) push(slabAlong(l[0]!, l[1]!, 0.02), bottom, top, 'glass');
        if (lines.length > 0) break;
      }
      panes();
      break;
    default:
      // Open: an awning out from its head, a hopper and a pivot about their middle.
      if (open && s.operation === 'awning') tilt(top, Math.PI / 6);
      else if (open && s.operation === 'hopper') tilt((bottom + top) / 2, -Math.PI / 5);
      else if (open && s.operation === 'pivot') tilt((bottom + top) / 2, Math.PI / 3);
      panes();
      turning = undefined;
  }
  return parts;
}
