// Dividing, joining and cornering walls (pure), as Revit's Split, ArchiCAD's and Coohom's merge, and
// Revit's Trim/Extend to Corner. Doors and windows stay where they are: each goes to the part it lies
// on, measured again on it (from that part's start, or still from the end it was measured from when
// that end is the same); a distributed group split by the cut is undone into plain positions.

import type { Doc, DocWall } from '../project/doc';
import { hostsIn } from '../project/derived-queries';
import { MIN_WALL_LENGTH } from '../model/tolerance';
import { cross, distance, dot, normalize, type Point2, sub } from '../model/vector';
import { deriveOpenings, referenceLength } from '../elements/opening/derive';
import type { Opening, PositionRule } from '../elements/opening/schema';
import type { EndJoin } from '../elements/wall/schema';
import type { DimAnchor } from '../elements/dimension/schema';
import { arcOf, pointAt } from '../elements/wall/geometry/arc';
import { stretchEnd } from '../elements/wall/edit';
import { GRID_STEP } from '../session/snap';
import type { WallId } from '../elements/wall/schema';
import type { ElementId } from '../core/id';
import { meet } from '../elements/wall/edit';

/** A part shorter than the snap grid's step is a slip of the pointer, not a wall: no split leaves one. */
const MIN_PART = GRID_STEP;

/** How far along the wall's reference line (from its start) the point lies, its foot on it; null off its run. */
function stationOf(w: DocWall, p: Point2): number | null {
  const arc = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 });
  if (!arc) {
    const u = normalize(sub(w.end, w.start));
    const s = dot(sub(p, w.start), u);
    return s > 0 && s < distance(w.start, w.end) ? s : null;
  }
  const dir = Math.sign(arc.sweep);
  const a = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
  const delta = ((((a - arc.startAngle) * dir) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return delta > 0 && delta < Math.abs(arc.sweep) ? delta * arc.radius : null;
}

export type SplitProblem = 'tooShort' | 'throughOpening';

/**
 * The wall split at the point's foot on it: the first part keeps its id, the second takes `newId`.
 * Refused when a part would be too short, or when the cut would go through a door or a window.
 */
export function splitWall(doc: Doc, wallId: WallId, at: Point2, newId: WallId): Doc | SplitProblem {
  const w = doc.walls.find((x) => x.id === wallId);
  if (!w) return 'tooShort';
  const s = stationOf(w, at);
  const len = referenceLength(w);
  if (s === null || s < MIN_PART || len - s < MIN_PART) return 'tooShort';
  const placed = deriveOpenings(doc.openings, hostsIn(doc), doc.openingGroups).placed;
  const mine = doc.openings.filter((o) => o.wallId === w.id);
  if (mine.some((o) => {
    const p = placed.get(o.id);
    return p !== undefined && p.start < s && p.end > s;
  })) return 'throughOpening';

  // The cut point on the wall itself, and the two parts (an arc's sweep shared between them).
  const arc = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 });
  let first: DocWall;
  let second: DocWall;
  if (arc) {
    const dir = Math.sign(arc.sweep);
    const phi = (s / arc.radius) * dir;
    const cut = pointAt(arc, arc.startAngle + phi);
    first = { ...w, end: cut, bulge: Math.tan(phi / 4) };
    second = { ...w, id: newId, start: cut, bulge: Math.tan((arc.sweep - phi) / 4) };
  } else {
    const u = normalize(sub(w.end, w.start));
    const cut = { x: w.start.x + u.x * s, y: w.start.y + u.y * s };
    first = { ...w, end: cut };
    second = { ...w, id: newId, start: cut };
  }
  // Each part keeps only the join chosen for its outer end: at the cut the two parts simply meet.
  first = withEndJoins(first, w.joins?.start, undefined);
  second = withEndJoins(second, undefined, w.joins?.end);

  // Which part each opening of the wall goes to; a group whose openings fall on both is undone.
  const onSecond = new Set(mine.filter((o) => (placed.get(o.id)?.start ?? 0) >= s).map((o) => o.id));
  const groups = doc.openingGroups.filter((g) => g.wallId === w.id);
  const broken = new Set(groups.filter((g) => g.members.some((m) => onSecond.has(m)) && g.members.some((m) => !onSecond.has(m))).map((g) => g.id));
  const plain = (o: Opening, from: number): PositionRule => ({ kind: 'fromStart', distance: (placed.get(o.id)?.start ?? 0) - from });
  const openings = doc.openings.map((o) => {
    if (o.wallId !== w.id) return o;
    const second = onSecond.has(o.id);
    const r = o.rule;
    let rule: PositionRule;
    if (r.kind === 'inGroup' && !broken.has(r.groupId)) rule = r;
    else if (r.kind === 'aligned') rule = r;
    // Still measured from the end it was measured from, where that end is the same.
    else if (r.kind === 'fromStart' && !second) rule = r;
    else if (r.kind === 'fromEnd' && second) rule = r;
    else if (r.kind === 'fromOpening' && onSecond.has(r.openingId) === second) rule = r;
    else rule = plain(o, second ? s : 0);
    return { ...o, wallId: second ? newId : o.wallId, rule };
  });
  const openingGroups = doc.openingGroups
    .filter((g) => !broken.has(g.id))
    .map((g) => {
      if (g.wallId !== w.id) return g;
      // The stretch it kept to was bounded by the old wall's joints: the new part's ends are others.
      const { between: _, ...rest } = g;
      return g.members.every((m) => onSecond.has(m)) ? { ...rest, wallId: newId } : rest;
    });
  // The new part goes after the others, as a new wall does: every other wall keeps its number.
  const walls = [...doc.walls.map((x) => (x.id === w.id ? first : x)), second];
  // A dimension held from the wall's end is the second part's now (the same end, the same distance);
  // one from its start stays on the first. An arc's measure goes to the part it lies on.
  const onPart = (x: DimAnchor): DimAnchor => (x.kind === 'wall' && x.wallId === w.id && x.end === 'end' ? { ...x, wallId: newId } : x);
  const dimensions = doc.dimensions.map((d) => (onPart(d.a) === d.a && onPart(d.b) === d.b ? d : { ...d, a: onPart(d.a), b: onPart(d.b) }));
  const f = s / len;
  const measures = doc.measures.map((m) => ('wallId' in m && m.wallId === w.id ? (m.t <= f ? { ...m, t: m.t / f } : { ...m, wallId: newId, t: (m.t - f) / (1 - f) }) : m));
  return { ...doc, walls, openings, openingGroups, dimensions, measures };
}

