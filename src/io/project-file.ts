// Project files: the document as JSON, with its version. Reading checks every element on its own:
// a bad one is dropped (or fixed, when the fix is obvious) and reported, and the rest of the project
// is kept. Files from older versions are migrated; a file from a newer version is refused, never
// half-read.

import type { Point2 } from '../core/vector';
import { MIN_WALL_LENGTH } from '../core/tolerance';
import { MORE_WALL_TYPES } from '../elements/wall/library-types';
import { FAMILY_BATCHES } from '../elements/object/library-families';
import { LIBRARY_SECTORS } from '../elements/object/library-sectors';
import { BEFORE_65 } from '../elements/object/library-before65';
import { isSite } from '../app/sun';
import { isSheet, isViewport } from '../elements/sheet/schema';
import { isLayerSet, isRoomOverride, isWallOverride } from '../app/layer-sets';
import { isVariableName } from '../core/measure';
import { isOpeningStyle, operationsOf } from '../elements/opening/style';
import { CHAIR, LIBRARY } from '../elements/object/library';
import { BED, COOKER, FRIDGE, KITCHEN, LIBRARY_MORE, POT_PLANT, SOFA, TOILET, TREE, WASHBASIN } from '../elements/object/library-more';
import type { ObjectDefinition } from '../elements/object/schema';

/** The library's definitions that version 46 gave rounded edges, and one as it was before. */
const ROUNDED = [SOFA, BED, TOILET, FRIDGE, COOKER];
const unrounded = (d: ObjectDefinition): ObjectDefinition => ({ ...d, parts: d.parts.map((p) => (p.kind === 'box' && p.round !== undefined ? (({ round: _, ...rest }) => rest)(p) : p)) });
/** A library definition as version 46 had it: the furniture's wood was the floor's (version 47 gave
 * it its own, woodVeneer). */
const before47 = (d: ObjectDefinition): ObjectDefinition => ({ ...d, params: d.params.map((p) => (p.kind === 'material' && p.default === 'woodVeneer' ? { ...p, default: 'wood' } : p)) });
/** The library's chair before version 47, its back one board: three boxes, the back from the seat up. */
const isOldChair = (d: ObjectDefinition) => d.parts.length === 3 && d.parts.every((p) => p.kind === 'box') && d.parts.some((p) => p.kind === 'box' && p.h === 'encosto - assento');
const LIBRARY_NOW = [...LIBRARY, ...LIBRARY_MORE];
/** A library definition as version 48 had it: no handles on the kitchen's doors nor the washbasin's cabinet. */
const HANDLES = new Set(['Puxador', 'Puxador do aéreo']);
const before49 = (d: ObjectDefinition): ObjectDefinition => ({ ...d, params: d.params.filter((p) => p.name !== 'matPuxador'), parts: d.parts.filter((p) => !HANDLES.has(p.name?.pt ?? '')) });

