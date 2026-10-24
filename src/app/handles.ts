// The handles of the selection in plan (ref/chat.txt:219), standard across elements: a square on
// each end of a selected wall (move that end anywhere), an arrow beyond each end of a straight wall
// (stretch it along its own line), a diamond at the middle of an arc wall (bend it), an arc under the
// selection (turn it). Pure: positions on screen from a projection, and which handle is under a point.

import { add, normalize, type Point2, scale, sub } from '../core/vector';
import type { WallEnd, WallId } from '../elements/wall/schema';
import type { DocWall } from './document';
import { arcMiddle } from '../tools/arc-edit';

/** How far beyond its end an arrow sits, and how far under the selection the turn handle (px). */
export const ARROW_OFFSET = 20;
export const ROTATE_OFFSET = 28;

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
  const xs = walls.flatMap((w) => [w.start.x, w.end.x]);
  const ys = walls.flatMap((w) => [w.start.y, w.end.y]);
  const pivot = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  // An arc's middle counts too: a bulge downward would otherwise put the turn handle on the wall.
  const corners = walls.flatMap((w) => [toScreen(w.start), toScreen(w.end), ...(w.bulge ? [toScreen(arcMiddle(w.start, w.end, w.bulge))] : [])]);
  const below = Math.max(...corners.map((c) => c.y));
  const centre = toScreen(pivot);
  const bulge = one?.bulge ? { id: one.id, at: toScreen(arcMiddle(one.start, one.end, one.bulge)) } : null;
  return { squares, arrows, rotate: { at: { x: centre.x, y: below + ROTATE_OFFSET }, pivot }, bulge };
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
