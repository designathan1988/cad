// The select tool's gestures. Click: select (Shift adds or removes). Drag a wall: move the selection,
// with joins kept and a live preview (the rooms all of whose walls go, go too); with Alt the walls move
// alone, leaving their joins behind. A selected room moves its point, into another space if dropped
// there (as in Revit); an outline floor its outline. One command on release. Drag a door or a window (alone in the
// selection): it slides along its wall, or onto another one under the pointer, placed by the same rule
// as when it was put there (measured from the nearest wall face or opening, in 5 cm steps). Drag an end grip: stretch that end,
// with snaps. Drag on empty space: window selection (left to right: wholly inside) or crossing
// selection (right to left: anything touched), as in Revit and AutoCAD. Esc cancels any drag.

import { add, distance, dot, normalize, type Point2, scale, sub, vec } from '../core/vector';
import { setWalls } from '../elements/wall/commands';
import type { WallEnd, WallId } from '../elements/wall/schema';
import { moveWalls, rotateWalls, stretchAlong, stretchEnd } from '../tools/edit';
import { bulgeFromMiddle, straightNear } from '../tools/arc-edit';
import { handleAt } from './handles';
import { moveFloors, moveRooms, roomsGoingWith } from './carry';
import { GRID_STEP, type Snap } from '../tools/snap';
import type { App } from './app';
import type { DocWall } from './document';
import { insidePolygon, openingOutline } from './geometry';
import { updateOpening } from '../elements/opening/commands';
import type { Opening } from '../elements/opening/schema';
import { offsetThrough, placeDimension } from '../elements/dimension/anchor';
import { wallsOnGrids } from '../elements/grid/carry';
import { eachSolid, kindIds, kindLists, moveKinds } from '../elements/registry';
import { setDimensionOffset } from '../elements/dimension/commands';
import { ruleAt } from '../tools/opening-tool';
import { aimAlong, aimAt } from './opening-ui';

/** `rooms`: the rooms going with a move or a turn (carry.ts), found once when the drag starts. */
export type Drag =
  /** `ids`: the walls moved; `rooms`: the points moved (rooms going with them, and the selected ones); `floors`: the outlines. */
  | {
      readonly kind: 'move';
      readonly origin: Point2;
      readonly delta: Point2;
      readonly ids: readonly string[];
      readonly walls: readonly DocWall[];
      readonly rooms: ReadonlySet<string>;
      readonly floors: ReadonlySet<string>;
      /** The registry's elements (elements/registry.ts) going: selected (texts, axes), or on a selected axis.
       * The walls on a selected axis are among `ids`. */
      readonly kinds: ReadonlySet<string>;
    }
  | { readonly kind: 'grip'; readonly id: WallId; readonly end: WallEnd; readonly walls: readonly DocWall[] }
  /** `grab`: from the end to where the arrow was taken, kept all along so the end does not jump. */
  | { readonly kind: 'stretch'; readonly id: WallId; readonly end: WallEnd; readonly grab: Point2; readonly walls: readonly DocWall[] }
  | {
      readonly kind: 'rotate';
      readonly pivot: Point2;
      readonly from: number;
      readonly angle: number;
      readonly walls: readonly DocWall[];
      readonly rooms: ReadonlySet<string>;
    }
  /** The middle of one arc, dragged: its curvature follows the pointer, its ends stay. */
  | { readonly kind: 'bulge'; readonly id: WallId; readonly walls: readonly DocWall[] }
  /**
   * A door or a window slid along its wall (or onto another): `openings` as they would be, `grab` how
   * far along the wall from its centre it was taken, so it does not jump to the pointer.
   */
  | { readonly kind: 'slide'; readonly id: string; readonly grab: number; readonly walls: readonly DocWall[]; readonly openings: readonly Opening[] }
  /** A dimension's line dragged off what it measures: `offset` as it would be. */
  | { readonly kind: 'dimLine'; readonly id: string; readonly offset: number }
  | { readonly kind: 'marquee'; readonly a: Point2; readonly b: Point2 };

type Pending =
  | { kind: 'wall'; at: Point2; screen: Point2 }
  | { kind: 'grip'; id: WallId; end: WallEnd; screen: Point2 }
  | { kind: 'stretch'; id: WallId; end: WallEnd; at: Point2; screen: Point2 }
  | { kind: 'rotate'; pivot: Point2; at: Point2; screen: Point2 }
  | { kind: 'bulge'; id: WallId; screen: Point2 }
  | { kind: 'empty'; screen: Point2 };

