// Walls meeting at one point beyond what a plain L, T or X covers (§7.6): three or more arms with no
// pair in line, more than four ends, walls crossing there, or an end on a crossing. Around the point,
// each two neighbouring arms meet on the line from the point to the corner their facing faces make,
// and each arm keeps the sector between its two lines. Neighbours take the two sides of one line, so
// nothing overlaps and nothing is left open: the faces meet at the corners and the cores in the
// middle, every layer of an arm clipped by the same half-planes. A wall passing the point is two arms,
// one each way. The passage-and-abutments rule (node.ts) left a Y with a gap where the third wall met
// the passage's corner, finishes inside the junction, and five or more walls square and overlapping.

import { COLLINEAR_ANGLE, MITER_LIMIT, POINT_TOLERANCE } from '../../../core/tolerance';
import { add, cross, distance, dot, intersectLines, normalize, perp, type Point2, scale, sub, vec } from '../../../core/vector';
import { type HalfPlane, halfPlaneThrough } from '../geometry/convex';
import { faceLine, faceOffsets, intoBody, type Line, offsetOf, wallNormal } from '../geometry/offset';
import type { WallShape } from '../geometry/shape';
import type { WallEnd } from '../schema';
import type { EndCut, Notch } from './types';

export interface SectorArm {
  /** A straight wall, or the part of one up to the point, with its `end` there. */
  readonly wall: WallShape;
  readonly end: WallEnd;
  /** How far from the point, along the arm, it goes: a corner past that would swallow it. */
  readonly reach: number;
  /** For a wall passing the point (two arms, one each way): its id, the same on both. */
  readonly through?: string;
}

const TAU = 2 * Math.PI;

/** The angle from u to v turning counter-clockwise, in [0, 2π). */
function ccw(u: Point2, v: Point2): number {
  const a = Math.atan2(cross(u, v), dot(u, v));
  return a < 0 ? a + TAU : a;
}

const rotate = (u: Point2, a: number): Point2 => vec(u.x * Math.cos(a) - u.y * Math.sin(a), u.x * Math.sin(a) + u.y * Math.cos(a));

/** The arm's face on the side `side` points to, across it. */
function faceToward(arm: SectorArm, side: Point2): Line {
  const [o0, o1] = faceOffsets(arm.wall);
  return faceLine(arm.wall, dot(wallNormal(arm.wall), side) > 0 ? o1 : o0);
}

interface Gaps {
  readonly dirs: readonly Point2[];
  /** The arms counter-clockwise. */
  readonly order: readonly number[];
  /** Each arm and the next one counter-clockwise: the angle between them and the corner their facing faces make. */
  readonly gaps: readonly { a: number; b: number; gap: number; corner: Point2 | null }[];
}

/** The gaps between neighbouring arms, or null when two lie on top of each other. */
function gapsOf(arms: readonly SectorArm[]): Gaps | null {
  const n = arms.length;
  const dirs = arms.map((a) => intoBody(a.wall, a.end));
  const order = arms.map((_, i) => i).sort((i, j) => Math.atan2(dirs[i]!.y, dirs[i]!.x) - Math.atan2(dirs[j]!.y, dirs[j]!.x));
  const minGap = (COLLINEAR_ANGLE * Math.PI) / 180;
  // No corner across a straight gap.
  const gaps: { a: number; b: number; gap: number; corner: Point2 | null }[] = [];
  for (let k = 0; k < n; k++) {
    const a = order[k]!;
    const b = order[(k + 1) % n]!;
    const gap = ccw(dirs[a]!, dirs[b]!);
    if (gap < minGap) return null;
    const fa = faceToward(arms[a]!, perp(dirs[a]!));
    const fb = faceToward(arms[b]!, scale(perp(dirs[b]!), -1));
    const straight = Math.abs(gap - Math.PI) < minGap;
    gaps.push({ a, b, gap, corner: straight ? null : intersectLines(fa.point, fa.direction, fb.point, fb.direction) });
  }
  return { dirs, order, gaps };
}

