// Drawing scale and pens (docs/plano-de-escopo.md, phase 9): the plan's scale (1:20 to 1:500) and the
// project's pen set, the width on paper of each kind of line. A pen is set at 1:100 and drawn heavier
// at a larger scale and lighter at a smaller one (scaleFactor), as offices draw; texts keep their size
// on paper; the scale sets how much detail the plan shows (detailOf): a wall's layers and hatches at
// 1:50 and larger, its outline filled at 1:100, furniture left out at 1:200 and smaller.
//
// On screen a pen unit is a pixel (1 px ≙ PEN_UNIT_MM on paper at 1:100: the plan looks as it did); on
// paper (app/print.ts) the plan is drawn in the same units, scaled to millimetres, so every line,
// hatch and mark keeps its weight on paper whatever the scale.

export type PenRole = 'cut' | 'seen' | 'fine' | 'annotation';
export const PEN_ROLES: readonly PenRole[] = ['cut', 'seen', 'fine', 'annotation'];

export interface DrawingSettings {
  /** The plan's scale: 1 : scale. */
  readonly scale: number;
  /** Each pen's width on paper at 1:100 (mm). */
  readonly pens: Readonly<Record<PenRole, number>>;
}

/** The scales offered, 1:20 to 1:500. */
export const SCALES: readonly number[] = [20, 25, 50, 75, 100, 200, 250, 500];

/** A pen unit on paper at 1:100 (mm): a pixel of the screen's plan. */
export const PEN_UNIT_MM = 0.12;

/** Cut walls 0.36 mm, what is seen 0.24, layers and furniture 0.12, dimensions and texts' lines 0.13. */
export const DEFAULT_DRAWING: DrawingSettings = { scale: 50, pens: { cut: 0.36, seen: 0.24, fine: 0.12, annotation: 0.13 } };

/** A pen's least and greatest width (mm). */
export const PEN_MIN = 0.05;
export const PEN_MAX = 2;

/** How much heavier (> 1) or lighter (< 1) the pens are drawn at 1 : den than at 1:100. */
export function scaleFactor(den: number): number {
  if (den <= 25) return 1.4;
  if (den <= 50) return 1.2;
  if (den <= 75) return 1.1;
  if (den <= 100) return 1;
  if (den <= 250) return 0.8;
  return 0.7;
}

export type Detail = 'fine' | 'medium' | 'coarse';

/** Layers and hatches at 1:50 and larger; outlines at 1:100; less still (no furniture) at 1:200 and smaller. */
export function detailOf(den: number): Detail {
  return den <= 50 ? 'fine' : den <= 100 ? 'medium' : 'coarse';
}

/** The interface's text sizes on paper (mm): small labels, tags, names, titles. */
export const TEXT_MM: Readonly<Record<string, number>> = { '--fs-xs': 1.8, '--fs-sm': 2.0, '--fs-md': 2.5, '--fs-lg': 3.0 };

/** Paper sizes, landscape (mm). */
export const PAPERS: Readonly<Record<string, readonly [number, number]>> = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isDrawingSettings = (d: unknown): d is DrawingSettings => {
  if (typeof d !== 'object' || d === null) return false;
  const x = d as Record<string, unknown>;
  const pens = x.pens as Record<string, unknown> | undefined;
  return SCALES.includes(x.scale as number) && typeof pens === 'object' && pens !== null && PEN_ROLES.every((r) => finite(pens[r]) && pens[r] >= PEN_MIN && pens[r] <= PEN_MAX);
};