/** Turning snaps to 15° steps (with snaps on, or with Shift). */
const ROTATE_STEP = Math.PI / 12;

const THRESHOLD_PX = 4;
/** An arc's middle let go this near its chord (px) makes the wall straight, with snaps on. */
const STRAIGHT_PX = 8;
/** Reach of an end grip from its centre: larger than the 9 px square drawn; 22 px (a 44 px target) on touch. */
const gripPx = (): number => (matchMedia('(pointer: coarse)').matches ? 22 : 8);

export interface SelectGestures {
  readonly down: (screen: Point2, world: Point2 | null, hit: WallId | null, shift: boolean) => void;
  /** `alone` (Alt): a move takes the walls without their joins. */
  readonly move: (screen: Point2, world: Point2 | null, snapAt: (p: Point2, exclude: ReadonlySet<WallId>) => Snap | null, shift: boolean, alone: boolean) => void;
  /** True for a click on an element: pressed on it, let go without moving. */
  readonly up: (shift: boolean) => boolean;
  readonly cancel: () => boolean;
}

export function selectGestures(app: App): SelectGestures {
  const { ui } = app;
  let pending: Pending | null = null;

  return {
    down(screen, world, hit, shift) {
      const handle = handleAt(app.handles(), screen, gripPx());
      // A door's flip control acts on the press, as a button: the door stays selected.
      if (handle?.kind === 'flip') {
        pending = null;
        app.flipDoor(handle.which, handle.id);
        return;
      }
      if (handle?.kind === 'square') pending = { kind: 'grip', id: handle.id, end: handle.end, screen };
      else if (handle?.kind === 'arrow' && world) pending = { kind: 'stretch', id: handle.id, end: handle.end, at: world, screen };
      else if (handle?.kind === 'rotate' && world) pending = { kind: 'rotate', pivot: handle.pivot, at: world, screen };
      else if (handle?.kind === 'bulge') pending = { kind: 'bulge', id: handle.id, screen };
      else if (hit && world) {
        if (shift) ui.selection.has(hit) ? ui.selection.delete(hit) : ui.selection.add(hit);
        else if (!ui.selection.has(hit)) {
          ui.selection.clear();
          ui.selection.add(hit);
        }
        pending = { kind: 'wall', at: world, screen };
      } else {
        if (!shift) ui.selection.clear();
        pending = { kind: 'empty', screen };
      }
      ui.error = null;
      app.refresh();
    },

    move(screen, world, snapAt, shift, alone) {
      const drag = ui.drag;
      if (pending && !drag) {
        if (distance(screen, pending.screen) < THRESHOLD_PX) return;
        const doc = app.store.get();
        // The walls on a selected axis go with it (elements/grid/carry.ts).
        const moving = [...doc.walls.filter((w) => ui.selection.has(w.id)).map((w) => w.id), ...wallsOnGrids(doc, [...ui.selection])];
        const carried = new Set(wallsOnGrids(doc, [...ui.selection]));
        const kinds = kindIds(doc, [...ui.selection, ...carried]);
        const going = () => roomsGoingWith(doc, app.geometry, ui.selection);
        const rooms = new Set([...going(), ...doc.rooms.filter((r) => ui.selection.has(r.id)).map((r) => r.id)]);
        const floors = new Set(doc.floors.filter((f) => ui.selection.has(f.id) && f.source.kind === 'outline').map((f) => f.id));
        const only = ui.selection.size === 1 ? [...ui.selection][0]! : null;
        const sliding = only !== null ? doc.openings.find((o) => o.id === only) : undefined;
        const placed = sliding ? app.geometry.openings.get(sliding.id) : undefined;
        const dim = only !== null ? doc.dimensions.find((x) => x.id === only) : undefined;
        if (pending.kind === 'wall' && dim) {
          ui.drag = { kind: 'dimLine', id: dim.id, offset: dim.offset };
        } else if (pending.kind === 'wall' && sliding && placed?.frame) {
          // Taken where it was pressed: that point's distance along the wall from the opening's centre.
          const f = placed.frame;
          const centre = add(f.start, scale(f.dir, (placed.end - placed.start) / 2));
          ui.drag = { kind: 'slide', id: sliding.id, grab: dot(sub(pending.at, centre), f.dir), walls: doc.walls, openings: doc.openings };
        } else if (pending.kind === 'wall' && moving.length + rooms.size + floors.size + kinds.size > 0) {
          ui.drag = { kind: 'move', origin: pending.at, delta: vec(0, 0), ids: moving, walls: doc.walls, rooms, floors, kinds };
        }
        else if (pending.kind === 'grip') ui.drag = { kind: 'grip', id: pending.id, end: pending.end, walls: doc.walls };
        else if (pending.kind === 'stretch') {
          const p = pending;
          const w = doc.walls.find((x) => x.id === p.id)!;
          ui.drag = { kind: 'stretch', id: p.id, end: p.end, grab: sub(p.at, w[p.end]), walls: doc.walls };
        } else if (pending.kind === 'rotate') {
          const from = Math.atan2(pending.at.y - pending.pivot.y, pending.at.x - pending.pivot.x);
          ui.drag = { kind: 'rotate', pivot: pending.pivot, from, angle: 0, walls: doc.walls, rooms: going() };
        }
        else if (pending.kind === 'bulge') ui.drag = { kind: 'bulge', id: pending.id, walls: doc.walls };
        else if (pending.kind === 'empty') ui.drag = { kind: 'marquee', a: pending.screen, b: screen };
      }
      const d = ui.drag;
      if (!d) return;
      const doc = app.store.get();
      if (d.kind === 'marquee') ui.drag = { ...d, b: screen };
      else if (d.kind === 'dimLine' && world) {
        // Through the pointer, on the 5 cm grid with snaps on.
        const dim = doc.dimensions.find((x) => x.id === d.id);
        const at = dim && placeDimension(doc, app.geometry, dim);
        if (at) {
          const offset = offsetThrough(at.a, at.b, world);
          ui.drag = { ...d, offset: ui.snaps ? Math.round(offset / GRID_STEP) * GRID_STEP : offset };
        }
      }
      else if (d.kind === 'move' && world) {
        let delta = sub(world, d.origin);
        if (shift) delta = Math.abs(delta.x) >= Math.abs(delta.y) ? vec(delta.x, 0) : vec(0, delta.y);
        if (ui.snaps) delta = vec(Math.round(delta.x / GRID_STEP) * GRID_STEP, Math.round(delta.y / GRID_STEP) * GRID_STEP);
        // Alone, only these walls move: the walls they met keep their ends, and the joins open.
        const walls = alone
          ? doc.walls.map((w) => (d.ids.includes(w.id) ? { ...w, start: add(w.start, delta), end: add(w.end, delta) } : w))
          : moveWalls(doc, d.ids, delta);
        ui.drag = { ...d, delta, walls };
      } else if (d.kind === 'grip' && world) {
        const s = snapAt(world, new Set([d.id]));
        ui.snap = s;
        ui.drag = { ...d, walls: stretchEnd(doc, d.id, d.end, s?.point ?? world) };
      } else if (d.kind === 'stretch' && world) {
        // Along the wall's own line; on the 5 cm grid with snaps on.
        const w = doc.walls.find((x) => x.id === d.id)!;
        const other = d.end === 'start' ? w.end : w.start;
        const walls = stretchAlong(doc, d.id, d.end, sub(world, d.grab));
        const moved = walls.find((x) => x.id === d.id)!;
        const len = distance(other, moved[d.end]);
        const snapped = ui.snaps ? Math.max(GRID_STEP, Math.round(len / GRID_STEP) * GRID_STEP) : len;
        const dir = normalize(sub(moved[d.end], other));
        ui.drag = { ...d, walls: stretchEnd(doc, d.id, d.end, add(other, scale(dir, snapped))) };
      } else if (d.kind === 'bulge' && world) {
        // Off the chord by the pointer's distance; with snaps on, within 8 px of the chord on screen
        // (at any zoom) the wall turns straight again.
        const w = doc.walls.find((x) => x.id === d.id)!;
        let bulge = bulgeFromMiddle(w.start, w.end, world);
        if (ui.snaps) bulge = straightNear(bulge, distance(w.start, w.end), STRAIGHT_PX / app.plan.scale);
        ui.drag = { ...d, walls: doc.walls.map((x) => (x.id === d.id ? { ...x, bulge } : x)) };
      } else if (d.kind === 'slide' && world) {
        const o = doc.openings.find((x) => x.id === d.id);
        const placed = app.geometry.openings.get(d.id);
        if (o && placed?.frame) {
          const mpp = 1 / app.plan.scale;
          // Its centre goes where the pointer is, less where along it the opening was taken.
          const at = sub(world, scale(placed.frame.dir, d.grab));
          const host = doc.walls.find((w) => w.id === o.wallId);
          // On a wall under the pointer (its own or another of the level); off every wall, along its own.
          const aim =
            aimAt(doc, app.geometry, ui.levelId, at, mpp, d.id) ??
            (host && !host.bulge ? aimAlong(doc, app.geometry, host.id, dot(sub(at, host.start), normalize(sub(host.end, host.start))), mpp, d.id) : null);
          if (aim) {
            const rule = ruleAt(aim, o.width);
            // Onto another wall a door opens to the side the pointer is on, as when it is placed.
            const next: Opening = aim.wallId === o.wallId ? { ...o, rule } : { ...o, wallId: aim.wallId, rule, swing: aim.side };
            ui.drag = { ...d, openings: doc.openings.map((x) => (x.id === d.id ? next : x)) };
          }
        }
      } else if (d.kind === 'rotate' && world) {
        let angle = Math.atan2(world.y - d.pivot.y, world.x - d.pivot.x) - d.from;
        if (ui.snaps || shift) angle = Math.round(angle / ROTATE_STEP) * ROTATE_STEP;
        const ids = [...ui.selection].filter((id) => doc.walls.some((w) => w.id === id));
        ui.drag = { ...d, angle, walls: rotateWalls(doc, ids, d.pivot, angle) };
      }
      app.refresh();
    },

    up(shift) {
      const d = ui.drag;
      const clicked = pending?.kind === 'wall' && !d;
      pending = null;
      ui.drag = null;
      ui.snap = null;
      if (d?.kind === 'move' || d?.kind === 'rotate') {
        // The rooms whose walls all went along go too (carry.ts): one undo step for both.
        const before = app.store.get();
        const rooms = moveRooms(before.rooms, d.rooms, dragTransform(d));
        const floors = d.kind === 'move' ? moveFloors(before.floors, d.floors, dragTransform(d)) : before.floors;
        const kinds = d.kind === 'move' ? moveKinds(before, d.kinds, d.delta) : before;
        const walls = setWalls(d.walls);
        // One undo step for the walls and what went with them; a room, a floor, a guide or a note alone is a move too.
        const moved = rooms.some((r, i) => r !== before.rooms[i]) || floors.some((f, i) => f !== before.floors[i]) || kinds !== before;
        app.store.dispatch({ label: d.kind === 'move' ? 'cmd.move' : walls.label, apply: (x) => {
          const next = walls.apply(x);
          return next === x && !moved ? x : { ...next, ...kindLists(kinds), rooms, floors };
        } });
      } else if (d?.kind === 'grip' || d?.kind === 'stretch' || d?.kind === 'bulge') app.store.dispatch(setWalls(d.walls));
      else if (d?.kind === 'slide') {
        const o = d.openings.find((x) => x.id === d.id);
        if (o) app.store.dispatch(updateOpening(o.id, { wallId: o.wallId, rule: o.rule, swing: o.swing }));
      }
      else if (d?.kind === 'dimLine') app.store.dispatch(setDimensionOffset(d.id, d.offset));
      else if (d?.kind === 'marquee') selectByMarquee(app, d.a, d.b, shift);
      app.refresh();
      return clicked;
    },

    cancel() {
      if (!ui.drag && !pending) return false;
      pending = null;
      ui.drag = null;
      ui.snap = null;
      app.refresh();
      return true;
    },
  };
}

