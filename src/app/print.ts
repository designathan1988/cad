// A level's plan printed at a scale (phase 9; docs/plano-de-escopo.md: "a mesma planta impressa em
// 1:50 e 1:100 muda espessuras, textos e detalhe sozinha"). The plan view draws it for paper
// (render/plan-view.ts, printing): in pen units turned into millimetres, so the pens keep their width
// on paper (heavier at 1:50 than at 1:100: drawing/schema.ts, scaleFactor), texts their height, and the
// scale its detail (layers and hatches at 1:50, outlines at 1:100, no furniture at 1:200). The
// paper's colours are the light theme's on white; no grid, no guides, nothing selected. A title and a
// scale bar along the bottom. As a PDF of one page (io/pdf.ts).

import { roomTagText } from './room-tag';
import { overrideColours, roomOverrideColours } from './layer-sets';
import { drawingOf, type Doc } from './document';
import { boundsOf, deriveGeometry, type DerivedGeometry, hideCategories } from './geometry';
import type { App } from './app';
import { filterKinds, levelOfSolid } from '../elements/registry';
import { PAPERS, PEN_UNIT_MM, scaleFactor } from '../elements/drawing/schema';
import { markPoint, openingMarks } from '../elements/opening/marks';
import { insideRing } from '../elements/room/derive';
import { PlanView } from '../render/plan-view';
import { pdfOfCanvas } from '../io/pdf';
import type { Point2 } from '../core/vector';
import { markPrefix, name, t } from '../ui/i18n';

export interface PrintSetup {
  readonly levelId: string;
  /** 1 : den. */
  readonly den: number;
  readonly paper: string;
  readonly landscape: boolean;
}

/** The margin all round, and the strip along the bottom for the title and the scale bar (mm). */
const MARGIN_MM = 10;
const TITLE_MM = 12;

/** The paper's size (mm), as it is turned. */
export function paperSize(s: Pick<PrintSetup, 'paper' | 'landscape'>): { w: number; h: number } {
  const [a, b] = PAPERS[s.paper] ?? PAPERS.A3!;
  return s.landscape ? { w: a, h: b } : { w: b, h: a };
}

/** A level's plan as derived, its walls, openings, rooms and the rest on it; guides left out (they are not drawn on paper). */
export function levelPlan(doc: Doc, levelId: string, hidden: ReadonlySet<string>): DerivedGeometry {
  const g = hideCategories(deriveGeometry(doc), new Set([...hidden, 'guides']) as Parameters<typeof hideCategories>[1]);
  const solids = new Map([...g.solids].filter(([, s]) => s.wall.levelId === levelId));
  const walls = new Set(doc.walls.filter((w) => w.levelId === levelId).map((w) => w.id));
  const openings = new Map([...g.openings].filter(([, o]) => walls.has(o.opening.wallId)));
  const rooms = new Map([...g.rooms].filter(([, r]) => r.room.levelId === levelId));
  const kinds = filterKinds(g.kinds, (k, x) => {
    const l = levelOfSolid(k, x);
    return l === null || l === levelId;
  });
  return { ...g, solids, openings, rooms, kinds };
}

/** How much of the plan the paper holds at the scale (m), and how much the plan needs. */
export function fitOf(g: DerivedGeometry, s: PrintSetup): { readonly fits: boolean; readonly need: { w: number; h: number }; readonly room: { w: number; h: number } } {
  const box = boundsOf(g);
  const paper = paperSize(s);
  const room = { w: ((paper.w - 2 * MARGIN_MM) * s.den) / 1000, h: ((paper.h - 2 * MARGIN_MM - TITLE_MM) * s.den) / 1000 };
  const need = box ? { w: box.max.x - box.min.x, h: box.max.y - box.min.y } : { w: 0, h: 0 };
  return { fits: need.w <= room.w + 1e-9 && need.h <= room.h + 1e-9, need, room };
}

