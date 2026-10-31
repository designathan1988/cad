import type { Point2 } from '../../model/vector';

import type { Brand } from '../../core/id';
import { newId } from '../../core/id';

/** A wall's id (wall_…). */
export type WallId = Brand<'wall'>;

/** A new wall's id (wall_…). */
export const newWallId = (): WallId => newId('wall') as WallId;

/** The ids among `ids` that are walls of `walls` (a selection holds every kind). */
export const wallsIn = (walls: readonly { readonly id: WallId }[], ids: Iterable<string>): WallId[] => {
  const mine = new Set<string>(walls.map((w) => w.id));
  return [...ids].filter((id): id is WallId => mine.has(id));
};
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

/**
 * Where a wall's top is: its level's height plus an offset; a fixed height above its base; another
 * level's floor plus an offset (Revit's Top Constraint "up to level"); or the underside of the roofs
 * over it (Revit's Attach Top: a gable wall rises to the ridge).
 */
export type HeightRule =
  | { readonly kind: 'level'; readonly offset: number }
  | { readonly kind: 'fixed'; readonly height: number }
  | { readonly kind: 'toLevel'; readonly levelId: string; readonly offset: number }
  | { readonly kind: 'roof' };

/**
 * Layers are listed from the exterior face (right of the drawing direction) to the interior. A type
 * may also give its walls a top and a base offset; a wall without its own takes the type's.
 */
export interface WallType {
  readonly id: WallTypeId;
  readonly name: string;
  readonly layers: readonly WallLayer[];
  readonly top?: HeightRule;
  readonly baseOffset?: number;
}

/**
 * How one end of a wall joins, when the user chose (Revit's Wall Joins and Disallow Join; spec §2.1):
 * 'miter' even between different types; in a butt, 'through' (this wall goes on to the other's outer
 * face) or 'stop' (this one stops at the other's face); 'off', not joined at all, ended square.
 * Absent: automatic.
 */
export type EndJoin = 'off' | 'through' | 'stop' | 'miter' | 'square';

/** What the user decided. Thickness, layers and core come from the type, always derived. */
export interface Wall {
  readonly id: WallId;
  readonly wallTypeId: WallTypeId;
  readonly start: Point2;
  readonly end: Point2;
  readonly referenceLine: ReferenceLine;
  /** 0 or absent: straight. Otherwise tan(sweep / 4), positive counter-clockwise (DXF's bulge). */
  readonly bulge?: number;
  /** How each end joins, when chosen (EndJoin); absent is automatic. */
  readonly joins?: { readonly start?: EndJoin; readonly end?: EndJoin };
}

export interface EndRef {
  readonly wallId: WallId;
  readonly end: WallEnd;
}
