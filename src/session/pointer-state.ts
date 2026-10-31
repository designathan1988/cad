// The pointer's and keyboard's state between events, with one owner: the input wired for the app
// (input.ts) holds it and hands the same object to the keys (input-keys.ts), so nothing is copied.

import type { Point2 } from '../model/vector';
import type { BoxFace, SectionBox } from '../model/section-box';

/**
 * What the left button pressed is doing: a press on the drawing (where), or a section box face taken by
 * its handle (the box and the pointer as it was pressed). One at a time; the other buttons have their own.
 */
export type LeftPress =
  | { readonly kind: 'press'; readonly x: number; readonly y: number }
  | { readonly kind: 'box'; readonly face: BoxFace; readonly box: SectionBox; readonly from: { x: number; y: number }; readonly along: { x: number; y: number } };

export interface PointerState {
  /** The middle button held in plan (panning), the right one pressed (a click or an orbit). */
  panning: { x: number; y: number } | null;
  left: LeftPress | null;
  rightAt: { x: number; y: number } | null;
  shift: boolean;
  /** Where the pointer was when Alt was pressed, while it is held; whether it moved since. */
  altAt: Point2 | null;
  altMoved: boolean;
  /** The last pointer move over the drawing, and where Tab was last pressed (snap.ts, skip). */
  lastMove: PointerEvent | null;
  acquireTimer: number;
  tabAt: { x: number; y: number } | null;
  again: string | null;
}

/** A press on the drawing let go of (a gesture cancelled); a box face being dragged stays. */
export function dropPress(ptr: PointerState): void {
  if (ptr.left?.kind === 'press') ptr.left = null;
}

export const pointerState = (): PointerState => ({
  panning: null,
  left: null,
  rightAt: null,
  shift: false,
  altAt: null,
  altMoved: false,
  lastMove: null,
  acquireTimer: 0,
  tabAt: null,
  again: null,
});
