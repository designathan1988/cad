import type { Point2 } from '../../../core/vector';
import type { HalfPlane } from '../geometry/convex';
import type { EndRef, WallId } from '../schema';

/**
 * How one wall end is trimmed: lengthen the band by `extension`, then apply `cuts` to every layer,
 * plus `layerCuts[k]` to layer k.
 */
export interface EndCut {
  readonly extension: number;
  readonly cuts: readonly HalfPlane[];
  readonly layerCuts?: readonly (readonly HalfPlane[])[];
}

/** A convex region removed from some layers of a wall: where another wall's core passes through. */
export interface Notch {
  readonly wallId: WallId;
  /** The removed region is where all of these hold. */
  readonly region: readonly HalfPlane[];
  /** First and last layer index notched, inclusive. */
  readonly layers: readonly [number, number];
}

export type JoinWarningKind =
  | 'wallsOverlap'
  | 'complexJoin'
  /** A join with an arc the engine cannot make exact (the arc crosses a wall, or a T spans its segments). */
  | 'arcJoinUnsupported'
  | 'wallTooShort'
  | 'missingWallType'
  | 'invalidWallType'
  | 'arcTooTight';

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

/** Two walls crossing away from their ends (X): `through` keeps going, `cut` is split in two. */
export interface Crossing {
  readonly throughId: WallId;
  readonly cutId: WallId;
  /** Where the reference lines cross. */
  readonly point: Point2;
}

/** Three or four ends at one point (§7.4). Five or more warn complexJoin instead. */
export interface JoinNode {
  readonly ends: readonly EndRef[];
  readonly point: Point2;
}

export interface JoinGraph {
  readonly corners: readonly Corner[];
  readonly nodes: readonly JoinNode[];
  readonly crossings: readonly Crossing[];
  readonly abutments: readonly { readonly abutting: EndRef; readonly hostId: WallId }[];
  readonly warnings: readonly JoinWarning[];
}
