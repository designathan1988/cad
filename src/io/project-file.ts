// Project files: the document as JSON, with its version. Reading checks every element on its own:
// a bad one is dropped (or fixed, when the fix is obvious) and reported, and the rest of the project
// is kept. Files from older versions are migrated; a file from a newer version is refused, never
// half-read.

import type { Stair } from '../elements/stair/schema';
import type { Roof } from '../elements/roof/schema';
import type { Beam } from '../elements/beam/schema';
import type { Column } from '../elements/column/schema';
import { type Doc, type Level, ownValuesOnly } from '../app/document';
import type { Guide } from '../elements/guide/schema';
import { isSavedView } from '../app/saved-views';
import { isPointOfInterest } from '../app/points';
import { deriveGeometry } from '../app/geometry';
import { distributeOpenings } from '../elements/opening/commands';
import type { Opening, OpeningGroup } from '../elements/opening/schema';
import { type Floor, type Room, ROOM_USES } from '../elements/room/schema';
import type { Note } from '../elements/note/schema';
import type { Dimension } from '../elements/dimension/schema';
import type { Grid } from '../elements/grid/schema';
import type { WallType } from '../elements/wall/schema';
import type { DocWall } from '../app/document';

/**
 * Version 1: walls, openings, rooms and floors, each list optional when empty in older saves.
 * Version 2: opening groups, and the aligned and in-group rules. A version 1 file has no groups.
 * Version 3: a wall's top and base offset may be left out (it takes its type's); a wall type may
 * give them. Older files always have them, so they read unchanged; older apps refuse version 3.
 * Version 4: a distributed group may keep to a stretch of its wall (`between`: the walls whose joints
 * bound it). Older groups have none and take the whole wall, as they did.
 * Version 5: guides (construction lines of a level's plan). Older files have none.
 * Version 6: saved views (saved-views.ts). Older files have none.
 * Version 7: a wall's join choice at each end (`joins`, schema.ts EndJoin). Older walls have none: automatic.
 * Version 8: points of interest (points.ts). Older files have none.
 * Version 9: a wall end can be squared off ('square' in `joins`).
 * Version 10: a room's use and its own ceiling height (`use`, `height`). Older rooms have neither.
 * Version 11: text notes (`notes`, elements/note). Older files have none.
 * Version 12: permanent dimensions (`dimensions`, elements/dimension). Older files have none.
 * Version 13: level marks, notes with an `elevation` (elements/note). Older files have none.
 * Version 14: grid axes (`grids`, elements/grid). Older files have none.
 * Version 15: columns (`columns`, elements/column). Older files have none.
 * Version 16: beams (`beams`, elements/beam). Older files have none.
 * Version 17: floors with holes, a slope, and ceilings (`holes`, `slope`, `kind`). Older floors have none.
 * Version 18: roofs (`roofs`, elements/roof). Older files have none.
 * Version 19: stairs (`stairs`, elements/stair). Older files have none.
 */
export const CURRENT_VERSION = 19;

export type ReadError = 'notJson' | 'notProject' | 'noLevels' | 'noWallTypes' | 'newerVersion';
export type Fix =
  | { readonly kind: 'droppedWalls' | 'droppedOpenings' | 'droppedRooms' | 'droppedFloors' | 'droppedGroups' | 'droppedGuides' | 'droppedViews' | 'droppedPoints' | 'droppedNotes' | 'droppedDimensions' | 'droppedGrids' | 'droppedColumns' | 'droppedBeams' | 'droppedRoofs' | 'droppedStairs'; readonly count: number }
  | { readonly kind: 'movedToFirstLevel'; readonly count: number };

export type ReadResult = { readonly ok: true; readonly doc: Doc; readonly fixes: readonly Fix[] } | { readonly ok: false; readonly error: ReadError };

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isObject = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null;
export const isPoint = (p: unknown): boolean => isObject(p) && finite(p.x) && finite(p.y);

export const isLevel = (l: unknown): l is Level =>
  isObject(l) &&
  typeof l.id === 'string' &&
  typeof l.name === 'string' &&
  finite(l.elevation) &&
  finite(l.height) &&
  l.height > 0 &&
  (l.cutHeight === undefined || (finite(l.cutHeight) && l.cutHeight > 0));