/** Something selectable, by id, as its outlines on screen. */
export interface Pickable {
  readonly id: string;
  readonly outlines: readonly (readonly Point2[])[];
}

/** Where a move or a turn takes a point, as it stands now. */
export function dragTransform(d: Extract<Drag, { kind: 'move' | 'rotate' }>): (p: Point2) => Point2 {
  if (d.kind === 'move') return (p) => add(p, d.delta);
  const c = Math.cos(d.angle);
  const s = Math.sin(d.angle);
  return (p) => {
    const v = sub(p, d.pivot);
    return add(d.pivot, vec(v.x * c - v.y * s, v.x * s + v.y * c));
  };
}

/**
 * Window (dragged to the right): everything wholly inside. Crossing (to the left): everything
 * touched. Screen points a and b are the drag's corners.
 */
export function marqueePick(items: readonly Pickable[], a: Point2, b: Point2): string[] {
  const crossing = b.x < a.x;
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const inRect = (p: Point2) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  return items
    .filter(({ outlines }) => {
      const vertices = outlines.flat();
      if (vertices.length === 0) return false;
      return crossing ? outlines.some((o) => polygonTouchesRect(o, x0, y0, x1, y1)) : vertices.every(inRect);
    })
    .map((x) => x.id);
}

/** Walls, openings, rooms and floors of what is shown, as screen outlines (hulls in 3D). */
function selectByMarquee(app: App, a: Point2, b: Point2, additive: boolean): void {
  const g = app.visibleGeometry();
  const elevation = (levelId: string) => app.store.get().levels.find((l) => l.id === levelId)?.elevation ?? 0;
  // Each at its level's height in the view (lifted when exploded).
  const screen = (poly: readonly Point2[], bottom: number, top: number, levelId: string) => {
    const pts = app.outlineOnScreen(poly, bottom, top, app.lift(levelId));
    // In plan the outline keeps its order; in 3D the prism's corners become their hull.
    return app.ui.view === 'plan' ? pts : hull(pts);
  };
  const items: Pickable[] = [
    ...[...g.solids.values()].map((s) => ({ id: s.wall.id, outlines: s.pieces.map((p) => screen(p.polygon, s.bottom, s.top, s.wall.levelId)) })),
    ...[...g.openings.values()].map((o) => ({
      id: o.opening.id,
      outlines: [screen(openingOutline(o), o.bottom, o.top, g.solids.get(o.opening.wallId)?.wall.levelId ?? '')],
    })),
    ...[...g.rooms.values()]
      .filter((r) => r.enclosed)
      .map((r) => ({ id: r.room.id, outlines: [screen(r.outline, elevation(r.room.levelId), elevation(r.room.levelId), r.room.levelId)] })),
    ...[...g.floors.values()].map((f) => ({ id: f.floor.id, outlines: [screen(f.outline, f.bottom, f.top, f.floor.levelId)] })),
    // The registry's kinds by their outlines (a text's box as drawn at this scale, an axis's line).
    // Texts, axes and guides are in plan only: not in a window drawn in 3D. A guide has no ends: drawn
    // far past the window, only a crossing selection, which it runs through, takes it.
    ...[...eachSolid(app.visibleGeometry().kinds)]
      .filter((x) => app.ui.view === 'plan' || x.kind.solid)
      .map((x) => {
        const outlines = x.kind.outlines(x.solid, app.plan.scale).map((o) => o.map((q) => app.plan.toScreen(q)));
        if (!x.kind.endless) return { id: x.id, outlines };
        const [a, b] = outlines[0]!;
        const u = normalize(sub(b!, a!));
        return { id: x.id, outlines: [[add(a!, scale(u, -1e6)), add(a!, scale(u, 1e6))]] };
      }),
  ];
  if (!additive) app.ui.selection.clear();
  for (const id of marqueePick(items, a, b)) app.ui.selection.add(id);
}

