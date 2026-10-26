// How the 3D view shows the levels, as in Revit's 3D views and ArchiCAD's 3D window filters: all of
// them, the one being edited and those below it, or that one only; spread apart (exploded) so each
// one's rooms are seen from above; cut at the edited level's cut height (the plan's), a plan in 3D.
// Interface state, kept with the preferences: outside the document and its undo, as the camera is.

import { cutHeightOf, type Level } from './document';

export type LevelsShown = 'all' | 'below' | 'current';

export interface View3D {
  readonly levels: LevelsShown;
  readonly explode: boolean;
  readonly cut: boolean;
}

export const VIEW_3D_DEFAULT: View3D = { levels: 'all', explode: false, cut: false };

/** Between two exploded levels, beyond their own height (m). */
export const EXPLODE_GAP = 2.5;

const byElevation = (levels: readonly Level[]) => [...levels].sort((a, b) => a.elevation - b.elevation);

/** The ids of the levels shown: all; the current one and those below it (by elevation); the current one. */
export function shownLevels(levels: readonly Level[], current: string, mode: LevelsShown): Set<string> {
  const here = levels.find((l) => l.id === current);
  if (mode === 'all' || !here) return new Set(levels.map((l) => l.id));
  if (mode === 'current') return new Set([here.id]);
  return new Set(levels.filter((l) => l.elevation <= here.elevation).map((l) => l.id));
}

/**
 * Whether the levels are drawn spread apart: asked to, with two or more of them shown. One level alone
 * has nothing to spread from: it only rose off the ground, and the pressed button seemed to do nothing.
 */
export const exploding = (levels: readonly Level[], current: string, view: View3D): boolean =>
  view.explode && shownLevels(levels, current, view.levels).size > 1;

/** How far up a level is drawn: exploded, the gap once for each level below it; else not at all. */
export function liftOf(levels: readonly Level[], id: string, explode: boolean): number {
  if (!explode) return 0;
  const k = byElevation(levels).findIndex((l) => l.id === id);
  return Math.max(0, k) * EXPLODE_GAP;
}

/** The height everything above is cut away at, as drawn (its lift included); null when not cutting. */
export function cutAt(levels: readonly Level[], current: string, view: View3D): number | null {
  const here = levels.find((l) => l.id === current);
  if (!view.cut || !here) return null;
  return here.elevation + cutHeightOf(here) + liftOf(levels, here.id, exploding(levels, current, view));
}

/** A stored view, or the default for what is missing or not one of the choices. */
export function readView3D(raw: unknown): View3D {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    levels: o.levels === 'below' || o.levels === 'current' ? o.levels : 'all',
    explode: o.explode === true,
    cut: o.cut === true,
  };
}