/** A top rule: the level's height plus an offset, or a fixed height above the base. Absent is fine. */
const isTop = (r: unknown): boolean =>
  r === undefined || (isObject(r) && ((r.kind === 'level' && finite(r.offset)) || (r.kind === 'fixed' && finite(r.height) && r.height > 0)));

export const isWallType = (t: unknown): t is WallType =>
  isObject(t) &&
  typeof t.id === 'string' &&
  typeof t.name === 'string' &&
  Array.isArray(t.layers) &&
  t.layers.length > 0 &&
  t.layers.every((l: unknown) => isObject(l) && finite(l.thickness) && l.thickness > 0 && typeof l.function === 'string') &&
  isTop(t.top) &&
  (t.baseOffset === undefined || finite(t.baseOffset));

export const isWall = (w: unknown): w is DocWall =>
  isObject(w) &&
  typeof w.id === 'string' &&
  isPoint(w.start) &&
  isPoint(w.end) &&
  typeof w.wallTypeId === 'string' &&
  (w.bulge === undefined || finite(w.bulge)) &&
  isTop(w.top) &&
  (w.baseOffset === undefined || finite(w.baseOffset)) &&
  (w.joins === undefined || (isObject(w.joins) && [w.joins.start, w.joins.end].every((j) => j === undefined || ['off', 'through', 'stop', 'miter', 'square'].includes(j as string))));

const isRule = (r: unknown): boolean => {
  if (!isObject(r)) return false;
  if (r.kind === 'centered') return true;
  if (r.kind === 'fromStart' || r.kind === 'fromEnd') return finite(r.distance);
  if (r.kind === 'fromOpening') return typeof r.openingId === 'string' && finite(r.distance) && (r.toward === 'start' || r.toward === 'end');
  if (r.kind === 'aligned') return typeof r.openingId === 'string' && (r.edge === 'start' || r.edge === 'center' || r.edge === 'end');
  return r.kind === 'inGroup' && typeof r.groupId === 'string';
};

const isSpacing = (s: unknown): boolean =>
  isObject(s) &&
  (s.kind === 'equal' ||
    (s.kind === 'fixed' && finite(s.gap) && s.gap >= 0 && finite(s.distance) && (s.anchor === 'start' || s.anchor === 'centered' || s.anchor === 'end')));

export const isOpeningGroup = (g: unknown): g is OpeningGroup =>
  isObject(g) &&
  typeof g.id === 'string' &&
  typeof g.wallId === 'string' &&
  Array.isArray(g.members) &&
  g.members.every((m: unknown) => typeof m === 'string') &&
  isSpacing(g.spacing) &&
  (g.between === undefined || (Array.isArray(g.between) && g.between.length === 2 && g.between.every((x: unknown) => x === null || typeof x === 'string')));

export const isOpening = (o: unknown): o is Opening =>
  isObject(o) &&
  typeof o.id === 'string' &&
  typeof o.wallId === 'string' &&
  (o.kind === 'door' || o.kind === 'window') &&
  finite(o.width) &&
  o.width > 0 &&
  finite(o.height) &&
  o.height > 0 &&
  finite(o.sill) &&
  (o.hinge === 'start' || o.hinge === 'end') &&
  (o.swing === 'left' || o.swing === 'right') &&
  isRule(o.rule);

export const isRoom = (r: unknown): r is Room =>
  isObject(r) &&
  typeof r.id === 'string' &&
  typeof r.levelId === 'string' &&
  isPoint(r.seed) &&
  typeof r.name === 'string' &&
  typeof r.number === 'string' &&
  (r.use === undefined || (ROOM_USES as readonly unknown[]).includes(r.use)) &&
  (r.height === undefined || (finite(r.height) && r.height > 0));

export const isFloor = (f: unknown): f is Floor =>
  isObject(f) &&
  typeof f.id === 'string' &&
  typeof f.levelId === 'string' &&
  finite(f.thickness) &&
  f.thickness > 0 &&
  finite(f.offset) &&
  isObject(f.source) &&
  ((f.source.kind === 'room' && typeof f.source.roomId === 'string') ||
    (f.source.kind === 'outline' && Array.isArray(f.source.points) && f.source.points.length >= 3 && f.source.points.every(isPoint))) &&
  (f.holes === undefined || (Array.isArray(f.holes) && f.holes.every((h) => Array.isArray(h) && h.length >= 3 && h.every(isPoint)))) &&
  (f.slope === undefined || (isObject(f.slope) && finite(f.slope.grade) && finite(f.slope.dir))) &&
  (f.kind === undefined || f.kind === 'ceiling');

