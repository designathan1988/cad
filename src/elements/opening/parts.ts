// The solids of a door or window in 3D (phase 5), for the 3D view and the GLB alike: upright prisms over
// convex plan polygons, each with its role (leaf, glass, frame) for its material. Without a style, the
// plain leaf or pane every file before styles had: one slab in the middle of the wall, a door's standing
// open square to the wall when doors are drawn open. With one (style.ts): the frame in the jambs and
// head (and a window's sill), the trim on both faces, the transom and its glass, the threshold, and the
// leaves or panes by how they open; drawn open (opened in the view), swinging leaves stand square to the wall and
// sliding ones are pushed to one side.

import { add, distance, normalize, type Point2, scale, sub } from '../../model/vector';
import type { DoorHandle, LeafDesign, Opening } from './schema';
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

/**
 * A leaf (a door's, or a casement's sash) as its parts: from its hinge edge at `h` along `u` for `len`,
 * `half` thick each side of that line, from z0 to z1; its design on both faces, its handle at the edge away
 * from the hinge, its hinges. In plan coordinates, so a leaf standing open at any angle is the same leaf.
 */
function leafParts(
  push: (polygon: Point2[], bottom: number, top: number, role: OpeningPart['role']) => void,
  h: Point2,
  u: Point2,
  len: number,
  half: number,
  z0: number,
  z1: number,
  design: LeafDesign,
  handle: DoorHandle,
  hinges: boolean,
): void {
  if (len < 0.05 || z1 - z0 < 0.1) return;
  const n = { x: -u.y, y: u.x };
  // A box on the leaf: s along it from the hinge edge, w across it (− one face, + the other).
  const R = (s0: number, s1: number, w0: number, w1: number) => {
    const [a0, a1] = s0 < s1 ? [s0, s1] : [s1, s0];
    const [b0, b1] = w0 < w1 ? [w0, w1] : [w1, w0];
    const at = (s: number, w: number) => add(add(h, scale(u, s)), scale(n, w));
    return ccw([at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)]);
  };
  const H = z1 - z0;
  const stile = Math.min(0.11, len / 4);
  const rail = Math.min(0.12, H / 8);
  const faces = [-1, 1] as const;
  // The leaf's frame (stiles and rails) round an infill: glass, or slats.
  const framed = (zTop: number, zBottom: number, infill: 'glass' | 'slats') => {
    push(R(0, stile, -half, half), zBottom, zTop, 'leaf');
    push(R(len - stile, len, -half, half), zBottom, zTop, 'leaf');
    push(R(stile, len - stile, -half, half), zTop - rail, zTop, 'leaf');
    push(R(stile, len - stile, -half, half), zBottom, zBottom + rail * (zBottom === z0 ? 1.6 : 1), 'leaf');
    const i0 = zBottom + rail * (zBottom === z0 ? 1.6 : 1);
    const i1 = zTop - rail;
    if (infill === 'glass') {
      push(R(stile, len - stile, -0.004, 0.004), i0, i1, 'glass');
      // Its beads, both faces.
      for (const f of faces) {
        push(R(stile, len - stile, f * half * 0.5, f * half * 0.8), i0, i0 + 0.015, 'leaf');
        push(R(stile, len - stile, f * half * 0.5, f * half * 0.8), i1 - 0.015, i1, 'leaf');
      }
    } else for (let z = i0 + 0.01; z + 0.025 <= i1; z += 0.045) push(R(stile, len - stile, -half * 0.7, half * 0.7), z, z + 0.025, 'leaf');
  };
  // Raised panels on both faces, with a margin, in rows.
  const panels = (zb: number, zt: number, rows: number) => {
    const m = Math.min(0.1, len / 5);
    const g = 0.08;
    const each = (zt - zb - 2 * m - (rows - 1) * g) / rows;
    if (each < 0.1) return;
    for (const f of faces)
      for (let r = 0; r < rows; r++) {
        const zz = zb + m + r * (each + g);
        // The panel's bevelled edge, a moulding round it, its raised field.
        push(R(m, len - m, f * half, f * (half + 0.006)), zz, zz + each, 'leaf');
        push(R(m + 0.03, len - m - 0.03, f * (half + 0.006), f * (half + 0.012)), zz + 0.03, zz + each - 0.03, 'leaf');
      }
  };
  switch (design) {
    case 'glazed':
      framed(z1, z0, 'glass');
      break;
    case 'slats':
      framed(z1, z0, 'slats');
      break;
    case 'halfGlazed': {
      const zm = z0 + H * 0.45;
      push(R(0, len, -half, half), z0, zm, 'leaf');
      panels(z0, zm, 1);
      framed(z1, zm, 'glass');
      break;
    }
    case 'panels':
      push(R(0, len, -half, half), z0, z1, 'leaf');
      panels(z0, z1, H > 1.6 ? 3 : 2);
      break;
    case 'grooves':
      push(R(0, len, -half, half), z0, z1, 'leaf');
      // Grooves across both faces, 15 cm apart: drawn as fine darker lines just proud of the face.
      for (const f of faces) for (let z = z0 + 0.15; z < z1 - 0.1; z += 0.15) push(R(0.02, len - 0.02, f * half, f * (half + 0.002)), z, z + 0.006, 'frame');
      break;
    default:
      push(R(0, len, -half, half), z0, z1, 'leaf');
  }
  // The handle, at 1 m (or the leaf's middle), 6 cm in from the edge away from the hinge, both faces.
  const zh = Math.min(z0 + 1.0, (z0 + z1) / 2);
  const e = len - 0.065;
  for (const f of faces) {
    if (handle === 'lever') {
      push(R(e - 0.025, e + 0.025, f * half, f * (half + 0.01)), zh - 0.07, zh + 0.07, 'frame');
      push(R(e - 0.12, e + 0.012, f * (half + 0.035), f * (half + 0.05)), zh - 0.009, zh + 0.009, 'frame');
      push(R(e - 0.008, e + 0.008, f * (half + 0.01), f * (half + 0.045)), zh - 0.009, zh + 0.009, 'frame');
    } else if (handle === 'knob') {
      push(R(e - 0.028, e + 0.028, f * half, f * (half + 0.012)), zh - 0.028, zh + 0.028, 'frame');
      push(R(e - 0.02, e + 0.02, f * (half + 0.012), f * (half + 0.05)), zh - 0.02, zh + 0.02, 'frame');
    } else if (handle === 'pull') {
      const zb = Math.max(z0 + 0.3, zh - 0.3);
      const zt = Math.min(z1 - 0.2, zh + 0.3);
      push(R(e - 0.012, e + 0.012, f * (half + 0.04), f * (half + 0.064)), zb, zt, 'frame');
      for (const z of [zb + 0.03, zt - 0.05]) push(R(e - 0.008, e + 0.008, f * half, f * (half + 0.04)), z, z + 0.02, 'frame');
    }
  }
  // Three hinges on the hinge edge.
  if (hinges) for (const z of [z0 + 0.2, (z0 + z1) / 2, z1 - 0.3]) push(R(-0.012, 0.012, -half - 0.004, half + 0.004), z, z + 0.1, 'frame');
}

