// Locked and equal dimensions (phase 10; Revit's padlock and EQ): kept after every change of the model.
// A locked dimension keeps its length: when a change moves one of its ends, what holds the other end
// goes along (a wall moved with its joins kept, a door or a window along its wall, a free point), as far
// as the length needs. An equal chain keeps its members alike: what holds the points between its ends
// is moved to share its length out evenly. Worked out again until nothing more moves (a wall moved by
// one lock may stretch another's); what cannot be kept is said, and the change refused. Pure.

import type { Doc } from '../../project/doc';
import { deriveGeometry } from '../../project/derive';
import { add, distance, dot, normalize, type Point2, scale, sub } from '../../model/vector';
import { moveWalls, stretchEnd } from '../../tools/edit';
import { ruleKeepingPosition } from '../opening/commands';
import type { PositionRule } from '../opening/schema';
import { placeDimension, resolve } from './anchor';
import type { DimAnchor, Dimension } from './schema';

/** Lengths this close (m) are the same. */
const SAME = 1e-5;
/** Rounds of moving before giving up: a lock moving a wall another lock holds, and so on. */
const ROUNDS = 12;

export type Settled = { readonly ok: true; readonly doc: Doc } | { readonly ok: false; readonly dim: Dimension; readonly reason: 'locked' | 'equal' };

/** The chains marked equal: their members in the list's order, two or more. */
export function equalChains(dims: readonly Dimension[]): Dimension[][] {
  const by = new Map<string, Dimension[]>();
  for (const d of dims) if (d.chain && d.eq) by.set(d.chain, [...(by.get(d.chain) ?? []), d]);
  return [...by.values()].filter((c) => c.length >= 2);
}

/** The document with what holds `end` of `d` moved by `delta`; null when it cannot be moved so. */
function shiftEnd(doc: Doc, g: ReturnType<typeof deriveGeometry>, d: Dimension, end: 'a' | 'b', delta: Point2): Doc | null {
  const anchor: DimAnchor = d[end];
  const other: DimAnchor = d[end === 'a' ? 'b' : 'a'];
  if (anchor.kind === 'point') {
    const at = add(anchor.at, delta);
    // A free point shared by the chain's next member moves with it.
    return {
      ...doc,
      dimensions: doc.dimensions.map((x) => {
        if (x.id === d.id) return { ...x, [end]: { kind: 'point', at } };
        const share = (q: DimAnchor) => q.kind === 'point' && distance(q.at, anchor.at) < SAME;
        if (x.chain !== undefined && x.chain === d.chain && (share(x.a) || share(x.b))) return { ...x, ...(share(x.a) ? { a: { kind: 'point', at } } : {}), ...(share(x.b) ? { b: { kind: 'point', at } } : {}) } as Dimension;
        return x;
      }),
    };
  }
  if (anchor.kind === 'wall') {
    const w = doc.walls.find((x) => x.id === anchor.wallId);
    if (!w) return null;
    // Both ends on one wall (its length): the end the point is measured from is stretched.
    if (other.kind === 'wall' && other.wallId === anchor.wallId) {
      const from = anchor.end === 'start' ? w.start : w.end;
      return { ...doc, walls: stretchEnd(doc, w.id, anchor.end, add(from, delta)) };
    }
    return { ...doc, walls: moveWalls(doc, [w.id], delta) };
  }
  // A door or a window slides along its wall: its rule's distance changes by its move along it.
  const o = doc.openings.find((x) => x.id === anchor.openingId);
  const placed = g.openings.get(anchor.openingId);
  const w = o && doc.walls.find((x) => x.id === o.wallId);
  if (!o || !placed || !w) return null;
  const ds = dot(delta, normalize(sub(w.end, w.start)));
  // Square to its wall it cannot go.
  if (Math.abs(Math.abs(ds) - Math.hypot(delta.x, delta.y)) > 1e-6) return null;
  let rule: PositionRule | null = o.rule;
  if (rule.kind === 'centered' || rule.kind === 'aligned' || rule.kind === 'inGroup') rule = ruleKeepingPosition(doc, o.id, 'fromStart');
  if (!rule) return null;
  const moved: PositionRule | null =
    rule.kind === 'fromStart'
      ? { ...rule, distance: rule.distance + ds }
      : rule.kind === 'fromEnd'
        ? { ...rule, distance: rule.distance - ds }
        : rule.kind === 'fromOpening'
          ? { ...rule, distance: rule.distance + (rule.toward === 'end' ? ds : -ds) }
          : null;
  if (!moved || moved.distance < -1e-9) return null;
  return { ...doc, openings: doc.openings.map((x) => (x.id === o.id ? { ...x, rule: moved } : x)) };
}

/**
 * The document after `after`'s change with its locked and equal dimensions kept, or what could not be
 * kept. `before`: the document before the change, to tell which end of a lock it moved.
 */
export function settleDimensions(before: Doc, after: Doc): Settled {
  if (!after.dimensions.some((d) => d.locked !== undefined || d.eq)) return { ok: true, doc: after };
  const was = deriveGeometry(before);
  let doc = after;
  for (let round = 0; round < ROUNDS; round++) {
    const g = deriveGeometry(doc);
    let moved = false;
    for (const d of doc.dimensions) {
      if (d.locked === undefined) continue;
      const now = placeDimension(doc, g, d);
      if (!now || Math.abs(now.length - d.locked) < SAME) continue;
      // The end the change moved leads; the other follows. Neither or both moved (the lock just
      // set on a changed length, a wall stretched at both ends): its second end follows.
      const pa = resolve(before, was, d.a);
      const pb = resolve(before, was, d.b);
      const movedA = pa !== null && distance(pa, now.a) > SAME;
      const movedB = pb !== null && distance(pb, now.b) > SAME;
      const follower: 'a' | 'b' = movedB && !movedA ? 'a' : 'b';
      const u = normalize(sub(now.b, now.a));
      const delta = scale(u, follower === 'b' ? d.locked - now.length : now.length - d.locked);
      const next = shiftEnd(doc, g, d, follower, delta);
      if (!next) return { ok: false, dim: d, reason: 'locked' };
      doc = next;
      moved = true;
      break;
    }
    if (moved) continue;
    for (const chain of equalChains(doc.dimensions)) {
      const placed = chain.map((d) => placeDimension(doc, g, d));
      if (placed.some((p) => p === null)) continue;
      const first = placed[0]!.a;
      const last = placed.at(-1)!.b;
      const total = distance(first, last);
      const u = normalize(sub(last, first));
      const step = total / chain.length;
      for (let i = 1; i < chain.length; i++) {
        const at = placed[i]!.a;
        const off = step * i - dot(sub(at, first), u);
        if (Math.abs(off) < SAME) continue;
        const next = shiftEnd(doc, g, chain[i]!, 'a', scale(u, off));
        if (!next) return { ok: false, dim: chain[i]!, reason: 'equal' };
        doc = next;
        moved = true;
        break;
      }
      if (moved) break;
    }
    if (!moved) return { ok: true, doc };
  }
  const stuck = doc.dimensions.find((d) => d.locked !== undefined) ?? doc.dimensions.find((d) => d.eq)!;
  return { ok: false, dim: stuck, reason: stuck.locked !== undefined ? 'locked' : 'equal' };
}
