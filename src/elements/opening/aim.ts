// What the door and window tool needs from the screen: the wall under the cursor as an Aim, and the
// dimension guide of the opening being placed. Read-only over the document and its geometry.

import { lengthText } from '../../i18n/units';
import { add, dot, type Point2, scale, sub } from '../../model/vector';
import { hasDistance, type PositionRule } from './schema';
import { referenceLength } from './derive';
import { arcOf } from '../wall/geometry/arc';
import { faceOffsets, wallDirection, wallNormal } from '../wall/geometry/offset';
import { shapeOf } from '../wall/geometry/shape';
import { type Aim, ruleBase } from './tool';
import { t, type MessageKey } from '../../i18n/messages';
import { type Doc, wallHeights } from '../../project/doc';
import type { DerivedGeometry } from '../../project/derive';
import { wallStops, wallStopsOf } from '../wall/stops';
import type { WallId } from '../wall/schema';
import type { OpeningId } from './schema';
import type { LevelId } from '../../project/doc';

/** Id of the opening being placed, in the derived geometry only. */
export const OPENING_PREVIEW_ID = '__opening_preview__' as OpeningId;

/** Extra reach beyond the wall's faces, in screen pixels, so thin walls are easy to point at. */
const REACH_PX = 6;

/**
 * The wall of the level under p: within its faces (plus a few pixels) and between its ends. Measured
 * on the wall's own shape, not on its cut pieces, so the preview's own hole never hides the wall.
 */
export function aimAt(doc: Doc, g: DerivedGeometry, levelId: LevelId, p: Point2, mpp: number, previewId: string): Aim | null {
  const types = new Map(doc.wallTypes.map((x) => [x.id, x]));
  let best: { aim: Aim; miss: number } | null = null;
  for (const wall of doc.walls) {
    if (wall.levelId !== levelId) continue;
    const shape = shapeOf(wall, types.get(wall.wallTypeId));
    if (typeof shape === 'string') continue;
    const length = referenceLength(wall);
    const arc = arcOf(shape);
    let station: number;
    let offset: number;
    if (arc === null) {
      station = dot(sub(p, shape.start), wallDirection(shape));
      offset = dot(sub(p, shape.start), wallNormal(shape));
    } else {
      const v = sub(p, arc.center);
      const turn = Math.sign(arc.sweep);
      let a = (Math.atan2(v.y, v.x) - arc.startAngle) * turn;
      a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      station = a * arc.radius;
      offset = arc.turn * (arc.radius - Math.hypot(v.x, v.y));
    }
    if (station < 0 || station > length) continue;
    const [o0, o1] = faceOffsets(shape);
    const centre = (o0 + o1) / 2;
    const miss = Math.abs(offset - centre) - (o1 - o0) / 2;
    if (miss > REACH_PX * mpp || (best && miss >= best.miss)) continue;
    const others = [...g.openings.values()]
      .filter((o) => o.opening.wallId === wall.id && o.opening.id !== previewId)
      .map((o) => ({ id: o.opening.id, start: o.start, end: o.end }));
    best = { aim: { wallId: wall.id, length, station, side: offset >= centre ? 'left' : 'right', others, mpp, stops: wallStops(doc, wall.id), occupied: occupiedOf(doc, wall.id) }, miss };
  }
  return best?.aim ?? null;
}

/**
 * The aim at a station of a given wall, as if the cursor were there on its centre line: the keyboard's
 * way to the door and window tools (a wall chosen with N, then D or Shift+W). Null when the wall is
 * not there to aim at.
 */
export function aimAlong(doc: Doc, g: DerivedGeometry, wallId: WallId, station: number, mpp: number, previewId: string): Aim | null {
  const wall = doc.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const length = referenceLength(wall);
  const others = [...g.openings.values()]
    .filter((o) => o.opening.wallId === wall.id && o.opening.id !== previewId)
    .map((o) => ({ id: o.opening.id, start: o.start, end: o.end }));
  return { wallId, length, station: Math.min(Math.max(station, 0), length), side: 'left', others, mpp, stops: wallStops(doc, wallId), occupied: occupiedOf(doc, wallId) };
}

/** Where each wall meeting this one stands across it: from its first face to its second. */
function occupiedOf(doc: Doc, wallId: WallId): [number, number][] {
  const by = new Map<WallId, number[]>();
  for (const s of wallStopsOf(doc, wallId)) by.set(s.wallId, [...(by.get(s.wallId) ?? []), s.at]);
  return [...by.values()].filter((xs) => xs.length >= 2).map((xs) => [Math.min(...xs), Math.max(...xs)]);
}

/**
 * The rule in words, for the footer: "0.55 m from the wall start", or, measured from a wall meeting
 * this one (a base past the wall's end), "0.40 m from the wall face".
 */
