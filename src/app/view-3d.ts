// How the 3D view shows the levels, as in Revit's 3D views and ArchiCAD's 3D window filters: all of
// them, the one being edited and those below it, or that one only; spread apart (exploded) so each
// one's rooms are seen from above; cut at the edited level's cut height (the plan's), a plan in 3D;
// seen through (x-ray, as Revit's and SketchUp's), the walls and floors faint and every line on top.
// Interface state, kept with the preferences: outside the document and its undo, as the camera is.

import { cutHeightOf, type Level } from './document';
import { readBox, readSection, type SectionBox, type SectionLine } from './section-box';

export type LevelsShown = 'all' | 'below' | 'current';

/** How the 3D view draws (Revit's visual styles): white faces and their lines; shaded by the light; each
 * material's own colour, unlit; realistic (tone mapping, the sky's reflections, shadows, ambient occlusion). */
export const VISUAL_STYLES = ['hidden', 'shaded', 'consistent', 'realistic', 'photo'] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];
/** How finely: the resolution, the shadows' map, ambient occlusion and supersampling (render/scene-3d.ts). */
export const RENDER_QUALITIES = ['low', 'medium', 'high', 'ultra'] as const;
export type RenderQuality = (typeof RENDER_QUALITIES)[number];

export interface View3D {
  readonly levels: LevelsShown;
  readonly explode: boolean;
  readonly cut: boolean;
  readonly xray: boolean;
  /** The section box: only what is inside it shows; null when off (section-box.ts). */
  readonly box: SectionBox | null;
  /** Parallel (orthographic) instead of in perspective: elevations and sections. */
  readonly ortho: boolean;
  /** A vertical section through a line in plan (section-box.ts); null when none. */
  readonly section: SectionLine | null;
  readonly style: VisualStyle;
  readonly quality: RenderQuality;
  /** How bright the whole view is, and how strong the sun is against the sky (1: as drawn; LIGHT_RANGE). */
  readonly brightness: number;
  readonly sun: number;
}

/** The brightness's and the sun's range. */
export const LIGHT_RANGE = { min: 0.25, max: 3 } as const;

export const VIEW_3D_DEFAULT: View3D = { levels: 'all', explode: false, cut: false, xray: false, box: null, ortho: false, section: null, style: 'shaded', quality: 'medium', brightness: 1, sun: 1 };

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

/** A brightness or a sun's strength as stored: within LIGHT_RANGE, else 1. */
const lightOf = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= LIGHT_RANGE.min && v <= LIGHT_RANGE.max ? v : 1);

/** A stored view, or the default for what is missing or not one of the choices. */
export function readView3D(raw: unknown): View3D {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    levels: o.levels === 'below' || o.levels === 'current' ? o.levels : 'all',
    explode: o.explode === true,
    cut: o.cut === true,
    xray: o.xray === true,
    box: readBox(o.box),
    ortho: o.ortho === true,
    section: readSection(o.section),
    style: (VISUAL_STYLES as readonly unknown[]).includes(o.style) ? (o.style as VisualStyle) : 'shaded',
    quality: (RENDER_QUALITIES as readonly unknown[]).includes(o.quality) ? (o.quality as RenderQuality) : 'medium',
    brightness: lightOf(o.brightness),
    sun: lightOf(o.sun),
  };
}
