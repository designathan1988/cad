// Doors and windows stay where they are when their wall changes (pure). A rule from a wall's start or
// end is stored as a station from that end. When the host is stretched or shortened at one end (another
// wall's move dragged its corner), the opening stays at the end that did not move: kept as it was, a
// rule from the moved end would slide it along. When the host moves whole, the opening goes with it.
// Nothing else moves an opening: a wall beside it (a partition it was once measured from) moving does
// not (root cause 2: an opening is linked to another element only when the user links it).

import { distance as gap } from '../core/vector';
import { POINT_TOLERANCE } from '../core/tolerance';
import { referenceLength } from '../elements/opening/derive';
import type { Opening } from '../elements/opening/schema';
import type { Doc } from './document';

/** Within this (m) a rule's distance is unchanged. */
const SLACK = 1e-9;

export function keepOpenings(from: Doc, to: Doc): Doc {
  if (from.walls === to.walls) return to;
  const before = new Map(from.walls.map((w) => [w.id, w]));
  const after = new Map(to.walls.map((w) => [w.id, w]));
  const rules = new Map(from.openings.map((o) => [o.id, o]));
  const changed = new Map<string, Opening>();
  for (const o of to.openings) {
    const r = o.rule;
    if (r.kind !== 'fromStart' && r.kind !== 'fromEnd') continue;
    // A rule the change wrote itself (a split, a mirror, a scale) is already the one it wants.
    const prev = rules.get(o.id);
    if (!prev || prev.wallId !== o.wallId || prev.rule.kind !== r.kind || !('distance' in prev.rule) || prev.rule.distance !== r.distance) continue;
    const was = before.get(o.wallId);
    const now = after.get(o.wallId);
    if (!was || !now || was === now || was.bulge || now.bulge) continue;
    const startStayed = gap(was.start, now.start) <= POINT_TOLERANCE;
    const endStayed = gap(was.end, now.end) <= POINT_TOLERANCE;
    // Moved whole, or neither end stayed: the opening goes with its wall, its rule as it is.
    if (startStayed === endStayed) continue;
    // Kept at the end that stayed: a rule from the moved end takes the change of length.
    const longer = referenceLength(now) - referenceLength(was);
    const fromMoved = (r.kind === 'fromStart' && !startStayed) || (r.kind === 'fromEnd' && !endStayed);
    if (!fromMoved || Math.abs(longer) <= SLACK) continue;
    changed.set(o.id, { ...o, rule: { ...r, distance: r.distance + longer } });
  }
  if (changed.size === 0) return to;
  return { ...to, openings: to.openings.map((o) => changed.get(o.id) ?? o) };
}