const extensionOf = (arms: readonly SectorArm[]) => 2 * (MITER_LIMIT + 1) * Math.max(...arms.map((a) => a.wall.thickness));

/** Each arm's cut, in the order given, and regions taken out of some arms' walls. */
export interface Sectors {
  readonly cuts: readonly EndCut[];
  readonly notches: readonly Notch[];
}

/**
 * Each arm's cut, or null when the point cannot be split exactly: two arms on top of each other, a
 * corner past an arm's far end, or thicknesses so unlike that a dividing line falls outside the gap
 * it divides. The caller then keeps the old rule and its warning.
 *
 * An arm whose band takes in the corner between two other arms is not split in sectors, but keeps its
 * band: a wall passing the point whole, an end from the point on, squared there. The other arms are
 * split among themselves by the same rule, and that band is kept out of them (outside a passing wall's
 * faces; an end's band ahead of the point taken out as a notch): it and the rest less it cover what
 * they all do, and nothing twice. So it goes
 * - for a wall whose line passes through the point: split in sectors, the part of its band past that
 *   corner fell to no arm, a notch in its face. (Walls of one thickness through one point never take
 *   in a corner; walls drawn a few centimetres off one point do, and are joined as meeting there, the
 *   sliver squared off.)
 * - for any such arm when no dividing line fits: a thick end among thin ones at narrow angles fell to
 *   the passage rule, two of them on one side of it, overlapping.
 */
export function resolveSectors(arms: readonly SectorArm[], point: Point2): Sectors | null {
  if (arms.length < 3) return null;
  const g = gapsOf(arms);
  if (g === null) return null;
  let wide = widestTakingIn(arms, point, g, true);
  if (wide === null) {
    const split = splitSectors(arms, point, g);
    if (split) return split;
    wide = widestTakingIn(arms, point, g, false);
    if (wide === null) return null;
  }

  const w = arms[wide[0]!]!.wall;
  const restAt = arms.flatMap((_, k) => (wide.includes(k) ? [] : [k]));
  const rest = restAt.map((k) => arms[k]!);
  const extension = extensionOf(arms);
  const square = (a: SectorArm): EndCut => ({ extension, cuts: [halfPlaneThrough(point, intoBody(a.wall, a.end))] });
  // What is left: one wall crossing it whole, one end squared at the point, or sectors again.
  const restSectors: Sectors | null =
    rest.length === 2 && rest[0]!.through !== undefined && rest[0]!.through === rest[1]!.through
      ? { cuts: rest.map((): EndCut => ({ extension, cuts: [] })), notches: [] }
      : rest.length === 1
        ? { cuts: [square(rest[0]!)], notches: [] }
        : resolveSectors(rest, point);
  if (restSectors === null) return null;
  const n = wallNormal(w);
  const [o0, o1] = faceOffsets(w);
  const cuts = new Array<EndCut>(arms.length);
  // A passing wall's two arms meet across it at the point; an end is squared there.
  for (const k of wide) cuts[k] = square(arms[k]!);
  const notches: Notch[] = [...restSectors.notches];
  if (wide.length === 2) {
    restAt.forEach((k, j) => {
      const positive = dot(intoBody(arms[k]!.wall, arms[k]!.end), n) > 0;
      const face = faceLine(w, positive ? o1 : o0);
      const own = restSectors.cuts[j]!;
      cuts[k] = { ...own, extension: Math.max(own.extension, extension), cuts: [...own.cuts, halfPlaneThrough(face.point, positive ? n : scale(n, -1))] };
    });
  } else {
    // The end's band from the point on, out of every other wall there.
    const ahead = intoBody(w, arms[wide[0]!]!.end);
    const region = [halfPlaneThrough(faceLine(w, o0).point, n), halfPlaneThrough(faceLine(w, o1).point, scale(n, -1)), halfPlaneThrough(point, ahead)];
    restAt.forEach((k, j) => {
      const own = restSectors.cuts[j]!;
      cuts[k] = { ...own, extension: Math.max(own.extension, extension) };
    });
    for (const id of new Set(rest.map((a) => a.wall.id))) {
      const wall = rest.find((a) => a.wall.id === id)!.wall;
      notches.push({ wallId: id, region, layers: [0, wall.layers.length - 1] });
    }
  }
  return { cuts, notches };
}