/** A plan's frame: a level at 1:den, `wMm` × `hMm` on paper, the model point `center` (m) at its middle. */
export interface PlanFrame {
  readonly levelId: string;
  readonly den: number;
  readonly wMm: number;
  readonly hMm: number;
  readonly center: Point2;
}

/**
 * Paper's colours: the light theme's, read while it is set (the screen is not painted meanwhile), with
 * the canvas white. `paint` gets them, and the computed style for the fonts.
 */
export function withPaperColours<T>(paint: (color: (name: string) => string, css: CSSStyleDeclaration) => T): T {
  const root = document.documentElement;
  const theme = root.dataset.theme;
  root.dataset.theme = 'light';
  try {
    const css = getComputedStyle(root);
    const white: Record<string, string> = { '--canvas': '#ffffff', '--underlay': '#ffffff', '--bg': '#ffffff' };
    return paint((n) => white[n] ?? css.getPropertyValue(n).trim(), css);
  } finally {
    if (theme === undefined) delete root.dataset.theme;
    else root.dataset.theme = theme;
  }
}

/** The middle of a level's plan (m): of its bounds, or the origin when it has nothing. */
export function planMiddle(app: App, levelId: string): Point2 {
  const box = boundsOf(levelPlan(app.store.get(), levelId, app.ui.hidden));
  return box ? { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 } : { x: 0, y: 0 };
}

/**
 * A level's plan on a canvas the frame's size at `dpi`, drawn for paper (render/plan-view.ts,
 * printing): the pens and texts in millimetres for the scale, the detail the scale's. Also a sheet's
 * plan views (app/sheets.ts): drawn from the model each time, so they follow it.
 */
export function planCanvas(app: App, f: PlanFrame, dpi: number): { readonly canvas: HTMLCanvasElement; readonly view: PlanView } {
  const doc = app.store.get();
  const g = levelPlan(doc, f.levelId, app.ui.hidden);
  // One pen unit on paper (mm): 0.12 mm at 1:100, heavier at a larger scale.
  const unitMm = PEN_UNIT_MM * scaleFactor(f.den);
  const canvas = document.createElement('canvas');
  const view = new PlanView(canvas);
  const w = f.wMm / unitMm;
  const h = f.hMm / unitMm;
  // Units a metre: a metre is 1000/den mm on paper.
  view.scale = 1000 / f.den / unitMm;
  view.center = f.center;
  view.drawing = drawingOf(doc);
  view.overrides = app.ui.overridesOn ? overrideColours(doc) : new Map();
  view.roomOverrides = app.ui.overridesOn ? roomOverrideColours(doc) : new Map();
  withPaperColours((color) => {
    view.printing = { w, h, ratio: (unitMm * dpi) / 25.4, den: f.den, color };
    const marks = openingMarks(doc.openings, markPrefix());
    const rooms = [...g.rooms.values()];
    const inRoom = (p: { x: number; y: number }) => rooms.some((r) => r.enclosed && insideRing(r.outline, p));
    view.draw(g, {
      selected: new Set(),
      hover: null,
      preview: new Set(),
      snap: null,
      measure: null,
      axis: null,
      handles: { squares: [], arrows: [], rotate: null, bulge: null, flips: [] },
      draft: null,
      roomLabels: rooms.map((r) => ({ at: r.label, ...roomTagText(r.room, r.area, doc.levels.find((l) => l.id === r.room.levelId)?.height ?? 0, drawingOf(doc).roomTag), warn: false, outline: r.outline })),
      openingTags: app.ui.openingTags ? [...g.openings.values()].flatMap((o) => (o.frame ? [{ at: markPoint(o.frame, o.opening, 0.25, inRoom), text: marks.get(o.opening.id) ?? '', width: o.opening.width }] : [])) : [],
    });
  });
  return { canvas, view };
}

/**
 * The plan on a canvas the paper's size at `dpi`: its middle at the middle of the drawing area, the
 * title (project, level, scale) and a scale bar under it.
 */
