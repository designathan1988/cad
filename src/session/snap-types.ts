// What a snap is: its kinds and their labels, the result, and what the snapper is given to look at.

import type { Point2 } from '../model/vector';
import type { MessageKey } from '../i18n/messages';

export type SnapKind =
  | 'endpoint'
  | 'corner'
  | 'start'
  | 'guideCross'
  | 'intersection'
  | 'origin'
  | 'midpoint'
  | 'division'
  | 'center'
  | 'node'
  | 'locked'
  | 'onWall'
  | 'onFace'
  | 'onGuide'
  | 'perpendicular'
  | 'extension'
  | 'parallel'
  | 'aligned'
  | 'axis'
  | 'angle'
  | 'grid'
  | 'none';

export interface Snap {
  readonly point: Point2;
  readonly kind: SnapKind;
  /** Dashed guide from another point to the snapped one (alignment). */
  readonly guideFrom?: Point2;
  /** The wall the snap comes from (its end, middle, body, or the end it aligns with), when it has an id. */
  readonly wallId?: string;
}

export interface SnapInput {
  readonly cursor: Point2;
  /** Metres per screen pixel at the cursor. */
  readonly mpp: number;
  /**
   * `reach`: how far from its axis the wall's body goes (half its thickness, m). Its ends are taken
   * from anywhere on that body near them: the corner one sees is the faces', not the axis's. `face`:
   * an edge of a wall's drawn body (the measure tool): its ends are corners, its points on the face.
   */
  readonly segments: readonly {
    readonly id?: string;
    readonly start: Point2;
    readonly end: Point2;
    readonly reach?: number;
    readonly face?: boolean;
    /** An arc wall's bulge: its middle and its body are on the arc, not on the chord. */
    readonly bulge?: number;
  }[];
  /** The point being drawn from, if any. */
  readonly from: Point2 | null;
  /** The first point of the chain: clicking it closes the outline. */
  readonly chainStart: Point2 | null;
  readonly enabled: boolean;
  /** Shift: only right angles from `from`. */
  readonly orthogonal: boolean;
  /**
   * Guides (elements/guide/schema.ts): lines without ends, `dir` a unit vector. The pointer takes the
   * point where one crosses another or a wall's line, and else the guide itself.
   */
  readonly guides?: readonly GuideLine[];
  /**
   * The elements' own points on the level (app/input.ts): a door's or a window's ends and middle, an
   * object's or a column's corners (`node`) and middle (`center`). An arc wall's centre is taken from
   * its segment.
   */
  readonly points?: readonly { readonly point: Point2; readonly kind: 'center' | 'node' }[];
  /** Into how many parts a segment is divided besides its middle (division points): 3 when not set. */
  readonly parts?: number;
  /** Points already offered under the pointer (Tab, app/input.ts): passed over for the next one. */
  readonly skip?: readonly Point2[];
  /**
   * A direction the point is held to from `from` (a unit vector: an arrow key's axis, a wall's line or
   * square to it, or Shift's direction): the point slides along it, stopping where it crosses a wall
   * or a guide near the pointer.
   */
  readonly lock?: Point2;
  /** Points the pointer rested on (acquired): the point aligns with them across or up, as with walls' ends. */
  readonly acquired?: readonly Point2[];
  /** Circle guides: the point goes onto one near it, and to where one crosses a line guide or a wall. */
  readonly circles?: readonly { readonly center: Point2; readonly radius: number }[];
}

/** A line without ends: a point of it and its unit direction. */
export interface GuideLine {
  readonly point: Point2;
  readonly dir: Point2;
}

export const snapLabel: Readonly<Record<SnapKind, MessageKey | null>> = {
  endpoint: 'snap.endpoint',
  corner: 'snap.corner',
  start: 'snap.start',
  guideCross: 'snap.guideCross',
  intersection: 'snap.intersection',
  perpendicular: 'snap.perpendicular',
  extension: 'snap.extension',
  parallel: 'snap.parallel',
  origin: 'snap.origin',
  midpoint: 'snap.midpoint',
  division: 'snap.division',
  center: 'snap.center',
  node: 'snap.node',
  locked: 'snap.locked',
  onWall: 'snap.onWall',
  onFace: 'snap.onFace',
  onGuide: 'snap.onGuide',
  aligned: 'snap.alignedX',
  axis: 'snap.axis',
  angle: null,
  grid: null,
  none: null,
};
