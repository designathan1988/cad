import type { Point2 } from '../../../core/vector';
import type { HalfPlane } from '../geometry/convex';
import type { EndRef, WallId } from '../schema';

/** How one wall end is trimmed: lengthen the band by `extension`, then apply every cut. */
export interface EndCut {
  readonly extension: number;
  readonly cuts: readonly HalfPlane[];
}

export type JoinWarningKind = 'wallsOverlap' | 'complexJoin' | 'wallTooShort';

export interface JoinWarning {
  readonly kind: JoinWarningKind;
  readonly walls: readonly WallId[];
}

/**
 * Two ends joined as an L. `node` is where they meet: the midpoint when the ends coincide, or the
 * crossing of the reference lines when each end sits inside the other wall (they overran each other).
 */
export interface Corner {
  readonly ends: readonly [EndRef, EndRef];
  readonly node: Point2;
}

export interface JoinGraph {
  readonly corners: readonly Corner[];
  readonly abutments: readonly { readonly abutting: EndRef; readonly hostId: WallId }[];
  readonly warnings: readonly JoinWarning[];
}
