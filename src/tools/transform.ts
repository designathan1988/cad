// Moving, copying, turning, scaling and mirroring the selection (pure), as Revit's Modify tools and
// SketchUp's Move, Rotate and Scale do. What goes: the selected walls with their doors, windows and
// distributed groups; the rooms all of whose walls go, and the selected ones; the selected outline
// floors (a room's floor follows its room) and guides. In place, the walls joined to the selection keep
// their joins (edit.ts), unless disjoined; copied, the copies stand apart and the originals stay. A scale changes lengths
// and positions, never thicknesses or the sizes of doors and windows. A mirror swaps each wall's ends,
// so its layers, and its doors' hinges, come out mirrored rather than turned over.

import { copyKinds, KINDS, kindOfId, kindsOnLevel, listOf, mapKinds } from '../elements/registry';
import { wallsOnGrids } from '../elements/grid/carry';
import { roomsGoingWith } from '../app/carry';
import type { Doc, DocWall } from '../project/doc';
import type { DerivedGeometry } from '../project/derive';
import { add, dot, normalize, type Point2, scale, sub } from '../model/vector';
import { GROUP_PREFIX, type GroupSpacing, type Opening, type OpeningGroup, OPENING_PREFIX, type PositionRule } from '../elements/opening/schema';
import { aimAt } from '../app/opening-ui';
import { transformWalls } from './edit';
import { ruleAt } from './opening-tool';

export interface Transform {
  /** Where a point goes. */
  readonly map: (p: Point2) => Point2;
  /** A mirror: what was on the left of a line is now on its right. */
  readonly mirror: boolean;
  /** How lengths change: 1 but for a scale. */
  readonly factor: number;
}

export const translation = (d: Point2): Transform => ({ map: (p) => add(p, d), mirror: false, factor: 1 });

/** About `pivot`, counter-clockwise by `angle` radians. */
export function rotation(pivot: Point2, angle: number): Transform {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    map: (p) => {
      const d = sub(p, pivot);
      return add(pivot, { x: d.x * c - d.y * s, y: d.x * s + d.y * c });
    },
    mirror: false,
    factor: 1,
  };
}

/** From `base`, every length times k (k > 0). */
export const scaling = (base: Point2, k: number): Transform => ({ map: (p) => add(base, scale(sub(p, base), k)), mirror: false, factor: k });

/** Across the line through a and b. */
export function reflection(a: Point2, b: Point2): Transform {
  const u = normalize(sub(b, a));
  return {
    map: (p) => {
      const v = sub(p, a);
      return add(a, sub(scale(u, 2 * dot(v, u)), v));
    },
    mirror: true,
    factor: 1,
  };
}


const otherEnd = <T extends 'start' | 'end'>(e: T): 'start' | 'end' => (e === 'start' ? 'end' : 'start');

/** An opening's rule on its wall as taken: distances scaled; mirrored, measured from the other end. */
function mapRule(rule: PositionRule, t: Transform, ids: (id: string) => string): PositionRule {
  const k = t.factor;
  switch (rule.kind) {
    case 'fromStart':
      return { kind: t.mirror ? 'fromEnd' : 'fromStart', distance: rule.distance * k };
    case 'fromEnd':
      return { kind: t.mirror ? 'fromStart' : 'fromEnd', distance: rule.distance * k };
    case 'centered':
      return rule;
    case 'fromOpening':
      return { ...rule, openingId: ids(rule.openingId), distance: rule.distance * k, toward: t.mirror ? otherEnd(rule.toward) : rule.toward };
    case 'aligned':
      return { ...rule, openingId: ids(rule.openingId), edge: t.mirror && rule.edge !== 'center' ? otherEnd(rule.edge) : rule.edge };
    case 'inGroup':
      return { ...rule, groupId: ids(rule.groupId) };
  }
}

function mapOpening(o: Opening, t: Transform, ids: (id: string) => string): Opening {
  return {
    ...o,
    id: ids(o.id),
    wallId: ids(o.wallId),
    rule: mapRule(o.rule, t, ids),
    // The hinge's jamb was toward one end; mirrored, that end is the wall's other one now. The swing
    // stays on the same side of the (swapped) wall: the mirrored side.
    hinge: t.mirror ? otherEnd(o.hinge) : o.hinge,
  };
}

/** Metres per pixel the aim of a lone opening is taken at: 6 cm of reach off a wall's faces. */
const LONE_MPP = 0.01;

/**
 * Where a door or window selected without its wall goes: its middle taken by `t`, onto the wall of its
 * level found there (its own or another), as a drag puts it. Onto another wall, a door opens to the
 * side its middle lands on, as when it is placed. Null when no wall is there.
 */
