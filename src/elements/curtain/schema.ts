// Curtain walls (docs/plano-de-escopo.md, "Parede-cortina"; Revit's Curtain Wall): drawn by a line on a
// level, from its floor (plus an offset) up its height; a grid of vertical and horizontal lines, each
// set by a fixed distance, a fixed number or a largest spacing; a mullion on every line and round the
// edge; a panel in each cell, glass or opaque. Its frame and panels are built in geometry.ts. Pure.

import type { Point2 } from '../../core/vector';

export const CURTAIN_PREFIX = 'curtain';

/** How a direction is divided: every `value` metres from the start (the rest at the end), in `value`
 * equal parts, or in as few equal parts as keep each under `value` metres. */
export interface GridRule {
  readonly mode: 'spacing' | 'count' | 'max';
  readonly value: number;
}

export interface Curtain {
  readonly id: string;
  readonly levelId: string;
  readonly start: Point2;
  readonly end: Point2;
  /** Its foot above (+) or below (−) its level's floor (m). */
  readonly baseOffset: number;
  /** How tall (m); its level's height when not set. */
  readonly height?: number;
  /** The vertical lines along it, and the horizontal ones up it. */
  readonly vertical: GridRule;
  readonly horizontal: GridRule;
  /** A mullion's width along the face, and its depth across it (m). */
  readonly mullion: number;
  readonly depth: number;
  readonly panel: 'glass' | 'opaque';
}

/** A new curtain wall's grid and frame: panels up to 1.50 m wide, a transom at a door's height of 2.80. */
export const CURTAIN_DEFAULTS = {
  baseOffset: 0,
  vertical: { mode: 'max', value: 1.5 },
  horizontal: { mode: 'count', value: 2 },
  mullion: 0.05,
  depth: 0.15,
  panel: 'glass',
} as const satisfies Omit<Curtain, 'id' | 'levelId' | 'start' | 'end'>;

export const isCurtainId = (id: string): boolean => id.startsWith(`${CURTAIN_PREFIX}_`);

export const isGridRule = (r: unknown): r is GridRule => {
  if (typeof r !== 'object' || r === null) return false;
  const x = r as Record<string, unknown>;
  return (x.mode === 'spacing' || x.mode === 'count' || x.mode === 'max') && typeof x.value === 'number' && Number.isFinite(x.value) && x.value > 0;
};

/** The narrowest panel (m), as the spacing field's minimum: a count or spacing finer than this (typed,
 * or read from a file) built a box per cell by the million and froze the page. */
export const CURTAIN_MIN_CELL = 0.1;

/** The most panels `total` metres take: none narrower than CURTAIN_MIN_CELL, and at least one. */
export const panelsThatFit = (total: number): number => Math.max(1, Math.floor(total / CURTAIN_MIN_CELL + 1e-9));

/** Where a rule's lines are along `total` metres: from 0 to `total`, both ends included. */
export function gridLines(rule: GridRule, total: number): number[] {
  if (!(total > 0)) return [0];
  if (rule.mode === 'spacing') {
    const step = Math.max(rule.value, CURTAIN_MIN_CELL);
    const out = [0];
    // A last piece under 1 cm is no panel: the line before it goes.
    for (let x = step; x < total - 0.01; x += step) out.push(x);
    out.push(total);
    return out;
  }
  const wanted = rule.mode === 'count' ? Math.max(1, Math.round(rule.value)) : Math.max(1, Math.ceil(total / Math.max(rule.value, CURTAIN_MIN_CELL) - 1e-9));
  const n = Math.min(wanted, panelsThatFit(total));
  return Array.from({ length: n + 1 }, (_, i) => (total * i) / n);
}
