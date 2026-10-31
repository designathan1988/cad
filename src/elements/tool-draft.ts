// What the active tool holds while it draws, as one state: nothing yet, the first point of a tool that
// draws from two (an axis, a section, a callout, a beam, a stair, a circular guide), or the points of a tool
// that draws an outline or a path (a floor, a roof, a guardrail, a mark). A draft of one tool cannot outlive
// it: choosing a tool starts from NO_DRAFT (session/tool-events.ts setTool), where loose fields were each reset by hand.

import type { Point2 } from '../model/vector';
import type { FloorId } from './room/schema';

/** The tools that draw from a first point to a second. */
export type FromTool = 'grid' | 'section' | 'callout' | 'beam' | 'stair' | 'guide';
/** The tools that draw by a list of points. */
export type PointsTool = 'floor' | 'roof' | 'railing' | 'mark';

export type Draft =
  | { readonly kind: 'none' }
  | { readonly kind: 'from'; readonly tool: FromTool; readonly at: Point2 }
  | { readonly kind: 'points'; readonly tool: Exclude<PointsTool, 'floor'>; readonly points: readonly Point2[] }
  /** The floor tool: its outline, the floor a hole is drawn in, or a ceiling drawn instead of a floor. */
  | { readonly kind: 'points'; readonly tool: 'floor'; readonly points: readonly Point2[]; readonly hole: FloorId | null; readonly ceiling: boolean };

export const NO_DRAFT: Draft = { kind: 'none' };

/** The first point of `tool`, when it is the one drawing and has one. */
export const fromOf = (d: Draft, tool: FromTool): Point2 | null => (d.kind === 'from' && d.tool === tool ? d.at : null);

/** The points `tool` has drawn so far (none when it is not the one drawing). */
export const pointsOf = (d: Draft, tool: PointsTool): Point2[] => (d.kind === 'points' && d.tool === tool ? [...d.points] : []);

/** `tool` drawing from `at`; nothing when there is no point. */
export const drawFrom = (tool: FromTool, at: Point2 | null): Draft => (at ? { kind: 'from', tool, at } : NO_DRAFT);

const floorOf = (d: Draft) => (d.kind === 'points' && d.tool === 'floor' ? d : null);

/** The floor a hole is being drawn in. */
export const holeOf = (d: Draft): FloorId | null => floorOf(d)?.hole ?? null;
/** Whether the floor tool is drawing a ceiling. */
export const ceilingOf = (d: Draft): boolean => floorOf(d)?.ceiling ?? false;

/** The floor tool's draft changed in part, the rest kept. */
export function withFloor(d: Draft, patch: { readonly points?: readonly Point2[]; readonly hole?: FloorId | null; readonly ceiling?: boolean }): Draft {
  const f = floorOf(d);
  return { kind: 'points', tool: 'floor', points: patch.points ?? f?.points ?? [], hole: patch.hole !== undefined ? patch.hole : (f?.hole ?? null), ceiling: patch.ceiling ?? f?.ceiling ?? false };
}

/** `tool`'s points now (the floor's other choices kept). */
export const drawPoints = (d: Draft, tool: PointsTool, points: readonly Point2[]): Draft =>
  tool === 'floor' ? withFloor(d, { points }) : { kind: 'points', tool, points };
