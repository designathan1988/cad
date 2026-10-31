// Selection by window: what a drag on empty space picks (wholly inside a window, touched by a crossing).

import { add, normalize, type Point2, scale, sub, vec } from '../model/vector';
import type { App } from './app';
import { hull } from '../model/hull';
import { eachSolid } from '../elements/registry';
import { insidePolygon } from '../project/derive';
import * as appView from './app-view';
import type { LevelId } from '../project/doc';

/** Something selectable, by id, as its outlines on screen. */
export interface Pickable {
  readonly id: string;
  readonly outlines: readonly (readonly Point2[])[];
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

/** The elements shown (the registry's), as screen outlines (hulls in 3D). */
export function selectByMarquee(app: App, a: Point2, b: Point2, additive: boolean): void {
  // Each at its level's height in the view (lifted when exploded).
  const screen = (poly: readonly Point2[], bottom: number, top: number, levelId: LevelId) => {
    const pts = appView.outlineOnScreen(app, poly, bottom, top, appView.lift(app, levelId));
    // In plan the outline keeps its order; in 3D the prism's corners become their hull.
    return app.ui.view === 'plan' ? pts : hull(pts);
  };
  const items: Pickable[] = [
    // The registry's kinds by their outlines (a text's box as drawn at this scale, an axis's line).
    // In 3D, those with a height (contract.ts: span) as their prisms; texts, axes and guides are in plan
    // only. A guide has no ends: drawn far past the window, only a crossing selection, which it runs
    // through, takes it.
    ...[...eachSolid(app.visibleGeometry().kinds)]
      .filter((x) => app.ui.view === 'plan' || x.kind.span)
      .map((x) => {
        // One with a height (a floor) as its prism in 3D, at its level's lift.
        const span = x.kind.span?.(x.solid);
        const outlines = x.kind
          .outlines(x.solid, app.plan.scale)
          .map((o) => (span && x.levelId !== null ? screen(o, span.bottom, span.top, x.levelId) : o.map((q) => app.plan.toScreen(q))));
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
export function polygonTouchesRect(poly: readonly Point2[], x0: number, y0: number, x1: number, y1: number): boolean {
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
