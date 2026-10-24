// Doors and windows. An opening is hosted by a wall and placed by a rule; its actual position along
// the wall is always derived from the rule and the wall as it is now (derive.ts), never stored.

import type { WallId } from '../wall/schema';

export type OpeningId = string;
export type OpeningKind = 'door' | 'window';

/**
 * Where the opening sits along its wall. Distances run along the wall's reference line, from the
 * reference to the nearest jamb: from the wall's start or end, or the clear gap from another opening
 * on the same wall (`toward` says on which side of it this one lies).
 */
export type PositionRule =
  | { readonly kind: 'fromStart'; readonly distance: number }
  | { readonly kind: 'fromEnd'; readonly distance: number }
  | { readonly kind: 'centered' }
  | { readonly kind: 'fromOpening'; readonly openingId: OpeningId; readonly distance: number; readonly toward: 'start' | 'end' };

export type RuleKind = PositionRule['kind'];

export interface Opening {
  readonly id: OpeningId;
  readonly wallId: WallId;
  readonly kind: OpeningKind;
  readonly width: number;
  readonly height: number;
  /** Height of the bottom above the wall's base (m); 0 for doors. */
  readonly sill: number;
  readonly rule: PositionRule;
  /** Doors: the jamb the leaf hangs on, toward the wall's start or end. */
  readonly hinge: 'start' | 'end';
  /** Doors: the side of the wall the leaf opens to, seen along the drawing direction. */
  readonly swing: 'left' | 'right';
}

export const OPENING_DEFAULTS: Readonly<Record<OpeningKind, { readonly width: number; readonly height: number; readonly sill: number }>> = {
  door: { width: 0.9, height: 2.1, sill: 0 },
  window: { width: 1.2, height: 1.2, sill: 1 },
};

export function newOpening(
  id: OpeningId,
  wallId: WallId,
  kind: OpeningKind,
  rule: PositionRule,
  size: Partial<Pick<Opening, 'width' | 'height' | 'sill' | 'hinge' | 'swing'>> = {},
): Opening {
  return { id, wallId, kind, ...OPENING_DEFAULTS[kind], hinge: 'start', swing: 'left', ...size, rule };
}

/** The ids every opening id starts with, so a selection can tell openings from walls. */
export const OPENING_PREFIX = 'opening';
export const isOpeningId = (id: string): boolean => id.startsWith(`${OPENING_PREFIX}_`);
