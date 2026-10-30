// Rooms and floors: only what the user decided. A room is a point inside walls, with a name and a
// number; its outline, area and perimeter are always derived from the walls around the point. A
// floor is a slab on a level, following a room's outline or one the user drew.

import type { LevelId } from '../../project/doc';
import type { Point2 } from '../../model/vector';

export type RoomId = string;
export type FloorId = string;

/** What a room is for (ref/chat.txt:94): one of these, or none said. */
export const ROOM_USES = ['living', 'bedroom', 'kitchen', 'bathroom', 'service', 'office', 'circulation', 'garage', 'storage', 'other'] as const;
export type RoomUse = (typeof ROOM_USES)[number];

export interface Room {
  readonly id: RoomId;
  readonly levelId: LevelId;
  /** Where the user clicked: the room is the space around it, bounded by walls. */
  readonly seed: Point2;
  readonly name: string;
  readonly number: string;
  readonly use?: RoomUse;
  /** Floor to ceiling (m), when the room has its own; else its level's height. */
  readonly height?: number;
  /** What its floor, walls and ceiling are finished in (the project's materials) and its skirting's height. */
  readonly finishes?: RoomFinishes;
}

export interface RoomFinishes {
  readonly floor?: string;
  readonly wall?: string;
  readonly ceiling?: string;
  /** The skirting's height (m); none without. */
  readonly base?: number;
}

/** How a floor's finish is laid (paginação): the pieces' size, the joint, the pattern and its angle. */
export const TILE_PATTERNS = ['grid', 'running', 'herringbone', 'checker'] as const;
export type TilePattern = (typeof TILE_PATTERNS)[number];
export interface Tiling {
  /** A piece across and along (m). */
  readonly width: number;
  readonly length: number;
  readonly joint: number;
  readonly pattern: TilePattern;
  /** Turned this much (degrees) from the plan's x. */
  readonly angle: number;
}

/** A layer of a floor's build-up, from the top down. */
export interface FloorLayer {
  readonly materialId: string;
  readonly thickness: number;
}

export type FloorSource =
  | { readonly kind: 'room'; readonly roomId: RoomId }
  | { readonly kind: 'outline'; readonly points: readonly Point2[] };

export interface Floor {
  readonly id: FloorId;
  readonly levelId: LevelId;
  readonly source: FloorSource;
  /** Slab thickness below its top (m). */
  readonly thickness: number;
  /** Top of the slab above the level (m); with a slope, of its lowest corner. */
  readonly offset: number;
  /** Openings through it (a stair's, a shaft's): outlines inside it. */
  readonly holes?: readonly (readonly Point2[])[];
  /** A slab that rises `grade` % toward the plan direction `dir` (radians), from its lowest corner. */
  readonly slope?: { readonly grade: number; readonly dir: number };
  /** A ceiling: hung under the level above, drawn dotted in plan (it is above the cut). */
  readonly kind?: 'ceiling';
  /** Its finish's pieces, drawn in plan and counted (paginação). */
  readonly tiling?: Tiling;
  /** Its build-up from the top down; its thickness is theirs. Absent: one slab of its thickness. */
  readonly layers?: readonly FloorLayer[];
}

/** Usual build-ups to start from: a slab with its screed and finish, a ceiling board. */
export const FLOOR_BUILDUPS: Readonly<Record<string, readonly FloorLayer[]>> = {
  slabTiled: [
    { materialId: 'tile', thickness: 0.01 },
    { materialId: 'screed', thickness: 0.04 },
    { materialId: 'concrete', thickness: 0.1 },
  ],
  slabWood: [
    { materialId: 'wood', thickness: 0.02 },
    { materialId: 'screed', thickness: 0.03 },
    { materialId: 'concrete', thickness: 0.1 },
  ],
  groundSlab: [
    { materialId: 'tile', thickness: 0.01 },
    { materialId: 'screed', thickness: 0.03 },
    { materialId: 'concrete', thickness: 0.08 },
    { materialId: 'gravel', thickness: 0.05 },
  ],
  gypsumCeiling: [{ materialId: 'gypsum', thickness: 0.0125 }],
  porcelainLarge: [{ materialId: 'porcelainLarge', thickness: 0.01 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'concrete', thickness: 0.1 }],
  vinyl: [{ materialId: 'vinylPlank', thickness: 0.003 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'concrete', thickness: 0.1 }],
  laminate: [{ materialId: 'laminate', thickness: 0.008 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'concrete', thickness: 0.1 }],
  parquet: [{ materialId: 'parquet', thickness: 0.02 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'concrete', thickness: 0.1 }],
  burntCement: [{ materialId: 'concretePolished', thickness: 0.02 }, { materialId: 'screed', thickness: 0.03 }, { materialId: 'concrete', thickness: 0.1 }],
  marble: [{ materialId: 'marble', thickness: 0.02 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'concrete', thickness: 0.1 }],
  terrazzo: [{ materialId: 'terrazzo', thickness: 0.015 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'concrete', thickness: 0.1 }],
  hydraulic: [{ materialId: 'hydraulicTile', thickness: 0.02 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'concrete', thickness: 0.1 }],
  carpet: [{ materialId: 'carpet', thickness: 0.01 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'concrete', thickness: 0.1 }],
  deck: [{ materialId: 'deck', thickness: 0.025 }, { materialId: 'concrete', thickness: 0.08 }],
  stoneOutdoor: [{ materialId: 'stone', thickness: 0.03 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'gravel', thickness: 0.08 }],
  flagstoneOutdoor: [{ materialId: 'flagstone', thickness: 0.03 }, { materialId: 'screed', thickness: 0.04 }, { materialId: 'gravel', thickness: 0.08 }],
  woodCeiling: [{ materialId: 'woodSlats', thickness: 0.01 }],
  pvcCeiling: [{ materialId: 'plasticWhite', thickness: 0.008 }],
};

/** A new ceiling's thickness (m): a plaster board. */
export const CEILING_THICKNESS = 0.02;

export const FLOOR_DEFAULTS = { thickness: 0.15, offset: 0 } as const;
