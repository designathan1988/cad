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

/** Three or more ends at one point (§7.4, §7.6). */
export interface JoinNode {
  readonly ends: readonly EndRef[];
  readonly point: Point2;
}

export interface Abutment {
  readonly abutting: EndRef;
  readonly hostId: WallId;
}

/**
 * Walls passing one point together with others (two crossings there, an end on a crossing, an end
 * inside an L's corner): every wall passing it is two arms, one each way ('before' from its start to
 * the point, 'after' from the point to its end), every end one arm, each taking its sector
 * (sectors.ts). `absorbs`: the joins it stands for, set aside when it is made.
 */
export interface Junction {
  readonly point: Point2;
  readonly passing: readonly WallId[];
  readonly ends: readonly EndRef[];
  readonly absorbs: {
    readonly corners: readonly Corner[];
    readonly nodes: readonly JoinNode[];
    readonly crossings: readonly Crossing[];
    readonly abutments: readonly Abutment[];
  };
}

export interface JoinGraph {
  readonly corners: readonly Corner[];
  readonly nodes: readonly JoinNode[];
  readonly crossings: readonly Crossing[];
  readonly abutments: readonly Abutment[];
  readonly junctions: readonly Junction[];
  readonly warnings: readonly JoinWarning[];
}
