// Rooms and floors: only what the user decided. A room is a point inside walls, with a name and a
// number; its outline, area and perimeter are always derived from the walls around the point. A
// floor is a slab on a level, following a room's outline or one the user drew.

import type { LevelId } from '../../app/document';
import type { Point2 } from '../../core/vector';

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
  /** Top of the slab above the level (m). */
  readonly offset: number;
}

export const FLOOR_DEFAULTS = { thickness: 0.15, offset: 0 } as const;
