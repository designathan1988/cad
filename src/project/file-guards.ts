// What a project file's records must hold to be read: the checks of levels, materials, wall types, walls
// and openings (file.ts reads with them; the stores' import uses them too), and a record kept without the
// optional values that fail them.

import type { DocWall, Level } from './doc';
import { BUILT_IN_MATERIALS, CUT_PATTERNS, isColor, type Material } from '../elements/material/schema';
import { isPattern } from '../elements/material/pattern';
import { isPhysics } from '../elements/material/physics';
import { LAYER_PRIORITY, type WallType } from '../elements/wall/schema';
import { layerThicknessOk } from '../elements/layers/stack';
import type { Point2 } from '../model/vector';
import { MIN_WALL_LENGTH } from '../model/tolerance';
import type { Opening, OpeningGroup } from '../elements/opening/schema';
import { isOpeningStyle, operationsOf } from '../elements/opening/style';


export const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export const isObject = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null;

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
export const isTop = (r: unknown): boolean =>
  r === undefined ||
  (isObject(r) &&
    ((r.kind === 'level' && finite(r.offset)) ||
      (r.kind === 'fixed' && finite(r.height) && r.height > 0) ||
      (r.kind === 'toLevel' && typeof r.levelId === 'string' && finite(r.offset)) ||
      r.kind === 'roof'));

/** A built-in material of an older file with the pattern it has now (tiles, wood, brick). */
export const withBuiltInPattern = (m: Material): Material => {
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

/** A layer: a thickness, one of the five functions (another had no join priority: the T walk compared NaN), a material. */
const isLayer = (l: unknown): boolean => isObject(l) && layerThicknessOk(l.thickness) && Object.hasOwn(LAYER_PRIORITY, l.function as string) && typeof l.materialId === 'string';

export const isWallType = (t: unknown): t is WallType =>
  isObject(t) &&
  typeof t.id === 'string' &&
  typeof t.name === 'string' &&
  Array.isArray(t.layers) &&
  t.layers.length > 0 &&
  t.layers.every(isLayer) &&
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

export const isRule = (r: unknown): boolean => {
  if (!isObject(r)) return false;
  if (r.kind === 'centered') return true;
  if (r.kind === 'fromStart' || r.kind === 'fromEnd') return finite(r.distance);
  if (r.kind === 'fromOpening') return typeof r.openingId === 'string' && finite(r.distance) && (r.toward === 'start' || r.toward === 'end');
  if (r.kind === 'aligned') return typeof r.openingId === 'string' && (r.edge === 'start' || r.edge === 'center' || r.edge === 'end');
  return r.kind === 'inGroup' && typeof r.groupId === 'string';
};

export const isSpacing = (s: unknown): boolean =>
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

/**
 * `x` without the one or two fields its kind refused (a room's use it does not know, a height of 0),
 * the fewest that make it valid; null when none does. Taking out a field the kind requires never makes
 * it valid, so only a bad optional one goes. Its id is never taken out.
 */
export function withoutBadFields<T>(x: unknown, ok: (x: unknown) => x is T): T | null {
  if (!isObject(x)) return null;
  const keys = Object.keys(x).filter((k) => k !== 'id');
  const omit = (...out: string[]): unknown => Object.fromEntries(Object.entries(x).filter(([k]) => !out.includes(k)));
  for (const a of keys) {
    const one = omit(a);
    if (ok(one)) return one;
  }
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const two = omit(keys[i]!, keys[j]!);
      if (ok(two)) return two;
    }
  }
  return null;
}
