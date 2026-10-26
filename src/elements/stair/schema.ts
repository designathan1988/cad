// Stairs (ref/chat.txt:90, 137): from its level's floor up to the next level, the steps set by that
// height (risers near 17.5 cm), straight, in L, in U or spiral, with a landing where an L or a U turns,
// and a handrail on each side. Placed by its first step's front edge (`at`, the middle of it) and the way
// it climbs (`angle`); a spiral is centred a radius ahead of that point. geometry.ts lays the steps out.

import type { Point2 } from '../../core/vector';

export const STAIR_PREFIX = 'stair';
export type StairKind = 'straight' | 'l' | 'u' | 'spiral';

export interface Stair {
  readonly id: string;
  readonly levelId: string;
  readonly kind: StairKind;
  /** The middle of the first step's front edge (a spiral's centre is its radius ahead of it). */
  readonly at: Point2;
  /** The way it climbs (radians, from the plan's x); a spiral's first step. */
  readonly angle: number;
  /** Clear width of a flight (m); a spiral's radius less its post. */
  readonly width: number;
  /** Depth of a step (m). */
  readonly tread: number;
  /** Where an L or a U turns, seen climbing. */
  readonly turn: 'left' | 'right';
  /** How high it climbs (m); its level's height when not set. */
  readonly height?: number;
  /** A handrail on each side (default) or none. */
  readonly railing?: boolean;
}

export const isStairId = (id: string): boolean => id.startsWith(`${STAIR_PREFIX}_`);

/** A new stair's flight width and step depth (m), and the riser it is laid out near. */
export const STAIR_WIDTH = 1.0;
export const STAIR_TREAD = 0.28;
export const STAIR_RISER = 0.175;
/** A handrail's height above the steps' nosing (m). */
export const RAIL_HEIGHT = 0.9;
