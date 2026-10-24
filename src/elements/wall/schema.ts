import type { Point2 } from '../../core/vector';

export type WallId = string;
export type WallTypeId = string;
export type MaterialId = string;
export type WallEnd = 'start' | 'end';
export type ReferenceLine = 'centerline' | 'interiorFace' | 'exteriorFace';

/** Revit's layer functions. Structure layers form the core. */
export type LayerFunction = 'structure' | 'substrate' | 'thermal' | 'finish1' | 'finish2';

export interface WallLayer {
  readonly thickness: number;
  readonly function: LayerFunction;
  readonly materialId: MaterialId;
}

/** Layers are listed from the exterior face (right of the drawing direction) to the interior. */
export interface WallType {
  readonly id: WallTypeId;
  readonly name: string;
  readonly layers: readonly WallLayer[];
}

/** What the user decided. Thickness, layers and core come from the type, always derived. */
export interface Wall {
  readonly id: WallId;
  readonly wallTypeId: WallTypeId;
  readonly start: Point2;
  readonly end: Point2;
  readonly referenceLine: ReferenceLine;
}

export interface EndRef {
  readonly wallId: WallId;
  readonly end: WallEnd;
}