export function printCanvas(app: App, s: PrintSetup, dpi: number): HTMLCanvasElement {
  const doc = app.store.get();
  const paper = paperSize(s);
  const mid = planMiddle(app, s.levelId);
  // The drawing area's middle is above the paper's by half the title strip.
  const { canvas, view } = planCanvas(app, { levelId: s.levelId, den: s.den, wMm: paper.w, hMm: paper.h, center: { x: mid.x, y: mid.y - TITLE_MM / 2 / (1000 / s.den) } }, dpi);
  const unitMm = PEN_UNIT_MM * scaleFactor(s.den);
  withPaperColours((_c, css) => titleStrip(view, canvas, doc, s, paper.w / unitMm, paper.h / unitMm, css));
  return canvas;
}

/** Along the bottom: a scale bar (0 to a round length) on the left, the title on the right. */
function titleStrip(view: PlanView, canvas: HTMLCanvasElement, doc: Doc, s: PrintSetup, w: number, h: number, css: CSSStyleDeclaration): void {
  const ctx = canvas.getContext('2d')!;
  const unitMm = PEN_UNIT_MM * scaleFactor(s.den);
  const mm = (v: number) => v / unitMm;
  const ink = css.getPropertyValue('--text').trim() || '#000000';
  const family = css.getPropertyValue('--font').trim() || 'sans-serif';
  const base = h - mm(MARGIN_MM);
  // Clear the strip, in case the plan ran into it.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, h - mm(MARGIN_MM + TITLE_MM), w, mm(MARGIN_MM + TITLE_MM));
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = view.pen('annotation');
  ctx.beginPath();
  ctx.moveTo(mm(MARGIN_MM), h - mm(MARGIN_MM + TITLE_MM));
  ctx.lineTo(w - mm(MARGIN_MM), h - mm(MARGIN_MM + TITLE_MM));
  ctx.stroke();
  // The bar: about 50 mm on paper, in whole metres (or tenths at a large scale), in four parts.
  const metres = [0.5, 1, 2, 5, 10, 20, 25, 50].find((m) => (m * 1000) / s.den >= 40) ?? 50;
  const len = mm((metres * 1000) / s.den);
  const x0 = mm(MARGIN_MM);
  const y0 = base - mm(4);
  for (let k = 0; k < 4; k++) {
    const x = x0 + (len * k) / 4;
    if (k % 2 === 0) ctx.fillRect(x, y0 - mm(1.2), len / 4, mm(1.2));
    ctx.strokeRect(x, y0 - mm(1.2), len / 4, mm(1.2));
  }
  ctx.font = `400 ${mm(2)}px ${family}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText('0', x0, y0 + mm(0.8));
  ctx.fillText(`${String(metres).replace('.', ',')} m`, x0 + len, y0 + mm(0.8));
  // The title: project, level, scale.
  const level = doc.levels.find((l) => l.id === s.levelId);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${mm(3.5)}px ${family}`;
  ctx.fillText(`${doc.name || t('app.untitled')} · ${level ? name(level.name) : ''}`, w - mm(MARGIN_MM), base - mm(5));
  ctx.font = `400 ${mm(2.5)}px ${family}`;
  ctx.fillText(t('print.scale', { den: s.den }), w - mm(MARGIN_MM), base - mm(0.5));
}

/** The plan printed as a PDF, downloaded: 300 dpi on A4 and A3, 200 on A2, 150 on A1 and A0. */
export async function downloadPlanPdf(app: App, s: PrintSetup): Promise<void> {
  const dpi = s.paper === 'A4' || s.paper === 'A3' ? 300 : s.paper === 'A2' ? 200 : 150;
  const canvas = printCanvas(app, s, dpi);
  const paper = paperSize(s);
  const level = app.store.get().levels.find((l) => l.id === s.levelId);
  const title = `${app.store.get().name || t('app.untitled')} · ${level ? name(level.name) : ''} · 1:${s.den}`;
  const pdf = await pdfOfCanvas(canvas, paper.w, paper.h, title);
  app.download(`${app.fileBase()}-${level ? name(level.name) : 'planta'}-1-${s.den}.pdf`, pdf, 'application/pdf');
}
