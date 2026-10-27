// Sheets (pranchas; docs/plano-de-escopo.md, phase 10): a paper with a title block (carimbo) and views
// placed on it, each a level's plan at a scale framed round a point of the model, or a schedule. A sheet
// keeps no drawing of its own: it is drawn from the model each time (app/sheets.ts), so moving a wall
// changes every sheet that shows it, its dimensions and its schedules.

import type { Point2 } from '../../core/vector';
import { PAPERS, SCALES } from '../drawing/schema';

export const SHEET_PREFIX = 'sheet';

/** A level's plan on the sheet: its frame's middle and size on paper (mm), the model point there, the scale. */
export interface PlanViewport {
  readonly id: string;
  readonly kind: 'plan';
  readonly levelId: string;
  /** 1 : den. */
  readonly den: number;
  /** The frame's middle on the sheet, from its top left corner (mm), and its size (mm). */
  readonly at: Point2;
  readonly w: number;
  readonly h: number;
  /** The model point at the frame's middle (m). */
  readonly center: Point2;
}

/** A section or an elevation (elements/section) at a scale: its frame as a plan's, the drawing's point
 * at its middle (m along the mark's line, m up). */
export interface SectionViewport {
  readonly id: string;
  readonly kind: 'section';
  readonly sectionId: string;
  readonly den: number;
  readonly at: Point2;
  readonly w: number;
  readonly h: number;
  readonly center: Point2;
}

/** The schedules a sheet can show: the model's (app/schedules.ts) and the list of the sheets. */
export const SHEET_SCHEDULES = ['rooms', 'doors', 'windows', 'walls', 'sheets'] as const;
export type SheetSchedule = (typeof SHEET_SCHEDULES)[number];

/** A schedule on the sheet (app/schedules.ts): which, and where its top left corner is (mm). */
export interface ScheduleViewport {
  readonly id: string;
  readonly kind: 'schedule';
  readonly schedule: SheetSchedule;
  readonly at: Point2;
  /** Its width on paper (mm); its height is its rows'. */
  readonly w: number;
}

export type Viewport = PlanViewport | SectionViewport | ScheduleViewport;
export type FramedViewport = PlanViewport | SectionViewport;

export interface Sheet {
  readonly id: string;
  /** Its number (A-01) and name (Planta do térreo), in the title block. */
  readonly number: string;
  readonly name: string;
  readonly paper: string;
  readonly landscape: boolean;
  readonly viewports: readonly Viewport[];
}

/** The margin round the sheet's border and the title block's size (mm). */
export const SHEET_MARGIN = 10;
export const TITLE_W = 180;
export const TITLE_H = 36;

export const sheetSize = (s: Pick<Sheet, 'paper' | 'landscape'>): { w: number; h: number } => {
  const [a, b] = PAPERS[s.paper] ?? PAPERS.A3!;
  return s.landscape ? { w: a, h: b } : { w: b, h: a };
};

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (p: unknown): p is Point2 => typeof p === 'object' && p !== null && finite((p as Point2).x) && finite((p as Point2).y);

export const isViewport = (v: unknown): v is Viewport => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !isPoint(o.at) || !finite(o.w) || (o.w as number) <= 0) return false;
  if (o.kind === 'plan') return typeof o.levelId === 'string' && SCALES.includes(o.den as number) && finite(o.h) && (o.h as number) > 0 && isPoint(o.center);
  if (o.kind === 'section') return typeof o.sectionId === 'string' && SCALES.includes(o.den as number) && finite(o.h) && (o.h as number) > 0 && isPoint(o.center);
  if (o.kind === 'schedule') return (SHEET_SCHEDULES as readonly unknown[]).includes(o.schedule);
  return false;
};

export const isSheet = (s: unknown): s is Sheet => {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.number === 'string' &&
    typeof o.name === 'string' &&
    typeof o.paper === 'string' &&
    o.paper in PAPERS &&
    typeof o.landscape === 'boolean' &&
    Array.isArray(o.viewports) &&
    o.viewports.every(isViewport)
  );
};

/** The frame's corners on the sheet (mm): left, top, right, bottom; a schedule's from its top left, `h` its height. */
export const frameOf = (v: Viewport, h = 0): { x0: number; y0: number; x1: number; y1: number } =>
  v.kind === 'schedule' ? { x0: v.at.x, y0: v.at.y, x1: v.at.x + v.w, y1: v.at.y + h } : { x0: v.at.x - v.w / 2, y0: v.at.y - v.h / 2, x1: v.at.x + v.w / 2, y1: v.at.y + v.h / 2 };

/** The drawing area: the paper inside its border, the title block's strip along the bottom left out (mm). */
export const drawingArea = (s: Pick<Sheet, 'paper' | 'landscape'>): { x0: number; y0: number; x1: number; y1: number } => {
  const { w, h } = sheetSize(s);
  return { x0: SHEET_MARGIN + 5, y0: SHEET_MARGIN + 5, x1: w - SHEET_MARGIN - 5, y1: h - SHEET_MARGIN - TITLE_H - 5 };
};

/** The next sheet number: A-01, A-02… after the highest of that form. */
export function nextSheetNumber(sheets: readonly Sheet[]): string {
  const n = Math.max(0, ...sheets.map((s) => /^A-(\d+)$/.exec(s.number)?.[1]).filter((x): x is string => x !== undefined).map(Number));
  return `A-${String(n + 1).padStart(2, '0')}`;
}
