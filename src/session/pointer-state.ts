// The pointer's and keyboard's state between events, with one owner: the input wired for the app
// (input.ts) holds it and hands the same object to the keys (input-keys.ts), so nothing is copied.

import type { Point2 } from '../model/vector';
import type { BoxFace, SectionBox } from '../model/section-box';

export interface PointerState {
  panning: { x: number; y: number } | null;
  downAt: { x: number; y: number } | null;
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
  /** A section box face being dragged by its handle: the box and the pointer as it was pressed. */
  boxDrag: { face: BoxFace; box: SectionBox; from: { x: number; y: number }; along: { x: number; y: number } } | null;
}

export const pointerState = (): PointerState => ({
  panning: null,
  downAt: null,
  rightAt: null,
  shift: false,
  altAt: null,
  altMoved: false,
  lastMove: null,
  acquireTimer: 0,
  tabAt: null,
  again: null,
  boxDrag: null,
});