/** The wall with these end joins only (an end without one: automatic), no joins key when it has none. */
function withEndJoins(w: DocWall, start: EndJoin | undefined, end: EndJoin | undefined): DocWall {
  const { joins: _old, ...rest } = w;
  const joins = { ...(start ? { start } : {}), ...(end ? { end } : {}) };
  return start || end ? { ...rest, joins } : rest;
}

/** Whether two walls can be joined into one: straight, in line, end to end, of one type, line and height. */
export function canMerge(doc: Doc, a: string, b: string): boolean {
  return mergedEnds(doc, a, b) !== null;
}

function mergedEnds(doc: Doc, a: string, b: string): { start: Point2; end: Point2; flipB: boolean; aFirst: boolean } | null {
  const wa = doc.walls.find((w) => w.id === a);
  const wb = doc.walls.find((w) => w.id === b);
  if (!wa || !wb || wa.bulge || wb.bulge || wa.levelId !== wb.levelId) return null;
  if (wa.wallTypeId !== wb.wallTypeId || wa.referenceLine !== wb.referenceLine) return null;
  if (JSON.stringify([wa.top, wa.baseOffset]) !== JSON.stringify([wb.top, wb.baseOffset])) return null;
  const ua = normalize(sub(wa.end, wa.start));
  const ub = normalize(sub(wb.end, wb.start));
  if (Math.abs(cross(ua, ub)) > 1e-9) return null;
  const tol = 1e-6;
  const flipB = dot(ua, ub) < 0;
  // Same direction once b is turned to a's: a's end on b's start, or b's end on a's start.
  const bStart = flipB ? wb.end : wb.start;
  const bEnd = flipB ? wb.start : wb.end;
  if (distance(wa.end, bStart) <= tol) return { start: wa.start, end: bEnd, flipB, aFirst: true };
  if (distance(bEnd, wa.start) <= tol) return { start: bStart, end: wa.end, flipB, aFirst: false };
  return null;
}

