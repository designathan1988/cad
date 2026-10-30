// The handles of the selection in plan (ref/chat.txt:219), standard across elements: a square on
// each end of a selected wall (move that end anywhere), an arrow beyond each end of a straight wall
// (stretch it along its own line), a diamond at the middle of an arc wall (bend it), an arc under the
// selection (turn it). Pure: positions on screen from a projection, and which handle is under a point.

import { add, normalize, type Point2, scale, sub } from '../model/vector';
import type { WallEnd, WallId } from '../elements/wall/schema';
import type { DocWall } from '../project/doc';
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
  /**
   * On one selected door, Revit's flip controls: `swing` (its arrows across the wall) sends the leaf to
   * the other side, `hinge` (along the wall) moves the hinge to the other jamb. `dir`: the arrows' axis.
   */
  readonly flips: readonly { readonly which: 'swing' | 'hinge'; readonly id: string; readonly at: Point2; readonly dir: Point2 }[];
}

export type HandleHit =
  | { readonly kind: 'square' | 'arrow'; readonly id: WallId; readonly end: WallEnd }
  | { readonly kind: 'rotate'; readonly pivot: Point2 }
  | { readonly kind: 'bulge'; readonly id: WallId }
  | { readonly kind: 'flip'; readonly which: 'swing' | 'hinge'; readonly id: string };

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/** Whether a disc of radius r at p touches the box. */
const discMeets = (p: Point2, r: number, b: Box) => {
  const dx = p.x - Math.max(b.x, Math.min(p.x, b.x + b.w));
  const dy = p.y - Math.max(b.y, Math.min(p.y, b.y + b.h));
  return dx * dx + dy * dy < r * r;
};

/**
 * `avoid`: screen boxes the turn handle keeps off (the temporary dimensions' values): it sat on one
 * and took its clicks, the value unreadable under it.
 */
export function handlesFor(walls: readonly DocWall[], toScreen: (p: Point2) => Point2, avoid: readonly Box[] = []): Handles {
  if (walls.length === 0) return { squares: [], arrows: [], rotate: null, bulge: null, flips: [] };
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
  // Below a value it would cover, as many times as values stack there.
  for (let k = 0; k < avoid.length; k++) {
    const hit = avoid.find((b) => discMeets(at, HANDLE_CLEAR / 2, b));
    if (!hit) break;
    at = { x: at.x, y: hit.y + hit.h + HANDLE_CLEAR / 2 + 2 };
  }
  return { squares, arrows, rotate: { at, pivot }, bulge, flips: [] };
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
  const flip = h.flips.find((f) => near(f.at));
  if (flip) return { kind: 'flip', which: flip.which, id: flip.id };
  if (h.rotate && near(h.rotate.at)) return { kind: 'rotate', pivot: h.rotate.pivot };
  if (h.bulge && near(h.bulge.at)) return { kind: 'bulge', id: h.bulge.id };
  const arrow = h.arrows.find((a) => near(a.at));
  if (arrow) return { kind: 'arrow', id: arrow.id, end: arrow.end };
  const square = h.squares.find((s) => near(s.at));
  return square ? { kind: 'square', id: square.id, end: square.end } : null;
}

/**
 * The flip controls of one door, on the side its leaf sweeps, a little in from the wall's face: the
 * swing control left of the middle, the hinge control right of it (along the wall on screen). None
 * when the door is under 36 px wide on screen (they would cover it; the keys still flip it).
 */
export function doorFlips(
  id: string,
  frame: { readonly start: Point2; readonly end: Point2; readonly normal: Point2; readonly faces: readonly [number, number] },
  leafSide: 1 | -1,
  toScreen: (p: Point2) => Point2,
): Handles['flips'] {
  const a = toScreen(frame.start);
  const b = toScreen(frame.end);
  const width = Math.hypot(b.x - a.x, b.y - a.y);
  if (width < 36) return [];
  const along = normalize(sub(b, a));
  const mid = scale(add(a, b), 0.5);
  // The face on the leaf's side, measured from the reference line: on screen, how far out it is.
  const face = leafSide > 0 ? Math.max(...frame.faces) : -Math.min(...frame.faces);
  const onFace = toScreen(add(frame.start, scale(frame.normal, leafSide * face)));
  const across = normalize(sub(toScreen(add(frame.start, scale(frame.normal, leafSide))), a));
  const base = add(mid, scale(across, Math.hypot(onFace.x - a.x, onFace.y - a.y) + 16));
  return [
    { which: 'swing', id, at: add(base, scale(along, -12)), dir: across },
    { which: 'hinge', id, at: add(base, scale(along, 12)), dir: along },
  ];
}
