import type { Point2 } from '../../core/vector';

// Spike schema: one layer per wall, thickness on the wall itself. Wall types with layers come next.

export type WallId = string;
export type WallEnd = 'start' | 'end';
export type ReferenceLine = 'centerline' | 'interiorFace' | 'exteriorFace';

export interface Wall {
  readonly id: WallId;
  readonly start: Point2;
  readonly end: Point2;
  readonly thickness: number;
  readonly referenceLine: ReferenceLine;
}

export interface EndRef {
  readonly wallId: WallId;
  readonly end: WallEnd;
}
