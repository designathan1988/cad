// Moving, copying, turning, scaling and mirroring the selection (pure), as Revit's Modify tools and
// SketchUp's Move, Rotate and Scale do. What goes: the selected walls with their doors, windows and
// distributed groups; the rooms all of whose walls go, and the selected ones; the selected outline
// floors (a room's floor follows its room) and guides. In place, the walls joined to the selection keep
// their joins (edit.ts); copied, the copies stand apart and the originals stay. A scale changes lengths
// and positions, never thicknesses or the sizes of doors and windows. A mirror swaps each wall's ends,
// so its layers, and its doors' hinges, come out mirrored rather than turned over.

import { roomsGoingWith } from '../app/carry';
import type { Doc } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { add, dot, normalize, type Point2, scale, sub } from '../core/vector';
import { GROUP_PREFIX, type GroupSpacing, type Opening, type OpeningGroup, OPENING_PREFIX, type PositionRule } from '../elements/opening/schema';
import { GUIDE_PREFIX } from '../elements/guide/schema';
import { transformWalls } from './edit';

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

/** A direction as the transform takes it, unit. */
const mapDir = (t: Transform, p: Point2, dir: Point2): Point2 => normalize(sub(t.map(add(p, dir)), t.map(p)));

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
 * whose walls go); `newId` names the copies. Openings selected without their wall stay where they are:
 * a door goes with its wall.
 */
export function transformSelection(doc: Doc, g: DerivedGeometry, ids: readonly string[], t: Transform, copy: boolean, newId: (prefix: string) => string): TransformResult {
  const set = new Set(ids);
  const wallIds = doc.walls.filter((w) => set.has(w.id)).map((w) => w.id);
  const walls = new Set(wallIds);
  const rooms = new Set([...roomsGoingWith(doc, g, walls), ...doc.rooms.filter((r) => set.has(r.id)).map((r) => r.id)]);
  const floors = new Set(doc.floors.filter((f) => set.has(f.id) && f.source.kind === 'outline').map((f) => f.id));
  const guides = new Set(doc.guides.filter((x) => set.has(x.id)).map((x) => x.id));
  const outline = (points: readonly Point2[]) => points.map(t.map);

  if (!copy) {
    const same = (id: string) => id;
    const next: Doc = {
      ...doc,
      walls: transformWalls(doc, wallIds, t.map, t.mirror),
      openings: doc.openings.map((o) => (walls.has(o.wallId) ? mapOpening(o, t, same) : o)),
      openingGroups: doc.openingGroups.map((x) => (walls.has(x.wallId) ? mapGroup(x, t, same, () => true) : x)),
      rooms: doc.rooms.map((r) => (rooms.has(r.id) ? { ...r, seed: t.map(r.seed) } : r)),
      floors: doc.floors.map((f) => (floors.has(f.id) && f.source.kind === 'outline' ? { ...f, source: { kind: 'outline', points: outline(f.source.points) } } : f)),
      guides: doc.guides.map((x) => (guides.has(x.id) ? { ...x, point: t.map(x.point), dir: mapDir(t, x.point, x.dir) } : x)),
    };
    return { doc: next, selection: [...ids] };
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
  const groups = doc.openingGroups.filter((x) => walls.has(x.wallId));
  for (const x of groups) fresh(x.id, GROUP_PREFIX);
  const roomList = doc.rooms.filter((r) => rooms.has(r.id));
  for (const r of roomList) fresh(r.id, 'room');
  const floorList = doc.floors.filter((f) => floors.has(f.id) || (f.source.kind === 'room' && rooms.has(f.source.roomId)));
  for (const f of floorList) fresh(f.id, 'floor');
  const guideList = doc.guides.filter((x) => guides.has(x.id));
  for (const x of guideList) fresh(x.id, GUIDE_PREFIX);
  const to = (id: string) => ids2.get(id) ?? id;

  const newWalls = doc.walls
    .filter((w) => walls.has(w.id))
    .map((w) => {
      const start = t.map(w.start);
      const end = t.map(w.end);
      return { ...w, id: to(w.id), ...(t.mirror ? { start: end, end: start } : { start, end }) };
    });
  // Numbered on from the level's last, as a new room is.
  const numbers = new Map<string, number>();
  const nextNumber = (levelId: string) => {
    const last = numbers.get(levelId) ?? doc.rooms.filter((r) => r.levelId === levelId).reduce((n, r) => Math.max(n, Number.parseInt(r.number, 10) || 0), 0);
    numbers.set(levelId, last + 1);
    return String(last + 1);
  };
  const newRooms = roomList.map((r) => ({ ...r, id: to(r.id), seed: t.map(r.seed), number: nextNumber(r.levelId) }));
  const newFloors = floorList.map((f) => ({
    ...f,
    id: to(f.id),
    source: f.source.kind === 'room' ? { kind: 'room' as const, roomId: to(f.source.roomId) } : { kind: 'outline' as const, points: outline(f.source.points) },
  }));
  const next: Doc = {
    ...doc,
    walls: [...doc.walls, ...newWalls],
    openings: [...doc.openings, ...openings.map((o) => mapOpening(o, t, to))],
    openingGroups: [...doc.openingGroups, ...groups.map((x) => mapGroup(x, t, to, (w) => walls.has(w)))],
    rooms: [...doc.rooms, ...newRooms],
    floors: [...doc.floors, ...newFloors],
    guides: [...doc.guides, ...guideList.map((x) => ({ ...x, id: to(x.id), point: t.map(x.point), dir: mapDir(t, x.point, x.dir) }))],
  };
  const selection = [
    ...newWalls.map((w) => w.id),
    ...doc.rooms.filter((r) => set.has(r.id)).map((r) => to(r.id)),
    ...doc.floors.filter((f) => floors.has(f.id)).map((f) => to(f.id)),
    ...guideList.map((x) => to(x.id)),
  ];
  return { doc: next, selection };
}

/** Whether the selection holds anything these tools take: a wall, a room, an outline floor or a guide. */
export function canTransform(doc: Doc, ids: readonly string[]): boolean {
  const set = new Set(ids);
  return (
    doc.walls.some((w) => set.has(w.id)) ||
    doc.rooms.some((r) => set.has(r.id)) ||
    doc.floors.some((f) => set.has(f.id) && f.source.kind === 'outline') ||
    doc.guides.some((x) => set.has(x.id))
  );
}