function placeLone(doc: Doc, g: DerivedGeometry, o: Opening, t: Transform): Pick<Opening, 'wallId' | 'rule' | 'swing'> | null {
  const placed = g.openings.get(o.id);
  const f = placed?.frame;
  const host = doc.walls.find((w) => w.id === o.wallId);
  if (!placed || !f || !host) return null;
  const middle = add(f.start, scale(f.dir, (placed.end - placed.start) / 2));
  const aim = aimAt(doc, g, host.levelId, t.map(middle), LONE_MPP, o.id);
  if (!aim) return null;
  const swing = aim.wallId !== o.wallId ? aim.side : t.mirror ? (o.swing === 'left' ? 'right' : 'left') : o.swing;
  return { wallId: aim.wallId, rule: ruleAt(aim, o.width), swing };
}

function mapSpacing(s: GroupSpacing, t: Transform): GroupSpacing {
  if (s.kind === 'equal') return s;
  const anchor = t.mirror && s.anchor !== 'centered' ? otherEnd(s.anchor) : s.anchor;
  return { ...s, gap: s.gap * t.factor, distance: s.distance * t.factor, anchor };
}

/**
 * The group as taken. Its stretch keeps to the walls that bound it when those come along (or stay, in
 * place); a copy bounded by walls left behind takes its whole wall.
 */
function mapGroup(g: OpeningGroup, t: Transform, ids: (id: string) => string, kept: (wallId: string) => boolean): OpeningGroup {
  const { between, ...rest } = g;
  const mapped: OpeningGroup = { ...rest, id: ids(g.id), wallId: ids(g.wallId), members: g.members.map(ids), spacing: mapSpacing(g.spacing, t) };
  if (!between || !between.every((w) => w === null || kept(w))) return mapped;
  const ends = between.map((w) => (w === null ? null : ids(w))) as [string | null, string | null];
  return { ...mapped, between: t.mirror ? [ends[1], ends[0]] : ends };
}

export interface TransformResult {
  readonly doc: Doc;
  /** What is selected after: the same elements in place, the copies when copied. */
  readonly selection: readonly string[];
}

/**
 * The selection `ids` taken by `t`, in place or copied. `g` is the geometry before (which rooms all of
 * whose walls go); `newId` names the copies. A door or window selected without its wall goes onto the
 * wall where its middle is taken (placeLone), and stays where it was (its copy is not made) when no
 * wall is there. `disjoin`, in place: the walls go alone, the walls joined to them keeping their ends,
 * as Revit's Move with Disjoin (and a drag with Alt) does.
 */
export function transformSelection(
  doc: Doc,
  g: DerivedGeometry,
  ids: readonly string[],
  t: Transform,
  copy: boolean,
  newId: (prefix: string) => string,
  disjoin = false,
): TransformResult {
  // Taken in place, an axis takes the walls on it along; its copy is an axis alone.
  const set = new Set(copy ? ids : [...ids, ...wallsOnGrids(doc, ids)]);
  const wallIds = doc.walls.filter((w) => set.has(w.id)).map((w) => w.id);
  const walls = new Set(wallIds);
  // Before the move carried one only with its wall: Move, Copy and the others did nothing to it.
  const lone = new Map(
    doc.openings.filter((o) => set.has(o.id) && !walls.has(o.wallId)).flatMap((o) => {
      const at = placeLone(doc, g, o, t);
      return at ? [[o.id, at] as const] : [];
    }),
  );
  const rooms = new Set([...roomsGoingWith(doc, g, walls), ...doc.rooms.filter((r) => set.has(r.id)).map((r) => r.id)]);
  // What goes along, for what is held by it or follows it (registry.ts): a wall that goes, a door or
  // window on one (a dimension's ends), a room that goes (its floor).
  const hostOf = new Map(doc.openings.map((o) => [o.id, o.wallId]));
  const going = (id: string) => walls.has(id) || walls.has(hostOf.get(id) ?? '') || rooms.has(id);

  if (!copy) {
    const same = (id: string) => id;
    const alone = (w: DocWall): DocWall => {
      const start = t.map(w.start);
      const end = t.map(w.end);
      return { ...w, ...(t.mirror ? { start: end, end: start } : { start, end }) };
    };
    const next: Doc = {
      ...doc,
      // A move keeps the joins' lines (edit.ts); a turn, a scale or a mirror takes the corners along.
      walls: disjoin ? doc.walls.map((w) => (walls.has(w.id) ? alone(w) : w)) : transformWalls(doc, wallIds, t.map, t.mirror, !t.mirror && t.factor === 1),
      openings: doc.openings.map((o) => (walls.has(o.wallId) ? mapOpening(o, t, same) : lone.has(o.id) ? { ...o, ...lone.get(o.id)! } : o)),
      openingGroups: doc.openingGroups.map((x) => (walls.has(x.wallId) ? mapGroup(x, t, same, () => true) : x)),
    };
    // The registry's elements by their own mapping; a room going with its walls, a dimension with what
    // holds it, a floor with its room.
    return { doc: mapKinds(next, set, t, { going, doc, geometry: g }), selection: [...ids] };
  }

  // Copies: every copied element under a new id; references between copied elements follow them.
  const ids2 = new Map<string, string>();
  const fresh = (id: string, prefix: string) => {
    const n = newId(prefix);
    ids2.set(id, n);
    return n;
  };
  // The prefixes the app tells elements apart by (an opening's, a guide's).
  for (const id of wallIds) fresh(id, 'wall');
  const openings = doc.openings.filter((o) => walls.has(o.wallId));
  for (const o of openings) fresh(o.id, OPENING_PREFIX);
  const loneCopies = doc.openings.filter((o) => lone.has(o.id)).map((o) => ({ ...o, ...lone.get(o.id)!, id: fresh(o.id, OPENING_PREFIX) }));
  const groups = doc.openingGroups.filter((x) => walls.has(x.wallId));
  for (const x of groups) fresh(x.id, GROUP_PREFIX);
  const to = (id: string) => ids2.get(id) ?? id;

  const newWalls = doc.walls
    .filter((w) => walls.has(w.id))
    .map((w) => {
      const start = t.map(w.start);
      const end = t.map(w.end);
      return { ...w, id: to(w.id), ...(t.mirror ? { start: end, end: start } : { start, end }) };
    });
  const next: Doc = {
    ...doc,
    walls: [...doc.walls, ...newWalls],
    openings: [...doc.openings, ...openings.map((o) => mapOpening(o, t, to)), ...loneCopies],
    openingGroups: [...doc.openingGroups, ...groups.map((x) => mapGroup(x, t, to, (w) => walls.has(w)))],
  };
  const selection = [
    ...newWalls.map((w) => w.id),
    ...loneCopies.map((o) => o.id),
  ];
  // The registry's elements, copied by their own mapping: a room going with its walls (numbered on from
  // its level's last), a dimension held by the copies of what held it, a room's floor with its room's copy.
  const kinds = copyKinds(next, set, t, fresh, { going, to, doc, geometry: g });
  return { doc: kinds.doc, selection: [...selection, ...kinds.added] };
}