/** The two walls as one (the first keeps its id and its side); doors and windows stay where they are. */
export function mergeWalls(doc: Doc, a: string, b: string): Doc | null {
  const m = mergedEnds(doc, a, b);
  if (!m) return null;
  const wa = doc.walls.find((w) => w.id === a)!;
  const wb = doc.walls.find((w) => w.id === b)!;
  const placed = deriveOpenings(doc.openings, hostsIn(doc), doc.openingGroups).placed;
  // Stations on the merged wall: a's openings shift by b's length when b comes first; b's are
  // measured from the merged start (turned round when b ran the other way).
  const lenA = distance(wa.start, wa.end);
  const lenB = distance(wb.start, wb.end);
  // Each outer end keeps the join chosen for it, from the wall that owned it (b's ends swapped when it
  // ran the other way); where the two met there is no end any more.
  const bOuter = m.aFirst ? (m.flipB ? wb.joins?.start : wb.joins?.end) : m.flipB ? wb.joins?.end : wb.joins?.start;
  const merged: DocWall = withEndJoins({ ...wa, start: m.start, end: m.end }, m.aFirst ? wa.joins?.start : bOuter, m.aFirst ? bOuter : wa.joins?.end);
  // A dimension held by either wall is held by the merged one, at the same point: from the end that
  // is still an end, else from the merged start; across b's other way round, its offset turns over.
  const onMerged = (x: DimAnchor): DimAnchor => {
    if (x.kind !== 'wall' || (x.wallId !== a && x.wallId !== b)) return x;
    if (x.wallId === a) {
      if (m.aFirst ? x.end === 'start' : x.end === 'end') return x;
      const t = x.end === 'start' ? x.along : lenA - x.along;
      return { ...x, end: 'start', along: m.aFirst ? t : lenB + t };
    }
    // b's end that is an end of the merged wall: its merged end, the same distance in.
    const bEnd = m.flipB ? (x.end === 'start' ? 'end' : 'start') : x.end;
    const offset = m.flipB ? -x.offset : x.offset;
    if (m.aFirst ? bEnd === 'end' : bEnd === 'start') return { ...x, wallId: a, end: bEnd, offset };
    const t = bEnd === 'start' ? x.along : lenB - x.along;
    return { ...x, wallId: a, end: 'start', along: m.aFirst ? lenA + t : t, offset };
  };
  const dimensions = doc.dimensions.map((d) => (onMerged(d.a) === d.a && onMerged(d.b) === d.b ? d : { ...d, a: onMerged(d.a), b: onMerged(d.b) }));
  const station = (o: Opening): number => {
    const p = placed.get(o.id);
    if (!p) return 0;
    if (o.wallId === a) return m.aFirst ? p.start : lenB + p.start;
    // On b: from b's own start, or from its end when it ran the other way.
    const along = m.flipB ? lenB - p.end : p.start;
    return m.aFirst ? lenA + along : along;
  };
  const groups = new Set(doc.openingGroups.filter((g) => g.wallId === a || g.wallId === b).map((g) => g.id));
  const openings = doc.openings.map((o) =>
    o.wallId === a || o.wallId === b
      ? {
          ...o,
          wallId: a,
          // Plain positions on the joined wall; a group is undone (its stretch was one of the two walls).
          rule: o.rule.kind === 'aligned' ? o.rule : ({ kind: 'fromStart', distance: station(o) } as PositionRule),
          // A door on b, turned round, hinges on the other jamb and opens to the other side.
          ...(o.wallId === b && m.flipB ? { hinge: o.hinge === 'start' ? 'end' : 'start', swing: o.swing === 'left' ? 'right' : 'left' } : {}),
        }
      : o,
  ) as Opening[];
  return {
    ...doc,
    walls: doc.walls.filter((w) => w.id !== b).map((w) => (w.id === a ? merged : w)),
    openings,
    openingGroups: doc.openingGroups.filter((g) => !groups.has(g.id)),
    dimensions,
  };
}

/**
 * Two walls made to meet at a corner (Revit's Trim/Extend to Corner): each one's end nearer where
 * their lines cross goes there, the walls joined at those ends following. Null when they are about
 * parallel (edit.ts meet) or either is an arc.
 */
export function cornerWalls(doc: Doc, a: ElementId, b: ElementId): DocWall[] | null {
  const wa = doc.walls.find((w) => w.id === a);
  const wb = doc.walls.find((w) => w.id === b);
  if (!wa || !wb || wa.bulge || wb.bulge || a === b) return null;
  // About parallel (meet's guard): their lines cross far off, and both would stretch there.
  const x = meet(wa.start, sub(wa.end, wa.start), wb.start, sub(wb.end, wb.start));
  if (!x) return null;
  const nearer = (w: DocWall) => (distance(w.start, x) <= distance(w.end, x) ? 'start' : 'end');
  const ea = nearer(wa);
  const eb = nearer(wb);
  // Either would vanish: the corner would fall on the other end.
  const other = (w: DocWall, e: 'start' | 'end') => (e === 'start' ? w.end : w.start);
  if (distance(other(wa, ea), x) < MIN_WALL_LENGTH || distance(other(wb, eb), x) < MIN_WALL_LENGTH) return null;
  const first = stretchEnd(doc, wa.id, ea, x);
  return stretchEnd({ ...doc, walls: first }, wb.id, eb, x);
}
