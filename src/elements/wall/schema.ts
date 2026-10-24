import type { Point2 } from '../../core/vector';

export type WallId = string;
export type WallTypeId = string;
export type MaterialId = string;
export type WallEnd = 'start' | 'end';
export type ReferenceLine = 'centerline' | 'interiorFace' | 'exteriorFace';

/** Revit's layer functions. Structure layers form the core. */
export type LayerFunction = 'structure' | 'substrate' | 'thermal' | 'finish1' | 'finish2';

/** Revit's join priority of each function: 1 is the highest. */
export const LAYER_PRIORITY: Readonly<Record<LayerFunction, number>> = {
  structure: 1,
  substrate: 2,
  thermal: 3,
  finish1: 4,
  finish2: 5,
};

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
  /** 0 or absent: straight. Otherwise tan(sweep / 4), positive counter-clockwise (DXF's bulge). */
  readonly bulge?: number;
}

export interface EndRef {
  readonly wallId: WallId;
  readonly end: WallEnd;
}