/** The library's tree and potted plant as they were before version 45 (cones), by their parts. */
const isOldTree = (d: ObjectDefinition) => d.parts.length === 3 && d.parts.every((p) => p.kind === 'cylinder');
const isOldPotPlant = (d: ObjectDefinition) => d.parts.length === 2 && d.parts.every((p) => p.kind === 'cylinder');
import { LIBRARY_LIGHTS, POINT_LIGHT } from '../elements/object/library-lights';
import { definitionMaterials } from '../elements/object/materials';
import { isDefinition } from '../elements/object/valid';
import { objectKind } from '../elements/kinds/object';
import { DEFAULT_UNITS, isUnits } from '../ui/units';
import { BUILT_IN_MATERIALS, CUT_PATTERNS, isColor, type Material, materialFor } from '../elements/material/schema';
import { isPattern } from '../elements/material/pattern';
import { isPhysics } from '../sim/physics';
import { isSimSettings } from '../sim/settings';
import { type Doc, type Level, ownValuesOnly } from '../app/document';
import type { AnyKind, KindKey } from '../elements/contract';
import { KINDS } from '../elements/registry';
import { typedIds } from './typed-ids';
import { isSavedView } from '../app/saved-views';
import { isPointOfInterest } from '../app/points';
import { deriveGeometry } from '../app/geometry';
import { distributeOpenings } from '../elements/opening/commands';
import type { Opening, OpeningGroup } from '../elements/opening/schema';
import type { WallType } from '../elements/wall/schema';
import type { DocWall } from '../app/document';
import { DEFAULT_RULES, isRule as isNormRule, isRulePack, type Rule as NormRule } from '../rules/schema';
import { isLot } from '../app/lot';
import { isCosts } from '../costs/schema';
import { isApproval } from '../approval/schema';
import { isMepSystem } from '../elements/mep/schema';
import { isDrawingSettings } from '../elements/drawing/schema';

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
 * Version 20: guardrails (`railings`, elements/railing). Older files have none.
 * Version 21: materials as data (`materials`, elements/material): colour, finish, cut pattern. Older
 *   files get the built-in ones, and one for each other name their layers used.
 * Version 22: the project's units (`units`, ui/units.ts). Older files are in metres with 2 decimals.
 * Version 23: parametric objects (`definitions`, `objects`, elements/object). Older files get the
 *   library's definitions and have no objects; the materials the definitions use are added.
 * Version 24: a door's or window's make (`style`, elements/opening/style.ts): how it opens, leaves,
 *   frame, trim, transom, threshold. Older openings have none and are drawn as they were.
 * Version 25: room separators and zones (`separators`, `zones`); a room's finishes; a floor's tiling
 *   and build-up (`tiling`, `layers`). Older files have none.
 * Version 26: a wall's top up to another level or under the roof (`top` kinds 'toLevel', 'roof').
 *   Older walls have neither.
 * Version 27: the project's norm rules (`rules`, rules/schema.ts). Older files have none: the defaults.
 * Version 28: curtain walls (`curtains`, elements/curtain). Older files have none.
 * Version 29: the library's other categories (object/library-more.ts). An older file gets those it
 *   has not (a sofa, a bed, kitchen units, fixtures, appliances, a lamp, plants), with their materials.
 * Version 30: materials' surface patterns (material/pattern.ts). An older file's built-in tiles, wood
 *   and brick get theirs.
 * Version 31: sections and elevations (`sections`, elements/section) and sheets (`sheets`,
 *   elements/sheet). Older files have none.
 * Version 32: references under the plan (`references`, elements/reference). Older files have none.
 * Version 33: the terrain (`terrains`, elements/terrain) and the site's sun (`site`). Older files have neither.
 * Version 34: rule packs (`rulePacks`), rules on rooms and on the lot, and the lot (`lot`, app/lot.ts).
 *   An older file with rules of its own gets the new default rules it lacks, its old ones in their pack.
 * Version 35: the costs (`costs`, costs/schema.ts): the CUB, a price base, the budget. Older files have none.
 * Version 36: the approval journey (`approval`, approval/schema.ts). Older files have none: São Paulo's.
 * Version 37: building services (`mepPoints`, `mepRuns`, `systems`, elements/mep). Older files have none.
 * Version 38: the simulations' settings (`simulation`, sim/settings.ts) and a material's own physics. Older files have neither.
 * Version 39: revision clouds (`clouds`, elements/cloud). Older files have none.
 * Version 40: rooms of a use in a colour of their own (`roomOverrides`, app/layer-sets.ts). Older files have none.
 * Version 41: angular, radius, diameter, arc length and coordinate dimensions (`measures`, elements/measure). Older files have none.
 * Version 42: tags by elements with their values (`tags`, elements/tag). Older files have none.
 * Version 43: a room's interior elevations, marks kept to a level (`levelId`, elements/section). Older marks have none: every level.
 */
export const CURRENT_VERSION = 65;

/** A file's own rules from before version 34: the default ones in their pack, and the new defaults added. */
function upgradeRules(rules: NormRule[], version: number): NormRule[] {
  if (version >= 34) return rules;
  const defaults = new Map(DEFAULT_RULES.map((r) => [r.id, r]));
  const kept = rules.map((r) => (r.pack === undefined && defaults.has(r.id) ? { ...r, pack: defaults.get(r.id)!.pack! } : r));
  return [...kept, ...DEFAULT_RULES.filter((d) => !kept.some((r) => r.id === d.id))];
}

export type ReadError = 'notJson' | 'notProject' | 'noLevels' | 'noWallTypes' | 'newerVersion';
export type Fix =
  | { readonly kind: Dropped; readonly count: number }
  | { readonly kind: 'movedToFirstLevel'; readonly count: number }
  /** Ids without their kind's prefix, renamed with every reference (typed-ids.ts). */
  | { readonly kind: 'typedIds'; readonly count: number };

/** The fix for a registry kind's dropped elements: droppedColumns, droppedBeams and so on. */
type KindFix = `dropped${Capitalize<KindKey>}`;
/** What reading left out or put right, counted. */
type Dropped = 'droppedWalls' | 'droppedOpenings' | 'droppedGroups' | 'droppedMaterials' | 'resetUnits' | 'droppedDefinitions' | 'droppedViews' | 'droppedPoints' | KindFix;
const kindFix = (k: AnyKind): KindFix => `dropped${k.key[0]!.toUpperCase()}${k.key.slice(1)}` as KindFix;

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
  r === undefined ||
  (isObject(r) &&
    ((r.kind === 'level' && finite(r.offset)) ||
      (r.kind === 'fixed' && finite(r.height) && r.height > 0) ||
      (r.kind === 'toLevel' && typeof r.levelId === 'string' && finite(r.offset)) ||
      r.kind === 'roof'));

