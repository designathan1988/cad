// The Modify tools as a state machine with a written table and a pure transition, as Revit's Move,
// Copy, Rotate, Scale and Mirror and SketchUp's Move, Rotate and Scale: points picked on the drawing
// (snapped by the caller, from the base point), or a value typed in the footer, then one command
// (transform.ts) for the selection.
//
// | tool   | 1st click          | 2nd click                 | 3rd click          | typed                       |
// |--------|--------------------|---------------------------|--------------------|-----------------------------|
// | move   | base point         | where the base goes       |                    | distance toward the pointer |
// | copy   | as move; the copy is placed and the originals stay                                         |
// | rotate | centre             | start of the angle        | end of the angle   | degrees, counter-clockwise  |
// | scale  | base point         | end of a reference length | its new end        | factor                      |
// | mirror | axis's first point | axis's second point       |                    | the axis's angle, degrees   |
// | offset | where the copy goes: as far off the selected wall's line as the pointer is | distance, pointer's side |
//
// Offset, as Revit's, takes no base: its one click is the distance across the selected wall's line
// (`line`), and it makes a copy by default.
//
// Esc steps back one click; at the first, the app leaves the tool. A value typed before any point is
// refused: it needs the base.

import { MIN_WALL_LENGTH } from '../core/tolerance';
import { distance, dot, normalize, type Point2, scale, sub, add } from '../core/vector';
import { reflection, rotation, scaling, type Transform, translation } from './transform';

export type ModifyKind = 'move' | 'copy' | 'rotate' | 'scale' | 'mirror' | 'offset';

/** The straight wall an offset is measured across. */
export type OffsetLine = { readonly start: Point2; readonly end: Point2 };

export type ModifyState =
  | { readonly step: 'base' }
  | { readonly step: 'second'; readonly base: Point2 }
  | { readonly step: 'third'; readonly base: Point2; readonly ref: Point2 };

export type ModifyEvent = { readonly kind: 'click'; readonly point: Point2 } | { readonly kind: 'typed'; readonly value: number } | { readonly kind: 'escape' };

export interface ModifyResult {
  readonly state: ModifyState;
  /** The transform to apply now: the tool is done. */
  readonly apply?: Transform;
  /** Esc at the first step: the app leaves the tool. */
  readonly leave?: boolean;
  /** The event did nothing (a value before a base, a zero angle or factor). */
  readonly rejected?: boolean;
}

export const MODIFY_START: ModifyState = { step: 'base' };

/** Whether the tool takes three points (an angle or a ratio) rather than two. */
const threePoints = (kind: ModifyKind) => kind === 'rotate' || kind === 'scale';

const angleOf = (v: Point2) => Math.atan2(v.y, v.x);

/** The unit normal of the line, and how far p is from it along that normal (signed). */
function across(line: OffsetLine, p: Point2): { n: Point2; d: number } {
  const u = normalize(sub(line.end, line.start));
  const n = { x: -u.y, y: u.x };
  return { n, d: dot(sub(p, line.start), n) };
}

/** What the tool would do with the pointer at `cursor` now; null while it has too few points. */
export function previewTransform(kind: ModifyKind, state: ModifyState, cursor: Point2 | null, line?: OffsetLine): Transform | null {
  if (kind === 'offset') {
    if (!cursor || !line) return null;
    const { n, d } = across(line, cursor);
    return Math.abs(d) >= MIN_WALL_LENGTH ? translation(scale(n, d)) : null;
  }
  if (!cursor || state.step === 'base') return null;
  const { base } = state;
  if (state.step === 'second') {
    // No step under a millimetre, as the other tools: a copy clicked back on its base lay on the originals.
    if (kind === 'move' || kind === 'copy') return distance(cursor, base) >= MIN_WALL_LENGTH ? translation(sub(cursor, base)) : null;
    if (kind === 'mirror') return distance(cursor, base) >= MIN_WALL_LENGTH ? reflection(base, cursor) : null;
    return null;
  }
  const { ref } = state;
  if (kind === 'rotate') return rotation(base, angleOf(sub(cursor, base)) - angleOf(sub(ref, base)));
  if (kind === 'scale') {
    // Along the reference's direction, so a pointer off it does not shrink the scale.
    const len = distance(ref, base);
    const k = dot(sub(cursor, base), normalize(sub(ref, base))) / len;
    return k > 1e-6 ? scaling(base, k) : null;
  }
  return null;
}

export function modifyTransition(kind: ModifyKind, state: ModifyState, event: ModifyEvent, cursor: Point2 | null, line?: OffsetLine): ModifyResult {
  if (kind === 'offset') {
    if (event.kind === 'escape') return { state, leave: true };
    if (!line) return { state, rejected: true };
    if (event.kind === 'click') {
      const t = previewTransform(kind, state, event.point, line);
      return t ? { state, apply: t } : { state, rejected: true };
    }
    // Typed: that far, to the side the pointer is on (the wall's left, with no pointer).
    if (!Number.isFinite(event.value) || event.value <= 0) return { state, rejected: true };
    const side = cursor ? Math.sign(across(line, cursor).d) || 1 : 1;
    return { state, apply: translation(scale(across(line, line.start).n, event.value * side)) };
  }
  if (event.kind === 'escape') {
    if (state.step === 'third') return { state: { step: 'second', base: state.base } };
    if (state.step === 'second') return { state: MODIFY_START };
    return { state, leave: true };
  }
  if (event.kind === 'click') {
    if (state.step === 'base') return { state: { step: 'second', base: event.point } };
    if (state.step === 'second' && threePoints(kind)) {
      if (distance(event.point, state.base) < MIN_WALL_LENGTH) return { state, rejected: true };
      return { state: { step: 'third', base: state.base, ref: event.point } };
    }
    const t = previewTransform(kind, state, event.point);
    return t ? { state: MODIFY_START, apply: t } : { state, rejected: true };
  }
  // A typed value: after the base, for every tool.
  if (state.step === 'base' || !Number.isFinite(event.value)) return { state, rejected: true };
  const { base } = state;
  const v = event.value;
  switch (kind) {
    case 'move':
    case 'copy': {
      // Toward the pointer, as a wall's typed length goes.
      const dir = cursor && distance(cursor, base) > 1e-9 ? normalize(sub(cursor, base)) : { x: 1, y: 0 };
      return v > 0 ? { state: MODIFY_START, apply: translation(scale(dir, v)) } : { state, rejected: true };
    }
    case 'rotate':
      return v !== 0 ? { state: MODIFY_START, apply: rotation(base, (v * Math.PI) / 180) } : { state, rejected: true };
    case 'scale':
      return v > 0 ? { state: MODIFY_START, apply: scaling(base, v) } : { state, rejected: true };
    case 'mirror': {
      const a = (v * Math.PI) / 180;
      return { state: MODIFY_START, apply: reflection(base, add(base, { x: Math.cos(a), y: Math.sin(a) })) };
    }
  }
}