export const ruleText = (rule: PositionRule, base = 0): string =>
  base > 0 && (rule.kind === 'fromStart' || rule.kind === 'fromEnd')
    ? t('ruleShort.fromFace', { d: lengthText(rule.distance - base) })
    : t(`ruleShort.${rule.kind}` as MessageKey, hasDistance(rule) ? { d: lengthText(rule.distance) } : {});

/**
 * The dimension of the opening being placed, drawn as the temporary dimensions are (extension lines and
 * ticks): along the wall from the rule's reference to the nearest jamb, off the face away from where a
 * door opens (a window's exterior face), and its value. Null when centred or not on a straight wall.
 */
export function ruleGuide(
  doc: Doc,
  g: DerivedGeometry,
  previewId: OpeningId,
): { dim: { a: Point2; b: Point2; side: Point2; clear: number; text: string }; measure: { at: Point2; text: string; normal: Point2; clear: number } } | null {
  const o = g.openings.get(previewId);
  const f = o?.frame;
  if (!o || !f) return null;
  const host = g.solids.get(o.opening.wallId)?.wall;
  if (!host || (host.bulge ?? 0) !== 0) return null;
  const length = referenceLength(host);
  const rule = o.opening.rule;
  // From the stop the rule is measured from: the face of the wall meeting this one, or its end.
  const base = ruleBase({ length, stops: wallStops(doc, host.id) }, rule);
  let span: [number, number] | null = null;
  if (rule.kind === 'fromStart') span = [base, o.start];
  else if (rule.kind === 'fromEnd') span = [o.end, length - base];
  else if (rule.kind === 'fromOpening') {
    const ref = g.openings.get(rule.openingId);
    if (ref) span = rule.toward === 'end' ? [ref.end, o.start] : [o.end, ref.start];
  }
  if (!span) return null;
  // A door's leaf sweeps one side: the dimension goes on the other. A window's on its exterior face.
  const [o0, o1] = f.faces;
  const positive = o.opening.kind === 'door' ? o.opening.swing === 'right' : o0 > o1;
  const side = positive ? f.normal : scale(f.normal, -1);
  const clear = positive ? Math.max(o0, o1) : -Math.min(o0, o1);
  const at = (s: number) => add(f.start, scale(f.dir, s - o.start));
  const a = at(span[0]);
  const b = at(span[1]);
  const text = `${lengthText(Math.abs(span[1] - span[0]))}`;
  return { dim: { a, b, side, clear, text }, measure: { at: scale(add(a, b), 0.5), text, normal: side, clear } };
}

/**
 * Where a ray from the eye (plan x, y; z the height) first meets a straight wall of the given levels, on its
 * middle plane, between its ends and from its bottom to its top: the wall itself, not its cut mesh. Aiming
 * a door or window at the meshes, the opening's own hole let the ray through: the aim fell off the wall,
 * the preview went, the hole closed, the aim came back, over and over (it flickered). Null when no straight
 * wall is under the ray (an arc wall is aimed at by its mesh).
 */
/** `lift`: how far up the 3D draws a level (exploded, levels apart): its walls' heights are the document's
 * plus that, as the ray sees them. Compared with the document's alone, an upper level's walls were never hit. */
export function wallUnderRay(
  doc: Doc,
  levelIds: ReadonlySet<string>,
  ray: { origin: { x: number; y: number; z: number }; dir: { x: number; y: number; z: number } },
  lift: (levelId: LevelId) => number = () => 0,
): { p: Point2; height: number } | null {
  const types = new Map(doc.wallTypes.map((x) => [x.id, x]));
  let best: { t: number; p: Point2; height: number } | null = null;
  for (const wall of doc.walls) {
    if (!levelIds.has(wall.levelId) || wall.bulge) continue;
    const shape = shapeOf(wall, types.get(wall.wallTypeId));
    if (typeof shape === 'string' || arcOf(shape) !== null) continue;
    const n = wallNormal(shape);
    const [o0, o1] = faceOffsets(shape);
    const base = add(shape.start, scale(n, (o0 + o1) / 2));
    const denom = ray.dir.x * n.x + ray.dir.y * n.y;
    if (Math.abs(denom) < 1e-9) continue;
    const t = ((base.x - ray.origin.x) * n.x + (base.y - ray.origin.y) * n.y) / denom;
    if (t <= 0 || (best && t >= best.t)) continue;
    const p = { x: ray.origin.x + ray.dir.x * t, y: ray.origin.y + ray.dir.y * t };
    // In the document's heights: the ray's less the level's lift in the view.
    const height = ray.origin.z + ray.dir.z * t - lift(wall.levelId);
    const station = dot(sub(p, shape.start), wallDirection(shape));
    if (station < 0 || station > referenceLength(wall)) continue;
    const { bottom, top } = wallHeights(doc, wall);
    if (height < bottom || height > top) continue;
    best = { t, p, height };
  }
  return best ? { p: best.p, height: best.height } : null;
}