/** A built-in material of an older file with the pattern it has now (tiles, wood, brick). */
const withBuiltInPattern = (m: Material): Material => {
  const pattern = BUILT_IN_MATERIALS.find((b) => b.id === m.id)?.pattern;
  return pattern && !m.pattern ? { ...m, pattern } : m;
};

/** A material: a name, a #rrggbb colour, a finish between 0 and 1, a cut pattern, maybe a surface pattern. */
export const isMaterial = (m: unknown): m is Material =>
  isObject(m) &&
  typeof m.id === 'string' &&
  m.id !== '' &&
  typeof m.name === 'string' &&
  isColor(m.color) &&
  finite(m.roughness) &&
  m.roughness >= 0 &&
  m.roughness <= 1 &&
  finite(m.metalness) &&
  m.metalness >= 0 &&
  m.metalness <= 1 &&
  (CUT_PATTERNS as readonly unknown[]).includes(m.cut) &&
  (m.pattern === undefined || isPattern(m.pattern)) &&
  (m.physics === undefined || isPhysics(m.physics));

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
  Math.hypot((w.end as Point2).x - (w.start as Point2).x, (w.end as Point2).y - (w.start as Point2).y) >= MIN_WALL_LENGTH &&
  typeof w.wallTypeId === 'string' &&
  (w.bulge === undefined || finite(w.bulge)) &&
  isTop(w.top) &&
  (w.baseOffset === undefined || finite(w.baseOffset)) &&
  (w.phase === undefined || w.phase === 'existing' || w.phase === 'demolish') &&
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
  o.sill >= 0 &&
  (o.hinge === 'start' || o.hinge === 'end') &&
  (o.swing === 'left' || o.swing === 'right') &&
  isRule(o.rule) &&
  (o.style === undefined || (isOpeningStyle(o.style) && operationsOf(o.kind).includes(o.style.operation)));

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
  const fileTypes = Array.isArray(raw.wallTypes) ? raw.wallTypes.filter(isWallType) : [];
  // Version 57 brought more wall types (wall/library-types.ts): a file from before gets those it has not.
  const wallTypes = fileTypes.length > 0 && raw.version < 57 ? [...fileTypes, ...MORE_WALL_TYPES.filter((t) => !fileTypes.some((k) => k.id === t.id))] : fileTypes;
  if (levels.length === 0) return { ok: false, error: 'noLevels' };
  if (wallTypes.length === 0) return { ok: false, error: 'noWallTypes' };
  const fixes: Fix[] = [];
  const keep = <T>(list: unknown, ok: (x: unknown) => x is T, kind: Dropped): T[] => {
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
  // Every layer's material is there: the file's, else a built-in one, else a plain one of that name.
  const read = keep(raw.materials, isMaterial, 'droppedMaterials');
  // Before version 30 no material had a pattern: the built-in ones that have one now get it.
  // Before version 59 the stones had no pattern: the built-in ones (marble, granite, quartz, terrazzo) get their veins and speckles.
  const stones = new Set(['marble', 'graniteBlack', 'quartz', 'terrazzo']);
  const fileMaterials = raw.version < 30 ? read.map(withBuiltInPattern) : raw.version < 59 ? read.map((m) => (stones.has(m.id) ? withBuiltInPattern(m) : m)) : read;
  const materials = [...(raw.materials === undefined ? BUILT_IN_MATERIALS : fileMaterials)];
  for (const id of new Set(wallTypes.flatMap((t) => t.layers.map((l) => l.materialId)))) if (!materials.some((m) => m.id === id)) materials.push(materialFor(id));
  // Units that are not ones (a unit it does not know, decimals out of range): metres again, and said.
  if (raw.units !== undefined && !isUnits(raw.units)) fixes.push({ kind: 'resetUnits', count: 1 });
  // The objects' definitions: the file's, or the library for a file from before them; and the
  // materials they use, as the layers' (a definition is data: a material it names is kept with it).
  const kept = raw.definitions === undefined ? [...LIBRARY] : keep(raw.definitions, isDefinition, 'droppedDefinitions');
  const since29 = raw.version < 29 ? [...kept, ...LIBRARY_MORE.filter((d) => !kept.some((k) => k.id === d.id))] : kept;
  // Version 44 brought the lights (library-lights.ts): a file from before gets them.
  const since44 = raw.version < 44 ? [...since29, ...LIBRARY_LIGHTS.filter((d) => !since29.some((k) => k.id === d.id))] : since29;
  // Version 45 drew the tree and the potted plant in rounded masses: the library's own, as they came,
  // take the new ones (one changed by hand, its parts not those, is kept).
  const since45 = raw.version < 45 ? since44.map((d) => (d.id === TREE.id && isOldTree(d) ? TREE : d.id === POT_PLANT.id && isOldPotPlant(d) ? POT_PLANT : d)) : since44;
  // Version 46 rounded the edges of the upholstery, the mattress, the china and the appliances: the
  // library's own, still as they came (the same but for the rounding), take the rounded ones.
  const since46 = raw.version < 46 ? since45.map((d) => ROUNDED.find((r) => r.id === d.id && JSON.stringify(unrounded(before47(r))) === JSON.stringify(d)) ?? d) : since45;
  // Version 47 gave the furniture its own wood and the chair an open back: the library's own, still
  // as they came, take the new ones (the chair by its parts, as the tree above).
  const since47 =
    raw.version < 47
      ? since46.map((d) => LIBRARY_NOW.find((l) => l.id === d.id && JSON.stringify(before49(before47(l))) === JSON.stringify(d)) ?? (d.id === CHAIR.id && isOldChair(d) ? CHAIR : d))
      : since46;
  // Version 48 drew the point of light as a bulb and its socket (it was a cylinder).
  const since48 = raw.version < 48 ? since47.map((d) => (d.id === POINT_LIGHT.id && d.parts.length === 1 && d.parts[0]!.kind === 'cylinder' ? POINT_LIGHT : d)) : since47;
  // Version 49 put handles on the kitchen's doors and the washbasin's cabinet: the library's own, still
  // as they came, take them.
  const since49 = raw.version < 49 ? since48.map((d) => LIBRARY_NOW.find((l) => (l.id === KITCHEN.id || l.id === WASHBASIN.id) && l.id === d.id && JSON.stringify(before49(l)) === JSON.stringify(d)) ?? d) : since48;
  // From version 50 each batch of families (library-families.ts): a file from before a batch gets its families it has not.
  const fileVersion = raw.version;
  const batched = FAMILY_BATCHES.reduce((list, b) => (fileVersion < b.version ? [...list, ...b.families.filter((d) => !list.some((k) => k.id === d.id))] : list), since49);
  // Versions 60 to 64 had the sectors' families as first drawn (the school desks on panel legs, then with the
  // book tray open at the front; garments as flat boards, the hospital bed's rails as panels, the couch's
  // stool as a box, goods over the gondola's top): a file of them gets them as they are now (those versions
  // were out for minutes, so no one changed them).
  const sectors = fileVersion >= 60 && fileVersion <= 64 ? batched.map((d) => LIBRARY_SECTORS.find((s) => s.id === d.id) ?? d) : batched;
  // Before version 65 the cooker was a box with discs, the potted plant balls, the carved basin barely cut: one
  // stored as the library had it then is the library's now; one the user changed is kept (library-before65.ts).
  const definitions = fileVersion < 65 ? sectors.map((d) => {
    const was = BEFORE_65.find((b) => b.id === d.id);
    return was && JSON.stringify(was) === JSON.stringify(d) ? (LIBRARY_NOW.find((l) => l.id === d.id) ?? d) : d;
  }) : sectors;
  for (const id of definitionMaterials(definitions)) if (!materials.some((m) => m.id === id)) materials.push(materialFor(id));
  const wallIds = new Set(walls.map((w) => w.id));
  const openingIds = new Set(openings.map((o) => o.id));
  // The registry's elements that are there and valid, by id: what one of them may be held by.
  const rawIds = new Set(
    KINDS.filter((k) => !k.walled).flatMap((k) => (Array.isArray(raw[k.key]) ? (raw[k.key] as unknown[]) : []).filter((x) => k.valid(x)).map((x) => (x as { id: string }).id)),
  );
  let doc: Doc = {
    version: CURRENT_VERSION,
    // Its own rules, the bad ones left out (the defaults when it has none).
    ...(Array.isArray(raw.rules) ? { rules: upgradeRules((raw.rules as unknown[]).filter(isNormRule), raw.version) } : {}),
    ...(Array.isArray(raw.rulePacks) ? { rulePacks: (raw.rulePacks as unknown[]).filter(isRulePack) } : {}),
    ...(isLot(raw.lot) ? { lot: raw.lot } : {}),
    ...(isCosts(raw.costs) ? { costs: raw.costs } : {}),
    ...(isApproval(raw.approval) ? { approval: raw.approval } : {}),
    ...(Array.isArray(raw.systems) && raw.systems.some(isMepSystem) ? { systems: (raw.systems as unknown[]).filter(isMepSystem) } : {}),
    // Its scale and pens, when it set them and they are ones (the defaults otherwise).
    ...(isDrawingSettings(raw.drawing) ? { drawing: raw.drawing } : {}),
    // Its layer combinations and graphic overrides, the bad ones left out.
    ...(Array.isArray(raw.layerSets) && raw.layerSets.some(isLayerSet) ? { layerSets: (raw.layerSets as unknown[]).filter(isLayerSet) } : {}),
    ...(Array.isArray(raw.overrides) && raw.overrides.some(isWallOverride) ? { overrides: (raw.overrides as unknown[]).filter(isWallOverride) } : {}),
    ...(Array.isArray(raw.roomOverrides) && raw.roomOverrides.some(isRoomOverride) ? { roomOverrides: (raw.roomOverrides as unknown[]).filter(isRoomOverride) } : {}),
    // Its site and sun, when it set one that is one.
    ...(isSite(raw.site) ? { site: raw.site } : {}),
    ...(isSimSettings(raw.simulation) ? { simulation: raw.simulation } : {}),
    // Its sheets, the bad ones left out (and on each, the views that are not views).
    ...(Array.isArray(raw.sheets) ? { sheets: (raw.sheets as unknown[]).flatMap((x): unknown[] => (isObject(x) && Array.isArray(x.viewports) ? [{ ...x, viewports: (x.viewports as unknown[]).filter(isViewport) }] : [])).filter(isSheet) } : {}),
    // Its named lengths, the bad ones left out.
    ...(isObject(raw.variables) ? { variables: Object.fromEntries(Object.entries(raw.variables).filter(([k, v]) => isVariableName(k) && finite(v))) as Record<string, number> } : {}),
    name: typeof raw.name === 'string' ? raw.name : '',
    units: isUnits(raw.units)
      ? {
          length: raw.units.length,
          decimals: raw.units.decimals,
          ...(raw.units.angleDecimals !== undefined ? { angleDecimals: raw.units.angleDecimals } : {}),
          ...(raw.units.slope !== undefined ? { slope: raw.units.slope } : {}),
        }
      : DEFAULT_UNITS,
    levels,
    materials,
    definitions,
    wallTypes,
    walls: migrated,
    openings,
    openingGroups: keep(raw.openingGroups, isOpeningGroup, 'droppedGroups'),
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
    // The registry's elements (columns, beams, roofs, stairs, guardrails, texts, axes, guides, dimensions, floors, rooms):
    // checked by their kind; one on a level that is gone stands nowhere, one held by a wall or an opening
    // that is not there (a dimension) holds to nothing: dropped, and said.
    ...(Object.fromEntries(
      // Walls and doors are read above, with their types, rules and groups.
      KINDS.filter((k) => !k.walled).map((k) => {
        const fix = kindFix(k);
        const all = keep(raw[k.key], k.valid, fix) as { readonly levelId: string }[];
        // An axis is on every level: none is gone with one.
        // Held by a wall or an opening, or by another element of the file (a guardrail by its stair).
        const held = (x: { readonly levelId: string }) => (k.holders?.(x) ?? []).every((h: string) => wallIds.has(h) || openingIds.has(h) || rawIds.has(h));
        const there = (x: { readonly levelId: string }) => (k.everyLevel === true || levelIds.has(x.levelId)) && held(x);
        const gone = all.filter((x) => !there(x)).length;
        if (gone > 0) fixes.push({ kind: fix, count: gone });
        return [k.key, all.filter(there)];
      }),
    ) as unknown as Pick<Doc, Exclude<KindKey, 'openings' | 'walls'>>),
  };
  // An object of a definition the project does not have stands for nothing: dropped, and said.
  const orphans = doc.objects.filter((o) => !definitions.some((d) => d.id === o.definitionId));
  if (orphans.length > 0) {
    doc = { ...doc, objects: doc.objects.filter((o) => !orphans.includes(o)) };
    fixes.push({ kind: kindFix(objectKind), count: orphans.length });
  }
  // Every id says its kind (typed-ids.ts): one written without it is renamed, and said.
  const typed = typedIds(doc);
  if (typed.renamed > 0) fixes.push({ kind: 'typedIds', count: typed.renamed });
  return { ok: true, doc: regroupOffJoints(typed.doc, raw.version), fixes };
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
