// The select tool's gestures. Click: select (Shift adds or removes). Drag a wall: move the selection,
// with joins kept and a live preview; one command on release. Drag an end grip: stretch that end,
// with snaps. Drag on empty space: window selection (left to right: wholly inside) or crossing
// selection (right to left: anything touched), as in Revit and AutoCAD. Esc cancels any drag.

import { distance, type Point2, sub, vec } from '../core/vector';
import { setWalls } from '../elements/wall/commands';
import type { WallEnd, WallId } from '../elements/wall/schema';
import { moveWalls, stretchEnd } from '../tools/edit';
import { GRID_STEP, type Snap } from '../tools/snap';
import type { App } from './app';
import type { DocWall } from './document';

export type Drag =
  | { readonly kind: 'move'; readonly origin: Point2; readonly walls: readonly DocWall[] }
  | { readonly kind: 'grip'; readonly id: WallId; readonly end: WallEnd; readonly walls: readonly DocWall[] }
  | { readonly kind: 'marquee'; readonly a: Point2; readonly b: Point2 };

type Pending = { kind: 'wall'; at: Point2; screen: Point2 } | { kind: 'grip'; id: WallId; end: WallEnd; screen: Point2 } | { kind: 'empty'; screen: Point2 };

const THRESHOLD_PX = 4;
const GRIP_PX = 8;

export interface SelectGestures {
  readonly down: (screen: Point2, world: Point2 | null, hit: WallId | null, shift: boolean) => void;
  readonly move: (screen: Point2, world: Point2 | null, snapAt: (p: Point2, exclude: ReadonlySet<WallId>) => Snap | null, shift: boolean) => void;
  readonly up: (shift: boolean) => void;
  readonly cancel: () => boolean;
}

export function selectGestures(app: App): SelectGestures {
  const { ui } = app;
  let pending: Pending | null = null;

  /** The selected wall's end grip under the screen point, if any (one wall selected). */
  const gripAt = (screen: Point2): { id: WallId; end: WallEnd } | null => {
    if (ui.selection.size !== 1) return null;
    const id = [...ui.selection][0]!;
    const w = app.store.get().walls.find((x) => x.id === id);
    if (!w) return null;
    for (const end of ['start', 'end'] as const) {
      const s = app.toScreen(end === 'start' ? w.start : w.end);
      if (s && distance(s, screen) <= GRIP_PX) return { id, end };
    }
    return null;
  };

  return {
    down(screen, world, hit, shift) {
      const grip = gripAt(screen);
      if (grip) pending = { kind: 'grip', ...grip, screen };
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

    move(screen, world, snapAt, shift) {
      const drag = ui.drag;
      if (pending && !drag) {
        if (distance(screen, pending.screen) < THRESHOLD_PX) return;
        if (pending.kind === 'wall' && ui.selection.size > 0) ui.drag = { kind: 'move', origin: pending.at, walls: app.store.get().walls };
        else if (pending.kind === 'grip') ui.drag = { kind: 'grip', id: pending.id, end: pending.end, walls: app.store.get().walls };
        else if (pending.kind === 'empty') ui.drag = { kind: 'marquee', a: pending.screen, b: screen };
      }
      const d = ui.drag;
      if (!d) return;
      const doc = app.store.get();
      if (d.kind === 'marquee') ui.drag = { ...d, b: screen };
      else if (d.kind === 'move' && world) {
        let delta = sub(world, d.origin);
        if (shift) delta = Math.abs(delta.x) >= Math.abs(delta.y) ? vec(delta.x, 0) : vec(0, delta.y);
        if (ui.snaps) delta = vec(Math.round(delta.x / GRID_STEP) * GRID_STEP, Math.round(delta.y / GRID_STEP) * GRID_STEP);
        ui.drag = { ...d, walls: moveWalls(doc, [...ui.selection], delta) };
      } else if (d.kind === 'grip' && world) {
        const s = snapAt(world, new Set([d.id]));
        ui.snap = s;
        ui.drag = { ...d, walls: stretchEnd(doc, d.id, d.end, s?.point ?? world) };
      }
      app.refresh();
    },

    up(shift) {
      const d = ui.drag;
      pending = null;
      ui.drag = null;
      ui.snap = null;
      if (d?.kind === 'move' || d?.kind === 'grip') app.store.dispatch(setWalls(d.walls));
      else if (d?.kind === 'marquee') selectByMarquee(app, d.a, d.b, shift);
      app.refresh();
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

/** Window (dragged to the right): pieces wholly inside. Crossing (to the left): any piece touched. */
function selectByMarquee(app: App, a: Point2, b: Point2, additive: boolean): void {
  const crossing = b.x < a.x;
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const inRect = (p: Point2) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  if (!additive) app.ui.selection.clear();
  for (const solid of app.geometry.solids.values()) {
    if (app.ui.view === 'plan' && solid.wall.levelId !== app.ui.levelId) continue;
    const outlines = solid.pieces.map((p) => app.outlineOnScreen(p.polygon, solid.bottom, solid.top));
    const vertices = outlines.flat();
    if (vertices.length === 0) continue;
    const take = crossing ? outlines.some((o) => touchesRect(o, x0, y0, x1, y1)) : vertices.every(inRect);
    if (take) app.ui.selection.add(solid.wall.id);
  }
}

/** Whether a convex screen polygon and the rectangle share any point. */
function touchesRect(poly: readonly Point2[], x0: number, y0: number, x1: number, y1: number): boolean {
  if (poly.some((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1)) return true;
  // Separating axis test on the rectangle's and the polygon's edge normals.
  const rect = [vec(x0, y0), vec(x1, y0), vec(x1, y1), vec(x0, y1)];
  const axes = [...poly.map((p, i) => sub(poly[(i + 1) % poly.length]!, p)), vec(1, 0), vec(0, 1)].map((e) => vec(-e.y, e.x));
  return axes.every((ax) => {
    const proj = (ps: readonly Point2[]) => ps.map((p) => p.x * ax.x + p.y * ax.y);
    const [pa, pb] = [proj(poly), proj(rect)];
    return Math.max(...pa) >= Math.min(...pb) && Math.max(...pb) >= Math.min(...pa);
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

