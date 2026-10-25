// What the door and window tool needs from the screen: the wall under the cursor as an Aim, and the
// dimension guide of the opening being placed. Read-only over the document and its geometry.

import { add, dot, type Point2, scale, sub } from '../core/vector';
import { hasDistance, type PositionRule } from '../elements/opening/schema';
import { referenceLength } from '../elements/opening/derive';
import { arcOf } from '../elements/wall/geometry/arc';
import { faceOffsets, wallDirection, wallNormal } from '../elements/wall/geometry/offset';
import { shapeOf } from '../elements/wall/geometry/shape';
import { type Aim, ruleBase } from '../tools/opening-tool';
import { num, t, type MessageKey } from '../ui/i18n';
import type { Doc } from './document';
import type { DerivedGeometry } from './geometry';
import { wallStops } from './wall-stops';

/** Id of the opening being placed, in the derived geometry only. */
export const OPENING_PREVIEW_ID = '__opening_preview__';

/** Extra reach beyond the wall's faces, in screen pixels, so thin walls are easy to point at. */
const REACH_PX = 6;

/**
 * The wall of the level under p: within its faces (plus a few pixels) and between its ends. Measured
 * on the wall's own shape, not on its cut pieces, so the preview's own hole never hides the wall.
 */
export function aimAt(doc: Doc, g: DerivedGeometry, levelId: string, p: Point2, mpp: number, previewId: string): Aim | null {
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
    best = { aim: { wallId: wall.id, length, station, side: offset >= centre ? 'left' : 'right', others, mpp, stops: wallStops(doc, wall.id) }, miss };
  }
  return best?.aim ?? null;
}

/**
 * The aim at a station of a given wall, as if the cursor were there on its centre line: the keyboard's
 * way to the door and window tools (a wall chosen with N, then D or Shift+W). Null when the wall is
 * not there to aim at.
 */
export function aimAlong(doc: Doc, g: DerivedGeometry, wallId: string, station: number, mpp: number, previewId: string): Aim | null {
  const wall = doc.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const length = referenceLength(wall);
  const others = [...g.openings.values()]
    .filter((o) => o.opening.wallId === wall.id && o.opening.id !== previewId)
    .map((o) => ({ id: o.opening.id, start: o.start, end: o.end }));
  return { wallId, length, station: Math.min(Math.max(station, 0), length), side: 'left', others, mpp, stops: wallStops(doc, wallId) };
}

/**
 * The rule in words, for the footer: "0.55 m from the wall start", or, measured from a wall meeting
 * this one (a base past the wall's end), "0.40 m from the wall face".
 */
export const ruleText = (rule: PositionRule, base = 0): string =>
  base > 0 && (rule.kind === 'fromStart' || rule.kind === 'fromEnd')
    ? t('ruleShort.fromFace', { d: num(rule.distance - base) })
    : t(`ruleShort.${rule.kind}` as MessageKey, hasDistance(rule) ? { d: num(rule.distance) } : {});

/**
 * The dimension of the opening being placed: a dashed line along the wall from the rule's reference
 * to the nearest jamb, and its length. Null when centred or not on a straight wall.
 */
export function ruleGuide(doc: Doc, g: DerivedGeometry, previewId: string): { axis: { start: Point2; end: Point2 }; measure: { at: Point2; text: string } } | null {
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
  // Drawn along the wall's exterior face, outside the opening's symbol.
  const at = (s: number) => add(add(f.start, scale(f.dir, s - o.start)), scale(f.normal, f.faces[0] - 0.5));
  const start = at(span[0]);
  const end = at(span[1]);
  return { axis: { start, end }, measure: { at: scale(add(start, end), 0.5), text: `${num(Math.abs(span[1] - span[0]))} m` } };
}
