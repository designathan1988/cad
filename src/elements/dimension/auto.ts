// Automatic dimensioning (phase 10; Revit's Auto-Dimension, ArchiCAD's Automatic Exterior Dimensioning):
// along a wall's outer face, a chain from corner to corner through every door's and window's jambs, and
// past it the wall's whole length. Each end is held by what it measures (anchor.ts), so the chain follows
// the walls and the doors as they move. The outer face is the one with no room behind it; a wall with
// rooms on both sides is measured only when asked for by name, on its left. Pure.

import type { Doc } from '../../project/doc';
import type { DerivedGeometry } from '../../project/derive';
import { distance, dot, normalize, perp, type Point2, sub } from '../../model/vector';
import { insideRing } from '../room/derive';
import { placeDimension } from './anchor';
import { DIM_PREFIX, type DimAnchor, type Dimension } from './schema';

/** How far the chain and the overall dimension stand off the face (m). */
export const CHAIN_OFF = 0.6;
export const TOTAL_OFF = 1.1;

/**
 * The dimensions for the level's walls: those given, or (none given) every straight wall with a face
 * that has no room behind it. `id` makes the ids (the app's newId).
 */
export function autoDimensions(doc: Doc, g: DerivedGeometry, levelId: string, wallIds: readonly string[] | null, id: (prefix: string) => string): Dimension[] {
  const rooms = [...g.rooms.values()].filter((r) => r.room.levelId === levelId && r.enclosed);
  const inRoom = (p: Point2) => rooms.some((r) => insideRing(r.outline, p));
  const out: Dimension[] = [];
  for (const w of doc.walls) {
    if (w.levelId !== levelId || w.bulge || (wallIds && !wallIds.includes(w.id))) continue;
    const solid = g.solids.get(w.id);
    const length = distance(w.start, w.end);
    if (!solid || length < 1e-6) continue;
    const dir = normalize(sub(w.end, w.start));
    const normal = perp(dir);
    const pts = solid.blocks.flatMap((b) => b.polygon);
    if (pts.length === 0) continue;
    const across = (p: Point2) => dot(normal, sub(p, w.start));
    const along = (p: Point2) => dot(dir, sub(p, w.start));
    const left = Math.max(...pts.map(across));
    const right = Math.min(...pts.map(across));
    // Which face has no room behind it: a point a little past each face, at the wall's middle.
    const probe = (o: number) => ({ x: w.start.x + dir.x * (length / 2) + normal.x * o, y: w.start.y + dir.y * (length / 2) + normal.y * o });
    const leftFree = !inRoom(probe(left + 0.25));
    const rightFree = !inRoom(probe(right - 0.25));
    if (!wallIds && !leftFree && !rightFree) continue;
    const onLeft = leftFree || !rightFree;
    const face = onLeft ? left : right;
    const side = onLeft ? 1 : -1;
    // The face's corners: the farthest of its points along the wall.
    const onFace = pts.filter((p) => Math.abs(across(p) - face) < 1e-4).map(along);
    if (onFace.length < 2) continue;
    const s0 = Math.min(...onFace);
    const s1 = Math.max(...onFace);
    const corner = (s: number): DimAnchor => (s <= length / 2 ? { kind: 'wall', wallId: w.id, end: 'start', along: s, offset: face } : { kind: 'wall', wallId: w.id, end: 'end', along: length - s, offset: face });
    const stops: { s: number; a: DimAnchor }[] = [
      { s: s0, a: corner(s0) },
      { s: s1, a: corner(s1) },
    ];
    for (const o of g.openings.values()) {
      if (o.opening.wallId !== w.id || !o.valid) continue;
      for (const [s, jamb] of [
        [o.start, 'start'],
        [o.end, 'end'],
      ] as const) {
        if (s > s0 + 1e-4 && s < s1 - 1e-4) stops.push({ s, a: { kind: 'opening', openingId: o.opening.id, jamb, offset: face } });
      }
    }
    stops.sort((p, q) => p.s - q.s);
    const kept = stops.filter((p, i) => i === 0 || p.s - stops[i - 1]!.s > 1e-4);
    // Past the dimensions already on this side of the wall (both ends on it or its doors and windows):
    // a new chain over one already there hid both.
    const mine = (a: DimAnchor) => (a.kind === 'wall' ? a.wallId === w.id : a.kind === 'opening' ? g.openings.get(a.openingId)?.opening.wallId === w.id : false);
    const forward = (d: Dimension) => {
      const p = placeDimension(doc, g, d);
      return p ? dot(sub(p.b, p.a), dir) > 0 : true;
    };
    const there = [...doc.dimensions, ...out].filter((d) => d.levelId === levelId && mine(d.a) && mine(d.b));
    // An existing line's distance out from this face: its offset, on this side, whichever way it runs.
    const reach = Math.max(0, ...there.map((d) => (forward(d) ? d.offset : -d.offset) * side).filter((o) => o > 0));
    const from = reach;
    // The line a → b runs along the wall, so its left is the wall's left: the outer face's side.
    const chain = id('chain');
    if (kept.length > 2)
      for (let i = 0; i + 1 < kept.length; i++) out.push({ id: id(DIM_PREFIX), levelId, a: kept[i]!.a, b: kept[i + 1]!.a, offset: side * (from + CHAIN_OFF), chain });
    out.push({ id: id(DIM_PREFIX), levelId, a: kept[0]!.a, b: kept.at(-1)!.a, offset: side * (from + (kept.length > 2 ? TOTAL_OFF : CHAIN_OFF)) });
  }
  return out;
}