/**
 * The thickest arm (both arms of a passing wall) whose band takes in the corner between two other
 * arms, off its faces and, for an end, ahead of the point; or null. `throughPoint`: only a passing
 * wall whose line goes through the point.
 */
function widestTakingIn(arms: readonly SectorArm[], point: Point2, g: Gaps, throughPoint: boolean): number[] | null {
  const groups: number[][] = [];
  for (const id of new Set(arms.flatMap((a) => (a.through !== undefined ? [a.through] : [])))) {
    const ks = arms.flatMap((a, k) => (a.through === id ? [k] : []));
    if (ks.length === 2 && (!throughPoint || Math.abs(offsetOf(arms[ks[0]!]!.wall, point)) <= POINT_TOLERANCE)) groups.push(ks);
  }
  if (!throughPoint)
    arms.forEach((a, k) => {
      if (a.through === undefined) groups.push([k]);
    });
  let wide: number[] | null = null;
  for (const ks of groups) {
    const w = arms[ks[0]!]!.wall;
    const ahead = ks.length === 1 ? g.dirs[ks[0]!]! : null;
    const takesIn = g.gaps.some(
      ({ a, b, corner }) =>
        corner !== null &&
        !ks.includes(a) &&
        !ks.includes(b) &&
        strictlyWithinBand(w, corner) &&
        (ahead === null || dot(sub(corner, point), ahead) > POINT_TOLERANCE),
    );
    if (takesIn && (wide === null || w.thickness > arms[wide[0]!]!.wall.thickness)) wide = ks;
  }
  return wide;
}

/**
 * The arms split in sectors around the point, or around the middle of the corners, or, last, around
 * the point with an end's sector of more than a half-turn.
 */
