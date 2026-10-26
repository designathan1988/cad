// Project files: the document as JSON, with its version. Reading checks every element on its own:
// a bad one is dropped (or fixed, when the fix is obvious) and reported, and the rest of the project
// is kept. Files from older versions are migrated; a file from a newer version is refused, never
// half-read.

import { type Doc, type Level, ownValuesOnly } from '../app/document';
import type { Guide } from '../elements/guide/schema';
import { isSavedView } from '../app/saved-views';
import type { Opening, OpeningGroup } from '../elements/opening/schema';
import type { Floor, Room } from '../elements/room/schema';
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
 */
export const CURRENT_VERSION = 6;

export type ReadError = 'notJson' | 'notProject' | 'noLevels' | 'noWallTypes' | 'newerVersion';
export type Fix =
  | { readonly kind: 'droppedWalls' | 'droppedOpenings' | 'droppedRooms' | 'droppedFloors' | 'droppedGroups' | 'droppedGuides' | 'droppedViews'; readonly count: number }
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
  (w.baseOffset === undefined || finite(w.baseOffset));

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
  isObject(r) && typeof r.id === 'string' && typeof r.levelId === 'string' && isPoint(r.seed) && typeof r.name === 'string' && typeof r.number === 'string';

export const isFloor = (f: unknown): f is Floor =>
  isObject(f) &&
  typeof f.id === 'string' &&
  typeof f.levelId === 'string' &&
  finite(f.thickness) &&
  f.thickness > 0 &&
  finite(f.offset) &&
  isObject(f.source) &&
  ((f.source.kind === 'room' && typeof f.source.roomId === 'string') ||
    (f.source.kind === 'outline' && Array.isArray(f.source.points) && f.source.points.length >= 3 && f.source.points.every(isPoint)));

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
  const doc: Doc = {
    version: CURRENT_VERSION,
    name: typeof raw.name === 'string' ? raw.name : '',
    levels,
    wallTypes,
    walls: migrated,
    openings: keep(raw.openings, isOpening, 'droppedOpenings'),
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
  };
  return { ok: true, doc, fixes };
}