/** Whether a screen polygon (convex or not) and the rectangle share any point. */
function polygonTouchesRect(poly: readonly Point2[], x0: number, y0: number, x1: number, y1: number): boolean {
  if (poly.some((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1)) return true;
  const corners = [vec(x0, y0), vec(x1, y0), vec(x1, y1), vec(x0, y1)];
  if (corners.some((c) => insidePolygon(poly, c))) return true;
  // Otherwise they touch only where an edge of one crosses an edge of the other.
  const cross = (o: Point2, p: Point2, q: Point2) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const within = (a: number, b: number, c: number, d: number) => Math.max(a, b) >= Math.min(c, d) && Math.max(c, d) >= Math.min(a, b);
  const meets = (a: Point2, b: Point2, c: Point2, d: Point2) => {
    const [d1, d2, d3, d4] = [cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)];
    // On one line: they meet only if their extents overlap.
    if (d1 === 0 && d2 === 0) return within(a.x, b.x, c.x, d.x) && within(a.y, b.y, c.y, d.y);
    return d1 * d2 <= 0 && d3 * d4 <= 0;
  };
  return poly.some((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return corners.some((c, k) => meets(p, q, c, corners[(k + 1) % 4]!));
  });
}


/** Convex hull of screen points (monotone chain), for a prism seen in 3D. */
export function hull(points: readonly Point2[]): Point2[] {
  const ps = [...points].sort((p, q) => p.x - q.x || p.y - q.y);
  if (ps.length < 3) return ps;
  const turn = (o: Point2, a: Point2, b: Point2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point2[] = [];
  for (const p of ps) {
    while (lower.length >= 2 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point2[] = [];
  for (const p of [...ps].reverse()) {
    while (upper.length >= 2 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