/** A text note: a point, some text, letters taller than nothing. */
export const isNote = (n: unknown): n is Note =>
  isObject(n) &&
  typeof n.id === 'string' &&
  typeof n.levelId === 'string' &&
  isPoint(n.at) &&
  typeof n.text === 'string' &&
  finite(n.height) &&
  n.height > 0 &&
  // A level mark says a height, so it needs no text; a note does.
  (n.elevation === undefined ? n.text.trim() !== '' : isObject(n.elevation) && finite(n.elevation.offset));

/** An end of a dimension: on a wall (an end, along, across), on a jamb, or a point. */
const isDimAnchor = (a: unknown): boolean =>
  isObject(a) &&
  ((a.kind === 'wall' && typeof a.wallId === 'string' && (a.end === 'start' || a.end === 'end') && finite(a.along) && finite(a.offset)) ||
    (a.kind === 'opening' && typeof a.openingId === 'string' && (a.jamb === 'start' || a.jamb === 'end') && finite(a.offset)) ||
    (a.kind === 'point' && isPoint(a.at)));

/** A permanent dimension: two ends and the distance of its line. */
export const isDimension = (d: unknown): d is Dimension =>
  isObject(d) && typeof d.id === 'string' && typeof d.levelId === 'string' && isDimAnchor(d.a) && isDimAnchor(d.b) && finite(d.offset);

/** A stair: a kind, a point, an angle, a width and a step depth above zero. */
export const isStair = (s: unknown): s is Stair =>
  isObject(s) &&
  typeof s.id === 'string' &&
  typeof s.levelId === 'string' &&
  (s.kind === 'straight' || s.kind === 'l' || s.kind === 'u' || s.kind === 'spiral' || s.kind === 'ramp') &&
  (s.grade === undefined || (finite(s.grade) && s.grade > 0)) &&
  isPoint(s.at) &&
  finite(s.angle) &&
  finite(s.width) &&
  s.width > 0 &&
  finite(s.tread) &&
  s.tread > 0 &&
  (s.turn === 'left' || s.turn === 'right') &&
  (s.height === undefined || (finite(s.height) && s.height > 0)) &&
  (s.railing === undefined || typeof s.railing === 'boolean');

/** A roof: an outline of three points or more, a side for each, a thickness above zero. */
export const isRoof = (r: unknown): r is Roof =>
  isObject(r) &&
  typeof r.id === 'string' &&
  typeof r.levelId === 'string' &&
  Array.isArray(r.outline) &&
  r.outline.length >= 3 &&
  r.outline.every(isPoint) &&
  Array.isArray(r.edges) &&
  r.edges.length === r.outline.length &&
  r.edges.every((e) => isObject(e) && (e.grade === null || finite(e.grade)) && finite(e.overhang)) &&
  (r.kind === 'flat' || r.kind === 'shed' || r.kind === 'gable' || r.kind === 'hip') &&
  finite(r.thickness) &&
  r.thickness > 0 &&
  finite(r.baseOffset) &&
  (r.parapet === undefined || finite(r.parapet));

/** A beam: two different points, a section above zero. */
export const isBeam = (b: unknown): b is Beam =>
  isObject(b) &&
  typeof b.id === 'string' &&
  typeof b.levelId === 'string' &&
  isPoint(b.start) &&
  isPoint(b.end) &&
  JSON.stringify(b.start) !== JSON.stringify(b.end) &&
  finite(b.width) &&
  b.width > 0 &&
  finite(b.depth) &&
  b.depth > 0 &&
  (b.topOffset === undefined || finite(b.topOffset));

/** A column: a point, a section above zero, an angle. */
export const isColumn = (c: unknown): c is Column =>
  isObject(c) &&
  typeof c.id === 'string' &&
  typeof c.levelId === 'string' &&
  isPoint(c.at) &&
  finite(c.width) &&
  c.width > 0 &&
  finite(c.depth) &&
  c.depth > 0 &&
  finite(c.angle) &&
  (c.topOffset === undefined || finite(c.topOffset));

