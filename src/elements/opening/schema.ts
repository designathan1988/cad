// Doors and windows. An opening is hosted by a wall and placed by a rule; its actual position along
// the wall is always derived from the rule and the wall as it is now (derive.ts), never stored.

import type { WallId } from '../wall/schema';
import { type Brand, newId } from '../../core/id';

/** A door's or window's id (opening_…). */
export type OpeningId = Brand<'opening'>;
export type OpeningKind = 'door' | 'window';

/**
 * Where the opening sits along its wall. Distances run along the wall's reference line, from the
 * reference to the nearest jamb: from the wall's start or end, or the clear gap from another opening
 * on the same wall (`toward` says on which side of it this one lies). Aligned: across from another
 * opening on another straight wall, by its centre or by the jamb toward this wall's start or end.
 * In a group: where its distributed group puts it.
 */
export type PositionRule =
  | { readonly kind: 'fromStart'; readonly distance: number }
  | { readonly kind: 'fromEnd'; readonly distance: number }
  | { readonly kind: 'centered' }
  | { readonly kind: 'fromOpening'; readonly openingId: OpeningId; readonly distance: number; readonly toward: 'start' | 'end' }
  | { readonly kind: 'aligned'; readonly openingId: OpeningId; readonly edge: AlignEdge }
  | { readonly kind: 'inGroup'; readonly groupId: OpeningGroupId };

export type AlignEdge = 'start' | 'center' | 'end';
/** The rules measured by a distance the user can type. */
export type DistanceRule = Extract<PositionRule, { readonly distance: number }>;
export const hasDistance = (r: PositionRule): r is DistanceRule => 'distance' in r;
/** A group of doors and windows spread together (group_…). */
export type OpeningGroupId = Brand<'group'>;

/**
 * Openings of one wall placed together, in wall order. Equal: the same space between the stretch's
 * ends and each opening. Fixed: a set gap between neighbours, the row centred or measured from one end.
 */
export type GroupSpacing =
  | { readonly kind: 'equal' }
  | { readonly kind: 'fixed'; readonly gap: number; readonly anchor: 'start' | 'centered' | 'end'; readonly distance: number };

export interface OpeningGroup {
  readonly id: OpeningGroupId;
  readonly wallId: WallId;
  readonly members: readonly OpeningId[];
  readonly spacing: GroupSpacing;
  /**
   * The stretch of the wall the group keeps to: from the joint with the first wall to the joint with
   * the second, along the host; null is the host's own end. Absent: the whole wall. Set when the group
   * is made, from the joints just outside its openings, so they never land on a joint they were clear of.
   */
  readonly between?: readonly [WallId | null, WallId | null];
}

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
  /** How it is made and opens (style.ts). Absent: drawn as a plain leaf or pane, as before styles. */
  readonly style?: OpeningStyle | undefined;
}

/** How a door opens (IFC IfcDoorTypeOperationEnum, style.ts maps them). */
export const DOOR_OPERATIONS = ['swing', 'double', 'sliding', 'pivot', 'folding', 'overhead', 'roller'] as const;
/** How a window's panes open (IFC IfcWindowPanelOperationEnum). */
export const WINDOW_OPERATIONS = ['fixed', 'sliding', 'casement', 'awning', 'hopper', 'pivot', 'doubleHung'] as const;
export type Operation = (typeof DOOR_OPERATIONS)[number] | (typeof WINDOW_OPERATIONS)[number];

/**
 * The make of a door or window, after IFC's lining and panel properties: how it opens, its leaves or
 * panes side by side, the frame's width in the jambs and head, the trim on both faces past the jambs,
 * a transom over the leaves (its height), a threshold on the floor. Lengths in metres; 0 is none.
 */
export interface OpeningStyle {
  readonly operation: Operation;
  readonly leaves: number;
  readonly frame: number;
  readonly casing: number;
  readonly transom: number;
  readonly threshold: boolean;
  /** A window's protection on its outside face: a shutter (veneziana, slats) or a grille (grade, bars); none when absent. */
  readonly screen?: WindowScreen;
  /** A window's mullions where they are wanted: each from the start jamb's inside face (m); the panes equal when absent. */
  readonly mullions?: readonly number[];
  /** A window's transoms (travessas): each above the clear opening's bottom (m); none when absent. */
  readonly transoms?: readonly number[];
  /** A door leaf's design: flush (lisa), raised panels (almofadada), glazed, half glazed, slats (veneziana), grooves (frisada). */
  readonly design?: LeafDesign;
  /** How far it stands open, 0 closed to 1 fully (a swinging leaf 90°, a sliding one pushed aside, a sash raised or tilted). */
  readonly open?: number;
  /** A door's handle: a lever, a pull bar, a knob or none; by how it opens when absent. */
  readonly handle?: DoorHandle;
  /** The leaves' (sashes') and the frame's materials, of the project's; the scene's when absent. */
  readonly leafMaterial?: string;
  readonly frameMaterial?: string;
  /** The glass: clear or frosted. */
  readonly glazing?: 'clear' | 'frosted';
  /** Glazing bars dividing each pane into this many across and up (2 or more); none when absent. */
  readonly muntins?: number;
}

export type LeafDesign = 'flush' | 'panels' | 'glazed' | 'halfGlazed' | 'slats' | 'grooves';
export const LEAF_DESIGNS: readonly LeafDesign[] = ['flush', 'panels', 'glazed', 'halfGlazed', 'slats', 'grooves'];
export type DoorHandle = 'lever' | 'pull' | 'knob' | 'none';
export const DOOR_HANDLES: readonly DoorHandle[] = ['lever', 'pull', 'knob', 'none'];

export type WindowScreen = 'shutter' | 'grille';
export const WINDOW_SCREENS: readonly WindowScreen[] = ['shutter', 'grille'];

export const OPENING_DEFAULTS: Readonly<Record<OpeningKind, { readonly width: number; readonly height: number; readonly sill: number }>> = {
  door: { width: 0.9, height: 2.1, sill: 0 },
  window: { width: 1.2, height: 1.2, sill: 1 },
};

export function newOpening(
  id: OpeningId,
  wallId: WallId,
  kind: OpeningKind,
  rule: PositionRule,
  size: Partial<Pick<Opening, 'width' | 'height' | 'sill' | 'hinge' | 'swing' | 'style'>> = {},
): Opening {
  const { style, ...rest } = size;
  return { id, wallId, kind, ...OPENING_DEFAULTS[kind], hinge: 'start', swing: 'left', ...rest, ...(style ? { style } : {}), rule };
}

/** The ids every opening id starts with, so a selection can tell openings from walls. */
export const OPENING_PREFIX = 'opening';
/** Whether an id (a selection's, of any kind) is a door's or window's: every one read or made starts opening_. */
export const isOpeningId = (id: string): id is OpeningId => id.startsWith(`${OPENING_PREFIX}_`);

/** A new door's or window's id (opening_…). */
export const newOpeningId = (): OpeningId => newId(OPENING_PREFIX) as OpeningId;
export const GROUP_PREFIX = 'group';

/** A new group's id (group_…). */
export const newGroupId = (): OpeningGroupId => newId(GROUP_PREFIX) as OpeningGroupId;