function splitSectors(arms: readonly SectorArm[], point: Point2, { dirs, order, gaps }: Gaps): Sectors | null {
  const n = arms.length;
  const limit = MITER_LIMIT * Math.max(...arms.map((a) => a.wall.thickness));

  /**
   * The sectors around `centre`, each line from it through a corner. `wide`: an end's sector may pass a
   * half-turn (a thin end beside the outer gap, the line to a thick neighbour's corner swung past the
   * straight): its wall is then cut by the bevels alone, and the rest of the turn, a wedge of less
   * than a half-turn and so convex, is taken out of it as a notch.
   */
  const around = (centre: Point2, wide: boolean): Sectors | null => {
    // The line between each arm and the next one counter-clockwise; a far outer corner is bevelled.
    const lines: { u: Point2; bevel: HalfPlane | null; corner: Point2 | null }[] = [];
    for (const { a, b, gap, corner } of gaps) {
      const da = dirs[a]!;
      const db = dirs[b]!;
      let c = corner;
      // Nearly in line with other faces, the corner flies off and the line would be a long taper:
      // across at the centre instead, a step, as an L does when its walls make 90° or more, on either
      // side (a gap up to three quarters of a turn). Only an acute L's outer tip is bevelled: a nearly
      // straight passage of unlike walls, bevelled on its outer side, ran the thin wall 2 m along the
      // thick one.
      if (c !== null && gap >= Math.PI / 2 && gap <= 1.5 * Math.PI && distance(c, centre) > limit) c = null;
      let u: Point2;
      if (c === null) u = rotate(da, gap / 2);
      else if (distance(c, centre) <= POINT_TOLERANCE) u = rotate(da, gap / 2);
      else u = normalize(sub(c, centre));
      const at = ccw(da, u);
      if (!(at > 0 && at < gap)) return null;
      let bevel: HalfPlane | null = null;
      if (c !== null) {
        // A corner ahead along an arm past its far end swallows it.
        if (dot(sub(c, centre), da) > arms[a]!.reach || dot(sub(c, centre), db) > arms[b]!.reach) return null;
        // An outer corner (behind the centre, all the arms on one side) too far out is bevelled, as an L's.
        if (distance(c, centre) > limit) {
          if (gap <= Math.PI) return null;
          bevel = halfPlaneThrough(add(centre, scale(u, limit)), scale(u, -1));
        }
      }
      lines.push({ u, bevel, corner: c });
    }

    const extension = extensionOf(arms);
    const cuts: EndCut[] = new Array<EndCut>(n);
    const notches: Notch[] = [];
    for (let k = 0; k < n; k++) {
      const before = lines[(k - 1 + n) % n]!;
      const after = lines[k]!;
      const arm = arms[order[k]!]!;
      const bevels = [...(before.bevel ? [before.bevel] : []), ...(after.bevel ? [after.bevel] : [])];
      // Two half-planes make the sector only when it is at most a half-turn.
      if (ccw(before.u, after.u) > Math.PI + 1e-9) {
        // A notch would take the rest of the turn out of a passing wall's other arm too.
        if (!wide || arm.through !== undefined) return null;
        // Behind its end the sector holds the way back too: the band, lengthened for the cut, would run
        // on past the centre into the other arms. It stops where its two corners reach behind it.
        const d = dirs[order[k]!]!;
        const back = Math.max(0, ...[before.corner, after.corner].flatMap((c) => (c ? [-dot(sub(c, centre), d)] : [])));
        cuts[order[k]!] = { extension, cuts: [halfPlaneThrough(sub(centre, scale(d, back)), d), ...bevels] };
        notches.push({
          wallId: arm.wall.id,
          region: [halfPlaneThrough(centre, perp(after.u)), halfPlaneThrough(centre, scale(perp(before.u), -1))],
          layers: [0, arm.wall.layers.length - 1],
        });
        continue;
      }
      cuts[order[k]!] = {
        extension,
        cuts: [halfPlaneThrough(centre, perp(before.u)), halfPlaneThrough(centre, scale(perp(after.u), -1)), ...bevels],
      };
    }
    return { cuts, notches };
  };

  // Walls of unlike thickness at wide angles (25 cm between 15 and 10): their lines meet outside the
  // corners their faces make, and from there the thick arm's sector is more than a half-turn. The node
  // fell back to the passage rule, the thin arm's finish stopping short of its corner over bare core.
  // From the middle of the corners every sector is less, where that point lies inside every arm.
  const corners = gaps.flatMap((g) => (g.corner ? [g.corner] : []));
  const middle = corners.length < 2 ? null : scale(corners.reduce((s, c) => add(s, c), vec(0, 0)), 1 / corners.length);
  return (
    around(point, false) ??
    (middle !== null && arms.every((a) => withinBand(a.wall, middle)) ? around(middle, false) : null) ??
    around(point, true)
  );
}

/**
 * Inside the wall's band, off its faces by more than rounding: a corner 0.98 mm inside a 35 cm wall's
 * face, within the 1 mm at which points meet, left a sliver of that face uncovered.
 */
function strictlyWithinBand(w: WallShape, p: Point2): boolean {
  const [o0, o1] = faceOffsets(w);
  const f = offsetOf(w, p);
  return f > o0 + OFF_FACE && f < o1 - OFF_FACE;
}

/** How far inside a face a point must be to count as inside (m): only rounding is below it. */
const OFF_FACE = 1e-9;

/** Inside the wall's band, faces included. */
function withinBand(w: WallShape, p: Point2): boolean {
  const [o0, o1] = faceOffsets(w);
  const f = offsetOf(w, p);
  return f >= o0 - POINT_TOLERANCE && f <= o1 + POINT_TOLERANCE;
}
