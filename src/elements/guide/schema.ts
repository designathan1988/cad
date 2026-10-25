// Guides: construction lines on a level's plan, as SketchUp's guides and Revit's reference planes.
// Nothing is built from them: drawing snaps onto them and onto where they cross, so a wall can be
// drawn at a set distance from another (a corridor 1.20 m clear). They are part of the project (saved,
// undone like the rest) until deleted.

import type { Point2 } from '../../core/vector';

export const GUIDE_PREFIX = 'guide';

export interface Guide {
  readonly id: string;
  readonly levelId: string;
  /** A point of the line and its unit direction: the line has no ends. */
  readonly point: Point2;
  readonly dir: Point2;
}

export const isGuideId = (id: string): boolean => id.startsWith(`${GUIDE_PREFIX}_`);