/** Whether the selection holds anything these tools take: a wall, a door or window, a room, an outline floor or a guide. */
export function canTransform(doc: Doc, ids: readonly string[]): boolean {
  const set = new Set(ids);
  return (
    doc.walls.some((w) => set.has(w.id)) ||
    doc.openings.some((o) => set.has(o.id)) ||
    // An element that does not move alone (a room's floor follows its room, a zone its rooms) does not
    // count: Move and Rotate were offered for it and did nothing.
    KINDS.some((k) => listOf(doc, k).some((e) => set.has(e.id) && (k.moved as (x: unknown, d: { x: number; y: number }) => unknown)(e, { x: 1, y: 0 }) !== e))
  );
}

/**
 * The selection `ids` copied onto the level `levelId`, in place, as Revit's Paste Aligned to Selected
 * Levels: the walls with their doors, windows and groups, the rooms all of whose walls go, outline
 * floors and guides, each under a new id on that level (the rooms numbered on from that level's last).
 * Doors and windows selected without their wall are left out: their wall is not there.
 */
export function copyToLevel(doc: Doc, g: DerivedGeometry, ids: readonly string[], levelId: string, newId: (prefix: string) => string): TransformResult {
  const walls = new Set(doc.walls.filter((w) => ids.includes(w.id)).map((w) => w.id));
  // An axis is on every level already: it is not copied onto one (nor counted, nor selected).
  const taken = ids.filter((id) => !doc.openings.some((o) => o.id === id && !walls.has(o.wallId)) && !kindOfId(id)?.everyLevel);
  const r = transformSelection(doc, g, taken, translation({ x: 0, y: 0 }), true, newId);
  const onLevel = <T extends { readonly levelId: string }>(list: readonly T[], before: number): T[] => list.map((x, i) => (i >= before ? { ...x, levelId } : x));
  const placed = kindsOnLevel({ ...r.doc, walls: onLevel(r.doc.walls, doc.walls.length) }, doc, levelId);
  // The rooms numbered on from that level's last.
  let last = doc.rooms.filter((x) => x.levelId === levelId).reduce((n, x) => Math.max(n, Number.parseInt(x.number, 10) || 0), 0);
  const rooms = placed.rooms.map((x, i) => (i >= doc.rooms.length ? { ...x, number: String(++last) } : x));
  return {
    doc: { ...placed, rooms },
    selection: r.selection,
  };
}

/**
 * `n` copies of the selection `ids` in a series, as SketchUp's Move-copy "3x" and Revit's Array: one
 * after another at `step` (the copy just made), or, `divide`, spread evenly up to it ("/3"). From the
 * project `doc` before that copy; the selection after is the last copy.
 */
export function copiesInSeries(
  doc: Doc,
  g: DerivedGeometry,
  ids: readonly string[],
  step: Point2,
  n: number,
  divide: boolean,
  newId: (prefix: string) => string,
): TransformResult {
  const each = divide ? scale(step, 1 / n) : step;
  let r: TransformResult = { doc, selection: [...ids] };
  for (let k = 1; k <= n; k++) r = transformSelection(r.doc, g, ids, translation(scale(each, k)), true, newId);
  return r;
}
