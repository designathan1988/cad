// Walls in the registry (contract.ts): elements/wall holds the element, its types and layers. The wall
// system derives them together (geometry.ts: joins, the openings cut through, the layers, the cut in
// plan) and moves, copies and deletes them with their joins and doors (contract.ts: walled); the kind
// reads where each is and takes it in the selection, the views' filters, picking, windows, framing and
// select similar. The plan, the 3D, the GLB, the DXF and the panel draw them as the wall system does.

import type { DocWall } from '../../app/document';
import type { WallSolid } from '../../app/geometry';
import { isObject } from '../../core/guards';
import type { Point2 } from '../../core/vector';
import type { ElementKind } from '../contract';
import { insideRing } from '../room/derive';

export const WALL_PREFIX = 'wall';

/** Distance from p to a closed outline's sides. */
const toOutline = (poly: readonly Point2[], p: Point2): number => {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    d = Math.min(d, Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k)));
  }
  return d;
};

const distance = (s: WallSolid, p: Point2): number =>
  s.pieces.some((piece) => insideRing(piece.polygon, p)) ? 0 : Math.min(Infinity, ...s.pieces.map((piece) => toOutline(piece.polygon, p)));

export const wallKind: ElementKind<DocWall, WallSolid> = {
  key: 'walls',
  prefix: WALL_PREFIX,
  category: 'walls',
  walled: true,
  icon: 'wall',
  one: 'schedule.col.wall',
  many: 'panel.walls',
  dropped: 'fix.droppedWalls',
  exportName: 'wall.tag',
  exportColour: 'structure',
  // Checked in full by the file reader with its type (io/project-file.ts: isWall).
  valid: (w): w is DocWall => isObject(w) && typeof w.id === 'string' && typeof w.levelId === 'string',
  derive: (_doc, w, g) => g.solids.get(w.id) ?? null,
  element: (s) => s.wall,
  outlines: (s) => s.pieces.map((p) => p.polygon),
  // Inside a piece of it, or within a few pixels: aiming inside a thin wall was the only way before.
  hit: (s, p, near) => distance(s, p) <= near,
  distance,
  pick: 'walls',
  // The wall system moves and maps it with its joins (edit.ts, transform.ts).
  moved: (w) => w,
  mapped: (w, _t, id) => ({ ...w, id }),
  similar: (a, b) => a.wallTypeId === b.wallTypeId,
  // Drawn by the plan (plan-view.ts): its cut, its layers, its joins.
  plan: () => {},
  span: (s) => ({ bottom: s.bottom, top: s.top }),
  // Its panel is the walls' own (ui/panel.ts), with its type, its reference line and its constraints.
  fields: () => [],
};
