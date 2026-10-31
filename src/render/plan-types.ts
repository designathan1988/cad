// What the plan is asked to draw (PlanOverlay: previews, snaps, measures, marks), a dimension mark, the
// part of the viewport the panels cover, and fitting a box into what is left.

import type { Point2 } from '../model/vector';
import type { Placed } from '../elements/kinds/dimension';
import type { SectionMark } from '../elements/section/schema';
import type { Handles } from '../session/handles';
import type { ScreenHandle } from '../session/object-handles';
import type { ElementId } from '../core/id';

/** A temporary dimension: measured from a to b, drawn beside the element on `side`, clear of it. */
export interface DimMark {
  readonly a: Point2;
  readonly b: Point2;
  readonly side: Point2;
  readonly clear: number;
  /** The value as shown, to keep other text off it. */
  readonly text?: string;
}

export interface PlanOverlay {
  readonly selected: ReadonlySet<ElementId>;
  readonly hover: ElementId | null;
  /** The space with no room under the pointer, with the room tool: the room a click makes there. */
  readonly roomSpace?: readonly Point2[] | null;
  /** Walls being drawn (ids present in the geometry), shown as a translucent preview. */
  readonly preview: ReadonlySet<ElementId>;
  /** The level's text notes, as tall as their letters at the plan's scale. */
  /** The dimension being made (the dimension tool), placed, with its value. */
  readonly dimensionDraft?: (Placed & { readonly text: string }) | null;
  /** Grid axes: dash-dot lines with their name in a bubble at each end; the one being drawn has no id. */
  /** The axis being drawn (the grid tool), with the name it will get. */
  readonly gridDraft?: { readonly name: string; readonly start: Point2; readonly end: Point2 } | null;
  /** The section being drawn with its tool. */
  readonly sectionDraft?: SectionMark | null;
  /** The callout being placed: its arrow's point, and the pointer where its text will go. */
  readonly calloutDraft?: { readonly from: Point2; readonly to: Point2 } | null;
  /** The two points of a reference being calibrated, and their distance as it is now. */
  readonly calibrateDraft?: { readonly a: Point2; readonly b: Point2; readonly text: string } | null;
  /** The guide being placed. */
  readonly guideDraft?: { readonly point: Point2; readonly dir: Point2 } | null;
  /**
   * Walls' reference lines (the line they are drawn by: centre, exterior or interior face), each with
   * an arrow at its end: the drawing direction, whose right is the exterior side. As ArchiCAD shows them.
   */
  readonly refLines?: readonly { readonly start: Point2; readonly end: Point2; readonly bulge?: number }[];
  /** A mirror's axis while it is set: a line without ends, in the snap's colour. */
  readonly axisLine?: { readonly point: Point2; readonly dir: Point2 } | null;
  /** The reference of an angle or a scale being set (Rotate, Scale), dashed from its base. */
  readonly ray?: { readonly start: Point2; readonly end: Point2 } | null;
  /** `away`: the direction the segment being drawn arrives from, so the label goes beyond its end. */
  readonly snap: { readonly point: Point2; readonly label: string | null; readonly guideFrom?: Point2; readonly away?: Point2; readonly kind?: string } | null;
  /**
   * Live measure of the segment being drawn. With `normal` (unit, world) it is set off the segment on
   * that side, `clear` metres plus a gap, so it never sits on the wall.
   */
  readonly measure: { readonly at: Point2; readonly text: string; readonly normal?: Point2; readonly clear?: number } | null;
  /** The reference line of the segment being drawn, dashed. */
  readonly axis: { readonly start: Point2; readonly end: Point2 } | null;
  /** Handles of the selection, in screen pixels (app/handles.ts). */
  readonly handles: Handles;
  /** The selected object's handles (app/object-handles.ts), and the one under the pointer. */
  readonly objectHandles?: readonly ScreenHandle[];
  readonly hotHandle?: ScreenHandle | null;
  /** The point a wall chain goes on from: marked even before the pointer moves. */
  readonly anchor?: Point2 | null;
  /** Wall numbers at the middle of the walls selected or under the pointer, as snap labels name them. */
  readonly wallTags?: readonly { readonly at: Point2; readonly text: string }[];
  /** Doors' and windows' type marks beside them (opening/marks.ts); `width` is the opening's (m). */
  readonly openingTags?: readonly { readonly at: Point2; readonly text: string; readonly width: number }[];
  /**
   * Room name and area tags, at each room's point. `short` is shown when the name does not fit the room
   * on screen, `brief` when the area line (a warning) does not; `outline` is the room's, if closed.
   */
  readonly roomLabels: readonly {
    readonly at: Point2;
    readonly name: string;
    readonly short: string;
    readonly area: string;
    readonly brief?: string;
    readonly warn: boolean;
    readonly outline: readonly Point2[];
  }[];
  /** A floor outline being drawn, ending at the cursor. */
  readonly draft: readonly Point2[] | null;
  /** Points the pointer rested on, to align with (snap.ts, acquired): a small plus each. */
  readonly acquired?: readonly Point2[];
  /** A circle guide being drawn: its centre and the radius to the pointer, dashed. */
  readonly circleDraft?: { readonly center: Point2; readonly radius: number } | null;
  /** A move's smart guides: dashed alignments, and equal gaps each with its length. */
  readonly smart?: { readonly lines: readonly { a: Point2; b: Point2 }[]; readonly gaps: readonly { a: Point2; b: Point2; text: string }[] } | null;
  /** Its corners so far, each marked: a typed first corner shows before the pointer moves. */
  readonly draftCorners?: readonly Point2[];
  /** The opening being placed (an id present in the geometry), drawn in the accent colour. */
  readonly openingPreview?: string | null;
  /** Temporary dimensions of the selected element. */
  readonly dims?: readonly DimMark[];
  /** The walls of the level below, as their pieces: drawn faint under everything, to draw on top of. */
  readonly underlay?: readonly (readonly Point2[])[];
}

/** How much of the canvas a panel covers, at its right and bottom edges, in screen pixels. */
export interface Insets {
  readonly right: number;
  readonly bottom: number;
  /** The project browser's drawer, over the left edge. */
  readonly left?: number;
}

export const NO_INSETS: Insets = { right: 0, bottom: 0 };

/**
 * Scale and centre that fit the box in the visible part of a canvas of `size`: 70% of it, the box's
 * centre at the visible part's centre (screen y grows downward, world y upward).
 */
export function fitPlan(box: { min: Point2; max: Point2 }, size: { w: number; h: number }, covered: Insets = NO_INSETS): { scale: number; center: Point2 } {
  const left = covered.left ?? 0;
  const w = Math.max(size.w - covered.right - left, size.w * 0.3);
  const h = Math.max(size.h - covered.bottom, size.h * 0.3);
  const bw = Math.max(box.max.x - box.min.x, 0.5);
  const bh = Math.max(box.max.y - box.min.y, 0.5);
  const scale = Math.min(4000, Math.max(2, Math.min((w * 0.7) / bw, (h * 0.7) / bh)));
  // The box's centre on screen goes to the visible part's centre, left + w / 2.
  const center = { x: (box.min.x + box.max.x) / 2 - (left + w / 2 - size.w / 2) / scale, y: (box.min.y + box.max.y) / 2 - (size.h - h) / 2 / scale };
  return { scale, center };
}