export function openingParts(o: Placed, f: OpeningFrame, forceOpen: boolean): OpeningPart[] {
  const op = o.opening;
  const s = op.style;
  const door = op.kind === 'door';
  const [o0, o1] = f.faces;
  const mid = (o0 + o1) / 2;
  // How far it stands open: all the way when opened in the view, else as it is set.
  const amount = forceOpen ? 1 : Math.max(0, Math.min(1, s?.open ?? 0));
  const open = amount > 0;
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
  // The frame: both jambs and the head, a window's sill too, the wall's whole depth; a stop moulding
  // inside it that the leaf closes against.
  if (fr > 0) {
    push(box(0, a, lo, hi), o.bottom, o.top, 'frame');
    push(box(b, width, lo, hi), o.bottom, o.top, 'frame');
    push(box(a, b, lo, hi), o.top - fr, o.top, 'frame');
    if (!door) {
      push(box(a, b, lo, hi), o.bottom, o.bottom + fr, 'frame');
      // A window's sill stone, sloped out past the outside face.
      const out = o0 < o1 ? -1 : 1;
      const face0 = out < 0 ? lo : hi;
      push(box(-0.03, width + 0.03, Math.min(face0, face0 + out * 0.04), Math.max(face0, face0 + out * 0.04)), o.bottom - 0.03, o.bottom, 'frame');
    }
    if (door) for (const [t0, t1] of [[a, a + 0.012], [b - 0.012, b]] as const) push(box(t0, t1, mid + 0.02, mid + 0.035), o.bottom, o.top - fr, 'frame');
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
  const n = s.leaves;
  const gap = Math.min(0.025, (hi - lo) / 5);
  // Leaves or panes on two tracks, each overlapping the next; open, slid toward the hinge side by `amount`.
  const sliding = (make: (t0: number, t1: number, off: number) => void) => {
    const lap = n > 1 ? 0.05 : 0;
    const w = Math.min(clear, (clear + lap * (n - 1)) / n);
    for (let i = 0; i < n; i++) {
      const spread = n > 1 ? (i * (clear - w)) / (n - 1) : 0;
      const shut = a + spread;
      const aside = op.hinge === 'start' ? a + Math.min(spread, 0.04 * i) : b - w - Math.min(spread, 0.04 * i);
      const t0 = shut + (aside - shut) * amount;
      make(t0, t0 + w, mid + (i % 2 === 0 ? -gap : gap));
    }
  };
  // The leaves that swing: each from its hinge, turned toward the side it opens to by `amount` of 90°.
  // Their hinges and open direction as the plan symbol draws them standing open (symbol.ts).
  const swung = (make: (h: Point2, u: Point2, len: number) => void, count: number) => {
    const lines = symbolLines(o, f).filter((l) => l.length === 2 && Math.abs((l[1]!.x - l[0]!.x) * along.x + (l[1]!.y - l[0]!.y) * along.y) < 1e-4 && distance(l[0]!, l[1]!) > 0.1);
    if (lines.length === 0) {
      for (let i = 0; i < count; i++) make(P(a + (i * clear) / count, mid), along, clear / count - 0.003);
      return;
    }
    const theta = (amount * Math.PI) / 2;
    for (const l of lines) {
      const h0 = l[0]!;
      const len = distance(l[0]!, l[1]!);
      const out = normalize(sub(l[1]!, l[0]!));
      const tH = (h0.x - f.start.x) * along.x + (h0.y - f.start.y) * along.y;
      const u0 = tH < width / 2 ? along : scale(along, -1);
      const u = { x: Math.cos(theta) * u0.x + Math.sin(theta) * out.x, y: Math.cos(theta) * u0.y + Math.sin(theta) * out.y };
      // A pivot leaf turns about its pivot, a sixth of it behind (symbol.ts draws it from there): taken
      // from the line's first point, closed it ran a sixth past the strike jamb and left a slot at the
      // other, and open it turned about a point behind the pivot.
      const behind = s.operation === 'pivot' ? len / 6 : 0;
      // Closed it lies in the middle of the wall; open, about its hinge at the face (a pivot's, its pivot).
      const h = open ? add(h0, scale(out, behind)) : P(tH, mid);
      make(add(h, scale(u, -behind)), u, len - 0.003);
    }
  };
  const design: LeafDesign = s.design ?? (s.operation === 'overhead' || s.operation === 'roller' ? 'grooves' : 'flush');
  if (door) {
    const handle: DoorHandle = s.handle ?? (s.operation === 'sliding' || s.operation === 'pivot' ? 'pull' : s.operation === 'overhead' || s.operation === 'roller' || s.operation === 'folding' ? 'none' : 'lever');
    switch (s.operation) {
      case 'sliding':
        sliding((t0, t1, off) => leafParts(push, P(t0, off), along, t1 - t0, 0.018, bottom, top, design, handle, false));
        break;
      case 'overhead':
      case 'roller': {
        // Raised toward the head by `amount`, its panels (or slats) across it.
        const lift = (top - bottom - 0.06) * amount;
        leafParts(push, P(a, mid), along, clear, 0.02, bottom + lift, top, s.operation === 'roller' ? 'grooves' : design, 'none', false);
        break;
      }
      case 'folding':
        // Folded once it is open more than half way (its leaves do not stand part open).
        if (amount >= 0.5) {
          // Folded against the hinge jamb, standing out on the side it opens to.
          const w = clear / n;
          const out = op.swing === 'left' ? 1 : -1;
          for (let i = 0; i < n; i++) {
            const t = op.hinge === 'start' ? a + 0.02 + i * 0.04 : b - 0.02 - i * 0.04;
            leafParts(push, P(t, mid), scale(f.normal, out), w, 0.016, bottom, top, design, 'none', false);
          }
          break;
        }
        for (let i = 0; i < n; i++) leafParts(push, P(a + (i * clear) / n + 0.003, mid), along, clear / n - 0.006, 0.018, bottom, top, design, i === n - 1 ? handle : 'none', false);
        break;
      default:
        swung((h, u, len) => leafParts(push, h, u, len, 0.02, bottom, top, design, handle, s.operation !== 'pivot'), s.operation === 'double' ? 2 : 1);
    }
    return parts;
  }
  // Tilting toward the outside (the exterior face's side) by `angle`, about the level line at `z`.
  const outside = o0 < o1 ? -1 : 1;
  // Its protection, just outside the exterior face, over the opening between the jambs: a shutter's
  // slats (5 cm apart, laid back 2 cm), or a grille's bars (12 mm, 12 cm apart, two cross bars). A
  // shutter is drawn closed, and pushed aside when the window is drawn open (in the view); a grille stays.
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
  // A window's pane: its sash (4 bars), its glass, its glazing bars when it has them.
  const pane = (t0: number, t1: number, off: number, z0 = bottom, z1 = top) => {
    const k = Math.min(0.04, (t1 - t0) / 5, (z1 - z0) / 5);
    const d = 0.025;
    push(box(t0, t0 + k, off - d, off + d), z0, z1, 'leaf');
    push(box(t1 - k, t1, off - d, off + d), z0, z1, 'leaf');
    push(box(t0 + k, t1 - k, off - d, off + d), z0, z0 + k, 'leaf');
    push(box(t0 + k, t1 - k, off - d, off + d), z1 - k, z1, 'leaf');
    push(box(t0 + k, t1 - k, off - 0.004, off + 0.004), z0 + k, z1 - k, 'glass');
    const m = s.muntins ?? 0;
    if (m >= 2) {
      for (let i = 1; i < m; i++) {
        const t = t0 + k + ((t1 - t0 - 2 * k) * i) / m;
        push(box(t - 0.009, t + 0.009, off - 0.012, off + 0.012), z0 + k, z1 - k, 'leaf');
        const z = z0 + k + ((z1 - z0 - 2 * k) * i) / m;
        push(box(t0 + k, t1 - k, off - 0.012, off + 0.012), z - 0.009, z + 0.009, 'leaf');
      }
    }
  };
  // The panes side by side and one over another: at the mullions and transoms where they are wanted, else equal.
  const panes = () => {
    for (const [t0, t1] of paneSpans(s, a, clear)) for (const [z0, z1] of paneRows(s, bottom, top)) pane(t0, t1, mid, z0, z1);
  };
  const tilt = (z: number, angle: number) => {
    turning = { origin: { ...P(width / 2, mid), z }, axis: along, angle: outside * angle * amount };
  };
  switch (s.operation) {
    case 'sliding':
      sliding((t0, t1, off) => pane(t0, t1, off));
      break;
    case 'doubleHung': {
      // Two sashes, the upper outside the lower, overlapping a little; open, the lower one raised.
      const h = (top - bottom) / 2;
      const up = h * 0.85 * amount;
      pane(a, b, mid - gap, bottom + up, bottom + h + 0.025 + up);
      pane(a, b, mid + gap, bottom + h - 0.025, top);
      break;
    }
    case 'casement':
      if (open) {
        // Each pane swung from its hinge toward the outside by `amount` of 90°, a sash with its glass.
        swung((h, u, len) => {
          const nrm = { x: -u.y, y: u.x };
          const R = (s0: number, s1: number, w0: number, w1: number) => ccw([add(add(h, scale(u, s0)), scale(nrm, w0)), add(add(h, scale(u, s1)), scale(nrm, w0)), add(add(h, scale(u, s1)), scale(nrm, w1)), add(add(h, scale(u, s0)), scale(nrm, w1))]);
          const k = 0.045;
          push(R(0, k, -0.025, 0.025), bottom, top, 'leaf');
          push(R(len - k, len, -0.025, 0.025), bottom, top, 'leaf');
          push(R(k, len - k, -0.025, 0.025), bottom, bottom + k, 'leaf');
          push(R(k, len - k, -0.025, 0.025), top - k, top, 'leaf');
          push(R(k, len - k, -0.004, 0.004), bottom + k, top - k, 'glass');
        }, s.leaves);
        break;
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
