// Doors and windows keep to what they are measured from when the walls change (pure). A rule from a
// wall's start or end is stored as a station from that end, but read, shown and typed as the gap from
// the face of the wall beside the opening (wall-stops.ts). When another wall's move stretched the host
// at that end, the station stayed and the opening slid with the end, away from the face it was
// measured from: a bedroom window went 0.5 m along when the wall between the living room and the
// garage was dragged. Each such opening now keeps its gap to that face, wherever the face or the end
// goes; one measured from the end itself (no face before it) keeps its distance from the end.

import { dot, normalize, sub } from '../model/vector';
import { referenceLength } from '../elements/opening/derive';
import type { Opening } from '../elements/opening/schema';
import type { Doc } from '../project/doc';
import { type Stop, wallStopsOf } from '../elements/wall/stops';

/** Within this (m) a stop is the one a rule is measured from: ruleBase's own slack. */
const SLACK = 1e-9;

export function keepOpenings(from: Doc, to: Doc): Doc {
  if (from.walls === to.walls) return to;
  const before = new Map(from.walls.map((w) => [w.id, w]));
  const after = new Map(to.walls.map((w) => [w.id, w]));
  // Only the levels where a wall changed: elsewhere no stop moved.
  const levels = new Set(to.walls.filter((w) => before.get(w.id) !== w).map((w) => w.levelId));
  for (const w of from.walls) if (!after.has(w.id)) levels.add(w.levelId);
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
    if (!was || !now || was.bulge || now.bulge || !levels.has(now.levelId)) continue;
    const stops0 = wallStopsOf(from, was.id);
    const len0 = referenceLength(was);
    // The station of the jamb the rule measures to, and the face it is measured from (none: the end).
    const jamb = r.kind === 'fromStart' ? r.distance : len0 - r.distance;
    const face = r.kind === 'fromStart' ? stops0.filter((s) => s.at <= jamb + SLACK).at(-1) : stops0.find((s) => s.at >= jamb - SLACK);
    if (!face) continue;
    // That face now, as a station from the host's start; where it was, if its wall no longer meets the host.
    const shift = dot(sub(now.start, was.start), normalize(sub(was.end, was.start)));
    const again = (s: Stop): number => wallStopsOf(to, now.id).find((x) => x.wallId === s.wallId && x.face === s.face)?.at ?? s.at - shift;
    const at = again(face);
    const distance = r.kind === 'fromStart' ? at + (jamb - face.at) : referenceLength(now) - (at - (face.at - jamb));
    if (Math.abs(distance - r.distance) > SLACK) changed.set(o.id, { ...o, rule: { ...r, distance } });
  }
  if (changed.size === 0) return to;
  return { ...to, openings: to.openings.map((o) => changed.get(o.id) ?? o) };
}