/** A grid axis: a name and two different points. */
export const isGrid = (g: unknown): g is Grid =>
  isObject(g) && typeof g.id === 'string' && typeof g.name === 'string' && g.name.trim() !== '' && isPoint(g.start) && isPoint(g.end) && JSON.stringify(g.start) !== JSON.stringify(g.end);

/** A guide: a point and a unit direction (a zero one would be no line at all). */
export const isGuide = (g: unknown): g is Guide =>
  isObject(g) &&
  typeof g.id === 'string' &&
  typeof g.levelId === 'string' &&
  isPoint(g.point) &&
  isPoint(g.dir) &&
  Math.abs(Math.hypot((g.dir as { x: number }).x, (g.dir as { y: number }).y) - 1) < 1e-6;

export function writeProject(doc: Doc): string {
  return JSON.stringify({ ...doc, version: CURRENT_VERSION }, null, 2);
}

export function readProject(text: string): ReadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notJson' };
  }
  return repairProject(raw);
}

/** The project from parsed JSON: migrated to the current version, bad elements dropped and reported. */
export function repairProject(raw: unknown): ReadResult {
  if (!isObject(raw) || !finite(raw.version)) return { ok: false, error: 'notProject' };
  if (raw.version > CURRENT_VERSION) return { ok: false, error: 'newerVersion' };
  const levels = Array.isArray(raw.levels) ? raw.levels.filter(isLevel) : [];
  const wallTypes = Array.isArray(raw.wallTypes) ? raw.wallTypes.filter(isWallType) : [];
  if (levels.length === 0) return { ok: false, error: 'noLevels' };
  if (wallTypes.length === 0) return { ok: false, error: 'noWallTypes' };
  const fixes: Fix[] = [];
  const keep = <T>(list: unknown, ok: (x: unknown) => x is T, kind: Extract<Fix, { count: number }>['kind']): T[] => {
    // Lists missing from older versions are empty, not errors.
    if (list === undefined) return [];
    const all = Array.isArray(list) ? list : [];
    const good = all.filter(ok);
    if (good.length < all.length || !Array.isArray(list)) fixes.push({ kind, count: all.length - good.length || 1 });
    return good;
  };
  const levelIds = new Set(levels.map((l) => l.id));
  let moved = 0;
  const walls = keep(raw.walls, isWall, 'droppedWalls').map((w) => {
    if (levelIds.has(w.levelId)) return w;
    moved++;
    return { ...w, levelId: levels[0]!.id };
  });
  if (moved > 0) fixes.push({ kind: 'movedToFirstLevel', count: moved });
  // A wall keeps a top or base offset only when it differs from its type's (before version 3 every
  // wall carried both, chosen or not): the rest follow the type.
  const migrated = walls.map((w) => ownValuesOnly(w, wallTypes));
  const openings = keep(raw.openings, isOpening, 'droppedOpenings');
  const wallIds = new Set(walls.map((w) => w.id));
  const openingIds = new Set(openings.map((o) => o.id));
  const doc: Doc = {
    version: CURRENT_VERSION,
    name: typeof raw.name === 'string' ? raw.name : '',
    levels,
    wallTypes,
    walls: migrated,
    openings,
    openingGroups: keep(raw.openingGroups, isOpeningGroup, 'droppedGroups'),
    rooms: keep(raw.rooms, isRoom, 'droppedRooms'),
    floors: keep(raw.floors, isFloor, 'droppedFloors'),
    // A guide of a level that is gone has nothing to guide: dropped, and said.
    guides: keep(raw.guides, isGuide, 'droppedGuides').filter((g, _, all) => {
      if (levelIds.has(g.levelId)) return true;
      if (g === all.find((x) => !levelIds.has(x.levelId))) fixes.push({ kind: 'droppedGuides', count: all.filter((x) => !levelIds.has(x.levelId)).length });
      return false;
    }),
    // A view of a level that is gone shows nothing: dropped, and said.
    views: keep(raw.views, isSavedView, 'droppedViews').filter((v, _, all) => {
      if (levelIds.has(v.levelId)) return true;
      if (v === all.find((x) => !levelIds.has(x.levelId))) fixes.push({ kind: 'droppedViews', count: all.filter((x) => !levelIds.has(x.levelId)).length });
      return false;
    }),
    // A point on a level that is gone is nowhere: dropped, and said.
    points: keep(raw.points, isPointOfInterest, 'droppedPoints').filter((p, _, all) => {
      if (levelIds.has(p.levelId)) return true;
      if (p === all.find((x) => !levelIds.has(x.levelId))) fixes.push({ kind: 'droppedPoints', count: all.filter((x) => !levelIds.has(x.levelId)).length });
      return false;
    }),
    // A dimension on a level that is gone, or held by a wall or an opening that is not there: dropped, and said.
    dimensions: keep(raw.dimensions, isDimension, 'droppedDimensions').filter((d, _, all) => {
      const there = (x: Dimension) =>
        levelIds.has(x.levelId) && [x.a, x.b].every((a) => (a.kind === 'wall' ? wallIds.has(a.wallId) : a.kind === 'opening' ? openingIds.has(a.openingId) : true));
      if (there(d)) return true;
      if (d === all.find((x) => !there(x))) fixes.push({ kind: 'droppedDimensions', count: all.filter((x) => !there(x)).length });
      return false;
    }),
    grids: keep(raw.grids, isGrid, 'droppedGrids'),
    // A stair on a level that is gone climbs nowhere: dropped, and said.
    stairs: keep(raw.stairs, isStair, 'droppedStairs').filter((s, _, all) => {
      if (levelIds.has(s.levelId)) return true;
      if (s === all.find((x) => !levelIds.has(x.levelId))) fixes.push({ kind: 'droppedStairs', count: all.filter((x) => !levelIds.has(x.levelId)).length });
      return false;
    }),
    // A roof on a level that is gone covers nothing: dropped, and said.
    roofs: keep(raw.roofs, isRoof, 'droppedRoofs').filter((r, _, all) => {
      if (levelIds.has(r.levelId)) return true;
      if (r === all.find((x) => !levelIds.has(x.levelId))) fixes.push({ kind: 'droppedRoofs', count: all.filter((x) => !levelIds.has(x.levelId)).length });
      return false;
    }),
    // A beam on a level that is gone spans nothing: dropped, and said.
    beams: keep(raw.beams, isBeam, 'droppedBeams').filter((b, _, all) => {
      if (levelIds.has(b.levelId)) return true;
      if (b === all.find((x) => !levelIds.has(x.levelId))) fixes.push({ kind: 'droppedBeams', count: all.filter((x) => !levelIds.has(x.levelId)).length });
      return false;
    }),
    // A column on a level that is gone stands nowhere: dropped, and said.
    columns: keep(raw.columns, isColumn, 'droppedColumns').filter((c, _, all) => {
      if (levelIds.has(c.levelId)) return true;
      if (c === all.find((x) => !levelIds.has(x.levelId))) fixes.push({ kind: 'droppedColumns', count: all.filter((x) => !levelIds.has(x.levelId)).length });
      return false;
    }),
    // A note on a level that is gone is on no plan: dropped, and said.
    notes: keep(raw.notes, isNote, 'droppedNotes').filter((n, _, all) => {
      if (levelIds.has(n.levelId)) return true;
      if (n === all.find((x) => !levelIds.has(x.levelId))) fixes.push({ kind: 'droppedNotes', count: all.filter((x) => !levelIds.has(x.levelId)).length });
      return false;
    }),
  };
  return { ok: true, doc: regroupOffJoints(doc, raw.version), fixes };
}

/**
 * A distributed group from before stretches (version 3) spread over its whole wall, and could sit an
 * opening on a T or an X (the tester's reteste of 16453d5): distributed again as now, by stretch (ADR
 * 0003), it keeps clear of the joint. Groups clear of every joint are left as they were.
 */
function regroupOffJoints(doc: Doc, version: number): Doc {
  if (version >= 4 || doc.openingGroups.length === 0) return doc;
  let out = doc;
  for (const g of doc.openingGroups) {
    const atJoint = [...deriveGeometry(out).openings.values()].some((o) => g.members.includes(o.opening.id) && o.warnings.includes('openingAtJoint'));
    if (atJoint) out = distributeOpenings(g.id, g.members, g.spacing).apply(out);
  }
  return out;
}
