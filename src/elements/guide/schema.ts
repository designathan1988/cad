// Guides: construction lines on a level's plan, as SketchUp's guides and Revit's reference planes.
// Nothing is built from them: drawing snaps onto them and onto where they cross, so a wall can be
// drawn at a set distance from another (a corridor 1.20 m clear). They are part of the project (saved,
// undone like the rest) until deleted. Besides lines (by a wall's face, by two points, so by an angle
// too), a guide can be a point or a circle (phase 9): drawing snaps to the point, and to the circle,
// its centre and where it crosses the lines.

import type { Point2 } from '../../model/vector';

export const GUIDE_PREFIX = 'guide';

export interface Guide {
  readonly id: string;
  readonly levelId: string;
  /** A point of the line and its unit direction: the line has no ends. A point guide's or a circle's centre. */
  readonly point: Point2;
  readonly dir: Point2;
  /** A point or a circle (its `radius`, m) rather than a line. */
  readonly shape?: 'point' | 'circle';
  readonly radius?: number;
}

/** A line guide (not a point nor a circle): what walls are set off from and sections are cut along. */
export const isLineGuide = (g: Guide): boolean => g.shape === undefined;

export const isGuideId = (id: string): boolean => id.startsWith(`${GUIDE_PREFIX}_`);
