// The handles of the selection in plan (ref/chat.txt:219), standard across elements: a square on
// each end of a selected wall (move that end anywhere), an arrow beyond each end of a straight wall
// (stretch it along its own line), a diamond at the middle of an arc wall (bend it), an arc under the
// selection (turn it). Pure: positions on screen from a projection, and which handle is under a point.

import { add, normalize, type Point2, scale, sub } from '../core/vector';
import type { WallEnd, WallId } from '../elements/wall/schema';
import type { DocWall } from './document';
import { arcMiddle } from '../tools/arc-edit';
import { arcOf } from '../elements/wall/geometry/arc';

/** How far beyond its end an arrow sits, and how far under the selection the turn handle (px). */
export const ARROW_OFFSET = 20;
export const ROTATE_OFFSET = 28;
/** Least distance between the turn handle and another handle (px): both reaches and a gap. */
const HANDLE_CLEAR = 26;

export interface Handles {
  readonly squares: readonly { readonly id: WallId; readonly end: WallEnd; readonly at: Point2 }[];
  readonly arrows: readonly { readonly id: WallId; readonly end: WallEnd; readonly at: Point2; readonly dir: Point2 }[];
  /** Screen point of the turn handle, and the world point it turns about. */
  readonly rotate: { readonly at: Point2; readonly pivot: Point2 } | null;
  /** On one arc wall: at the middle of the arc, dragged to change its curvature (tools/arc-edit.ts). */
  readonly bulge: { readonly id: WallId; readonly at: Point2 } | null;
}

export type HandleHit =
  | { readonly kind: 'square' | 'arrow'; readonly id: WallId; readonly end: WallEnd }
  | { readonly kind: 'rotate'; readonly pivot: Point2 }
  | { readonly kind: 'bulge'; readonly id: WallId };

export function handlesFor(walls: readonly DocWall[], toScreen: (p: Point2) => Point2): Handles {
  if (walls.length === 0) return { squares: [], arrows: [], rotate: null, bulge: null };
  const one = walls.length === 1 ? walls[0]! : null;
  const squares = one ? (['start', 'end'] as const).map((end) => ({ id: one.id, end, at: toScreen(one[end]) })) : [];
  const arrows =
    one && !one.bulge
      ? (['start', 'end'] as const).map((end) => {
          const from = toScreen(end === 'start' ? one.end : one.start);
          const at = toScreen(one[end]);
          const dir = normalize(sub(at, from));
          return { id: one.id, end, at: add(at, scale(dir, ARROW_OFFSET)), dir };
        })
      : [];
  // An arc counts by its whole extent, not its ends: the turn handle goes under it and turns it about
  // its middle, never onto the wall.
  const extent = walls.flatMap(extentOf);
  const xs = extent.map((p) => p.x);
  const ys = extent.map((p) => p.y);
  const pivot = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const corners = extent.map(toScreen);
  const below = Math.max(...corners.map((c) => c.y));
  const centre = toScreen(pivot);
  const bulge = one?.bulge ? { id: one.id, at: toScreen(arcMiddle(one.start, one.end, one.bulge)) } : null;
  // Under the selection, clear of the other handles: under a wall standing upright on screen it fell on
  // the arrow of its lower end, which it hid and took the clicks of. Then it goes under that arrow.
  const others = [...squares.map((s) => s.at), ...arrows.map((a) => a.at), ...(bulge ? [bulge.at] : [])];
  let at = { x: centre.x, y: below + ROTATE_OFFSET };
  if (others.some((o) => Math.hypot(o.x - at.x, o.y - at.y) < HANDLE_CLEAR)) at = { x: at.x, y: Math.max(below, ...others.map((o) => o.y)) + ROTATE_OFFSET };
  return { squares, arrows, rotate: { at, pivot }, bulge };
}

/** The points that bound a wall: its ends, and for an arc the points where it turns along an axis. */
function extentOf(w: DocWall): Point2[] {
  const arc = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 });
  if (!arc) return [w.start, w.end];
  const within = (a: number) => {
    const t = ((a - arc.startAngle) * Math.sign(arc.sweep)) % (2 * Math.PI);
    return (t < 0 ? t + 2 * Math.PI : t) <= Math.abs(arc.sweep);
  };
  const axes = [0, 1, 2, 3].map((k) => (k * Math.PI) / 2).filter(within);
  return [w.start, w.end, ...axes.map((a) => ({ x: arc.center.x + arc.radius * Math.cos(a), y: arc.center.y + arc.radius * Math.sin(a) }))];
}

export function handleAt(h: Handles, screen: Point2, reach: number): HandleHit | null {
  const near = (p: Point2) => Math.hypot(p.x - screen.x, p.y - screen.y) <= reach;
  if (h.rotate && near(h.rotate.at)) return { kind: 'rotate', pivot: h.rotate.pivot };
  if (h.bulge && near(h.bulge.at)) return { kind: 'bulge', id: h.bulge.id };
  const arrow = h.arrows.find((a) => near(a.at));
  if (arrow) return { kind: 'arrow', id: arrow.id, end: arrow.end };
  const square = h.squares.find((s) => near(s.at));
  return square ? { kind: 'square', id: square.id, end: square.end } : null;
}
