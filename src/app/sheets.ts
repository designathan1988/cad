// Sheets drawn (phase 10; elements/sheet): the paper, its border and its title block (carimbo: the
// project, the sheet's name and number, its scales, the date, its place in the set), and each view on
// it drawn from the model as it is now: a level's plan at its scale (print.ts: planCanvas), a section
// or an elevation (section-drawing.ts), a schedule as a table. Nothing of a sheet's drawing is kept, so
// moving a wall changes every sheet that shows it, its dimensions and its schedules. As a PDF of one
// page each (io/pdf.ts).

import type { App } from './app';
import type { Doc } from './document';
import { boundsOf, type DerivedGeometry, deriveGeometry } from './geometry';
import { levelPlan, planCanvas, planMiddle, planOnPdf, withPaperColours } from './print';
import { schedule, type ScheduleKind } from './schedules';
import { modelSolids, paintSection, sectionDrawing, type SectionDrawing, type Solid3 } from './section-drawing';
import { drawingOf } from './document';
import { lotOf } from './lot';
import { logoImage, logoReady } from './logo-image';
import { SCALES, scaleFactor } from '../elements/drawing/schema';
import type { SectionMark } from '../elements/section/schema';
import { sheetsOf } from '../elements/sheet/commands';
import { detailRefs, drawingArea, type FramedViewport, frameOf, type PlanViewport, type ScheduleViewport, type SectionViewport, type Sheet, SHEET_MARGIN, sheetSize, TITLE_H, TITLE_W, type Viewport } from '../elements/sheet/schema';
import { PdfCanvas, pdfOfVectorPages } from '../io/pdf-canvas';
import { getLang, type MessageKey, name, num, t } from '../ui/i18n';
import { scheduleNaming, shownCell } from '../ui/schedules-dialog';
import { lengthUnit } from '../ui/units';
import type { Point2 } from '../core/vector';

/** Texts on a sheet (mm): small labels, cells, view titles, the project's name, the sheet's number. */
const TEXT = { label: 1.8, cell: 2, title: 3, project: 4, number: 8 } as const;

/** The model's solids as triangles and its rooms shown, once a document (a section drawn again is drawn from them). */
type Model = { readonly solids: Solid3[]; readonly rooms: DerivedGeometry['rooms'] };
const modelCache = new WeakMap<Doc, Model>();
const drawingCache = new WeakMap<Model, Map<string, SectionDrawing>>();

/** A section's or an elevation's drawing as the model is now. */
export function sectionOf(app: App, m: SectionMark): SectionDrawing {
  const doc = app.store.get();
  let model = modelCache.get(doc);
  if (!model) {
    const g = deriveGeometry(doc);
    modelCache.set(doc, (model = { solids: modelSolids(doc, g, app.ui.hidden), rooms: app.ui.hidden.has('rooms') ? new Map() : g.rooms }));
  }
  let drawings = drawingCache.get(model);
  if (!drawings) drawingCache.set(model, (drawings = new Map()));
  const key = JSON.stringify(m);
  let d = drawings.get(key);
  if (!d) drawings.set(key, (d = sectionDrawing(doc, model.solids, m, model.rooms)));
  return d;
}

/** A level's height as a level mark says it: "Térreo +0,00". */
export const levelText = (n: string, z: number) => `${name(n)} ${z >= 0 ? '+' : '−'}${num(Math.abs(z), 2)}`;

/** A section or an elevation on a canvas its frame's size at `dpi`. */
export function sectionCanvas(app: App, m: SectionMark, f: { den: number; wMm: number; hMm: number; center: Point2 }, dpi: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const k = dpi / 25.4;
  canvas.width = Math.max(1, Math.round(f.wMm * k));
  canvas.height = Math.max(1, Math.round(f.hMm * k));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  paintSectionView(app, m, f, ctx, k);
  return canvas;
}

/** A section or an elevation drawn on `ctx` in its frame (its top left the origin, a unit a millimetre), `k` device pixels a millimetre. */
function paintSectionView(app: App, m: SectionMark, f: { den: number; wMm: number; hMm: number; center: Point2 }, ctx: CanvasRenderingContext2D, k: number): void {
  const d = sectionOf(app, m);
  const pens = drawingOf(app.store.get()).pens;
  const sf = scaleFactor(f.den);
  const per = 1000 / f.den;
  withPaperColours((color, css) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, f.wMm, f.hMm);
    paintSection(ctx, d, {
      toPaper: (p) => ({ x: (p.x - f.center.x) * per + f.wMm / 2, y: f.hMm / 2 - (p.y - f.center.y) * per }),
      cutPen: pens.cut * sf,
      seenPen: pens.seen * sf * 0.6,
      finePen: pens.fine * sf,
      ink: color('--text') || '#000000',
      cutFill: color('--wall-fill') || '#9a9a9a',
      paper: '#ffffff',
      family: css.getPropertyValue('--font').trim() || 'sans-serif',
      text: TEXT.cell,
      levelText,
      pxPerMm: k,
      lengthText: (m) => num(m, 2),
      roomText: (n, s) => `${n} · ${name(s)}`,
    });
  });
}

/** A schedule's table as texts: its title, its heads, its rows and its totals, and which columns are numbers. */
export interface SheetTable {
  readonly title: string;
  readonly heads: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly totals: readonly string[] | null;
  readonly numeric: readonly boolean[];
}

export function tableOf(app: App, which: ScheduleViewport['schedule']): SheetTable {
  const doc = app.store.get();
  if (which === 'sheets') {
    return { title: t('sheet.list'), heads: [t('sheet.number'), t('sheet.name')], rows: sheetsOf(doc).map((s) => [s.number, s.name]), totals: null, numeric: [false, false] };
  }
  const s = schedule(doc, deriveGeometry(doc), which as ScheduleKind, scheduleNaming(app));
  return {
    title: t(`schedule.kind.${which}` as MessageKey),
    heads: s.columns.map((c) => t(c.key as MessageKey, { u: lengthUnit() })),
    rows: s.rows.map((r) => r.map((v, i) => shownCell(v, s.columns[i]!))),
    totals: s.totals.map((v, i) => (i === 0 ? t('schedule.count', { n: v ?? 0 }) : v === null ? '' : shownCell(v, s.columns[i]!))),
    numeric: s.columns.map((c) => c.unit !== 'text'),
  };
}

/** Row heights (mm): the title's, the heads', a row's. */
const ROW = { title: 7, head: 6, row: 5 } as const;

/** A table's columns' widths and its height (mm), fitted to `w` when given. */
export function tableLayout(ctx: CanvasRenderingContext2D, tb: SheetTable, family: string, w?: number): { cols: number[]; height: number; width: number } {
  ctx.font = `600 ${TEXT.cell}px ${family}`;
  const natural = tb.heads.map((h, i) => {
    let m = ctx.measureText(h).width;
    ctx.font = `400 ${TEXT.cell}px ${family}`;
    for (const r of [...tb.rows, ...(tb.totals ? [tb.totals] : [])]) m = Math.max(m, ctx.measureText(r[i] ?? '').width);
    ctx.font = `600 ${TEXT.cell}px ${family}`;
    return m + 3;
  });
  const sum = natural.reduce((a, b) => a + b, 0) || 1;
  const width = w ?? sum;
  const cols = natural.map((c) => (c * width) / sum);
  const height = ROW.title + ROW.head + ROW.row * (tb.rows.length + (tb.totals ? 1 : 0));
  return { cols, height, width };
}

/** A table on the sheet from its top left corner: its title over it, ruled. */
function paintTable(ctx: CanvasRenderingContext2D, tb: SheetTable, at: Point2, w: number, ink: string, family: string): number {
  const { cols, height } = tableLayout(ctx, tb, family, w);
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${TEXT.title}px ${family}`;
  ctx.textAlign = 'left';
  ctx.fillText(tb.title, at.x, at.y + ROW.title / 2);
  let y = at.y + ROW.title;
  const line = (lw: number, x0: number, y0: number, x1: number, y1: number) => {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const row = (cells: readonly string[], h: number, weight: string) => {
    ctx.font = `${weight} ${TEXT.cell}px ${family}`;
    let x = at.x;
    cells.forEach((c, i) => {
      const cw = cols[i] ?? 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cw, h);
      ctx.clip();
      const right = tb.numeric[i] && weight !== '600';
      ctx.textAlign = right ? 'right' : 'left';
      ctx.fillText(c, right ? x + cw - 1.5 : x + 1.5, y + h / 2);
      ctx.restore();
      x += cw;
    });
    y += h;
  };
  line(0.35, at.x, y, at.x + w, y);
  row(tb.heads, ROW.head, '600');
  line(0.25, at.x, y, at.x + w, y);
  for (const r of tb.rows) {
    row(r, ROW.row, '400');
    line(0.1, at.x, y, at.x + w, y);
  }
  if (tb.totals) {
    line(0.25, at.x, y, at.x + w, y);
    row(tb.totals, ROW.row, '700');
  }
  line(0.35, at.x, y, at.x + w, y);
  // The columns' rules, from the heads down.
  let x = at.x;
  for (let i = 0; i <= cols.length; i++) {
    line(0.1, x, at.y + ROW.title, x, y);
    x += cols[i] ?? 0;
  }
  ctx.restore();
  return height;
}

/** What a view shows, said under it: "Planta · Térreo", "Corte A", "Elevação Norte". */
export function viewTitle(doc: Doc, v: Viewport): string {
  if (v.kind === 'plan') {
    // An enlarged detail by its number and its callout's first line: "Detalhe 1 · Escada em L".
    const n = v.detail ? detailRefs(sheetsOf(doc)).get(v.detail)?.n : undefined;
    const callout = v.detail ? doc.notes.find((x) => x.id === v.detail) : undefined;
    if (n !== undefined && callout) return t('sheet.detailOf', { n, text: callout.text.split('\n')[0]! });
    const l = doc.levels.find((x) => x.id === v.levelId);
    return l ? t('sheet.planOf', { level: name(l.name) }) : t('sheet.missing');
  }
  if (v.kind === 'section') {
    const m = doc.sections.find((x) => x.id === v.sectionId);
    return m ? t(m.kind === 'section' ? 'section.titleOne' : 'section.elevationOne', { name: m.name }) : t('sheet.missing');
  }
  return t(v.schedule === 'sheets' ? 'sheet.list' : (`schedule.kind.${v.schedule}` as MessageKey));
}

/** The scales a sheet's views are at, as the title block says them: "1:100 · 1:50". */
export function sheetScales(s: Sheet): string {
  const dens = [...new Set(s.viewports.filter((v): v is FramedViewport => v.kind !== 'schedule').map((v) => v.den))].sort((a, b) => b - a);
  return dens.length === 0 ? '—' : dens.map((d) => `1:${d}`).join(' · ');
}

/** A schedule view's height on the sheet (mm): its rows'. */
export function scheduleHeight(app: App, v: ScheduleViewport): number {
  const ctx = document.createElement('canvas').getContext('2d')!;
  return tableLayout(ctx, tableOf(app, v.schedule), 'sans-serif', v.w).height;
}

/** A view's frame on the sheet (mm). */
export const viewFrame = (app: App, v: Viewport) => frameOf(v, v.kind === 'schedule' ? scheduleHeight(app, v) : 0);

/**
 * The sheet on a canvas its paper's size at `dpi`: its border, its views, its title block. `page`: its
 * place in the set (1 of 3).
 */
export function sheetCanvas(app: App, s: Sheet, dpi: number, page: { readonly n: number; readonly of: number }, logoLoaded?: () => void): HTMLCanvasElement {
  const doc = app.store.get();
  const { w, h } = sheetSize(s);
  const k = dpi / 25.4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  // Each view drawn on its own canvas at the resolution, then put on the sheet.
  const images = new Map(
    s.viewports.map((v) => {
      if (v.kind === 'plan') return [v.id, doc.levels.some((l) => l.id === v.levelId) ? planCanvas(app, { levelId: v.levelId, den: v.den, wMm: v.w, hMm: v.h, center: v.center }, dpi).canvas : null];
      const m = v.kind === 'section' ? doc.sections.find((x) => x.id === v.sectionId) : undefined;
      return [v.id, m && v.kind === 'section' ? sectionCanvas(app, m, { den: v.den, wMm: v.w, hMm: v.h, center: v.center }, dpi) : null];
    }),
  );
  paintSheet(app, ctx, s, page, logoLoaded, (v, f) => {
    const image = images.get(v.id);
    if (image) ctx.drawImage(image, f.x0, f.y0, v.w, v.h);
    return image !== null && image !== undefined;
  });
  return canvas;
}

/** The sheet as a vector page (io/pdf-canvas.ts): its views drawn on the page itself, as lines and text. */
export function sheetPdf(app: App, s: Sheet, page: { readonly n: number; readonly of: number }): PdfCanvas {
  const doc = app.store.get();
  const { w, h } = sheetSize(s);
  const pdf = new PdfCanvas(w, h);
  paintSheet(app, pdf as unknown as CanvasRenderingContext2D, s, page, undefined, (v, f) => {
    const frame = { den: v.den, wMm: v.w, hMm: v.h, center: v.center };
    if (v.kind === 'plan') {
      if (!doc.levels.some((l) => l.id === v.levelId)) return false;
      pdf.save();
      pdf.translate(f.x0, f.y0);
      planOnPdf(app, { levelId: v.levelId, ...frame }, pdf);
      pdf.restore();
      return true;
    }
    const m = doc.sections.find((x) => x.id === v.sectionId);
    if (!m) return false;
    pdf.save();
    pdf.translate(f.x0, f.y0);
    pdf.beginPath();
    pdf.rect(0, 0, v.w, v.h);
    pdf.clip();
    paintSectionView(app, m, frame, pdf as unknown as CanvasRenderingContext2D, 300 / 25.4);
    pdf.restore();
    return true;
  });
  return pdf;
}

/**
 * The sheet on `ctx`, a unit a millimetre: the paper, its views (each drawn by `view` in its frame;
 * false when what it showed is gone), their titles, the border and the title block.
 */
function paintSheet(app: App, ctx: CanvasRenderingContext2D, s: Sheet, page: { readonly n: number; readonly of: number }, logoLoaded: (() => void) | undefined, view: (v: FramedViewport, f: ReturnType<typeof frameOf>) => boolean): void {
  const doc = app.store.get();
  // The office's logo, once decoded (logo-image.ts); the caller draws again when it is.
  const logo = logoImage(lotOf(doc).logo, logoLoaded);
  const { w, h } = sheetSize(s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  withPaperColours((color, css) => {
    const ink = color('--text') || '#000000';
    const family = css.getPropertyValue('--font').trim() || 'sans-serif';
    for (const v of s.viewports) {
      if (v.kind === 'schedule') {
        paintTable(ctx, tableOf(app, v.schedule), v.at, v.w, ink, family);
        continue;
      }
      const f = frameOf(v);
      const image = view(v, f);
      if (!image) {
        // What it showed is gone (a level, a section deleted): its place, said.
        ctx.save();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 0.2;
        ctx.setLineDash([2, 1.5]);
        ctx.strokeRect(f.x0, f.y0, v.w, v.h);
        ctx.restore();
      }
      if (v.kind === 'plan' && image) northArrow(ctx, { x: f.x1 - 9, y: f.y0 + 10 }, ink, family, doc.site?.north ?? 0);
      // Its title under it, underlined, with its scale.
      ctx.save();
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.font = `700 ${TEXT.title}px ${family}`;
      const title = viewTitle(doc, v);
      const tw = ctx.measureText(title).width;
      ctx.fillText(title, f.x0, f.y1 + 6);
      ctx.font = `400 ${TEXT.cell}px ${family}`;
      ctx.fillText(`1:${v.den}`, f.x0 + tw + 3, f.y1 + 6);
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(f.x0, f.y1 + 7.5);
      ctx.lineTo(f.x0 + tw + 3 + ctx.measureText(`1:${v.den}`).width, f.y1 + 7.5);
      ctx.stroke();
      ctx.restore();
    }
    titleBlock(ctx, doc, s, w, h, page, ink, family, logo);
  });
}

/** A north arrow: a circle, an arrow up it toward the site's north, "N" over it. */
function northArrow(ctx: CanvasRenderingContext2D, c: Point2, ink: string, family: string, north: number): void {
  const r = 4;
  ctx.save();
  // Turned with the site's north (counter-clockwise in plan; the paper's y runs down).
  ctx.translate(c.x, c.y);
  ctx.rotate((-north * Math.PI) / 180);
  ctx.translate(-c.x, -c.y);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - r);
  ctx.lineTo(c.x + r * 0.45, c.y + r * 0.6);
  ctx.lineTo(c.x, c.y + r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - r);
  ctx.lineTo(c.x - r * 0.45, c.y + r * 0.6);
  ctx.lineTo(c.x, c.y + r * 0.3);
  ctx.closePath();
  ctx.stroke();
  ctx.font = `700 ${TEXT.cell}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('N', c.x, c.y - r - 1);
  ctx.restore();
}

/** The border and the title block in the bottom right corner. */
function titleBlock(ctx: CanvasRenderingContext2D, doc: Doc, s: Sheet, w: number, h: number, page: { n: number; of: number }, ink: string, family: string, logo: HTMLImageElement | null): void {
  const m = SHEET_MARGIN;
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  const x0 = w - m - TITLE_W;
  const y0 = h - m - TITLE_H;
  // White under it, in case a view runs into it.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, y0, TITLE_W, TITLE_H);
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.35;
  ctx.strokeRect(x0, y0, TITLE_W, TITLE_H);
  const split = x0 + TITLE_W - 50;
  const rowH = TITLE_H / 3;
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(split, y0);
  ctx.lineTo(split, y0 + TITLE_H);
  for (const k of [1, 2]) {
    ctx.moveTo(x0, y0 + rowH * k);
    ctx.lineTo(split, y0 + rowH * k);
  }
  ctx.moveTo(split, y0 + rowH * 2);
  ctx.lineTo(x0 + TITLE_W, y0 + rowH * 2);
  ctx.moveTo(x0 + (split - x0) / 2, y0 + rowH * 2);
  ctx.lineTo(x0 + (split - x0) / 2, y0 + TITLE_H);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const label = (text: string, x: number, y: number) => {
    ctx.font = `400 ${TEXT.label}px ${family}`;
    ctx.fillText(text.toUpperCase(), x, y);
  };
  const fit = (text: string, x: number, y: number, size: number, weight: string, room: number) => {
    ctx.font = `${weight} ${size}px ${family}`;
    const wd = ctx.measureText(text).width;
    // Too long for its box: narrower, never over the line.
    if (wd > room) ctx.font = `${weight} ${(size * room) / wd}px ${family}`;
    ctx.fillText(text, x, y);
  };
  const inner = split - x0 - 6;
  label(t('sheet.project'), x0 + 3, y0 + 3.5);
  fit(doc.name || t('app.untitled'), x0 + 3, y0 + rowH - 2.2, TEXT.project, '700', inner);
  label(t('sheet.sheet'), x0 + 3, y0 + rowH + 3.5);
  fit(s.name || '—', x0 + 3, y0 + rowH * 2 - 2.2, TEXT.title + 0.5, '600', inner);
  const half = (split - x0) / 2;
  label(t('sheet.scales'), x0 + 3, y0 + rowH * 2 + 3.5);
  fit(sheetScales(s), x0 + 3, y0 + TITLE_H - 2.2, TEXT.cell + 0.5, '400', half - 6);
  label(t('sheet.date'), x0 + half + 3, y0 + rowH * 2 + 3.5);
  fit(new Date().toLocaleDateString(getLang() === 'pt' ? 'pt-BR' : 'en-GB'), x0 + half + 3, y0 + TITLE_H - 2.2, TEXT.cell + 0.5, '400', half - 6);
  label(t('sheet.number'), split + 3, y0 + 3.5);
  ctx.textAlign = 'center';
  fit(s.number, split + 25, y0 + rowH * 2 - 3, TEXT.number, '700', 44);
  ctx.textAlign = 'left';
  label(t('sheet.page'), split + 3, y0 + rowH * 2 + 3.5);
  fit(`${page.n} / ${page.of}`, split + 3, y0 + TITLE_H - 2.2, TEXT.cell + 0.5, '400', 44);
  // Who it is for and who answers for it (the lot dialog), in a block to the title block's left, when set.
  const lot = lotOf(doc);
  const rows = [
    [t('sheet.owner'), lot.owner],
    [t('sheet.responsible'), [lot.responsible, lot.license].filter(Boolean).join(' · ')],
    [t('sheet.firm'), [lot.firm, lot.record].filter(Boolean).join(' · ')],
  ] as const;
  // As wide as the paper leaves beside the title block (none on an upright A4).
  const bw = Math.min(OFFICE_W, x0 - m);
  const named = rows.some(([, v]) => v);
  if ((named || logo) && bw >= 40) {
    const bx = x0 - bw;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, y0, bw, TITLE_H);
    ctx.fillStyle = ink;
    ctx.lineWidth = 0.35;
    ctx.strokeRect(bx, y0, bw, TITLE_H);
    // The logo in a square at the block's left (the whole block without names), kept in its proportions.
    const lw = logo ? (named ? Math.min(TITLE_H, bw * 0.4) : bw) : 0;
    if (logo) {
      const room = { w: lw - 4, h: TITLE_H - 4 };
      const k = Math.min(room.w / logo.naturalWidth, room.h / logo.naturalHeight);
      const iw = logo.naturalWidth * k;
      const ih = logo.naturalHeight * k;
      ctx.drawImage(logo, bx + 2 + (room.w - iw) / 2, y0 + 2 + (room.h - ih) / 2, iw, ih);
      if (named) {
        ctx.lineWidth = 0.18;
        ctx.beginPath();
        ctx.moveTo(bx + lw, y0);
        ctx.lineTo(bx + lw, y0 + TITLE_H);
        ctx.stroke();
      }
    }
    if (named) {
      const tx = bx + lw;
      ctx.lineWidth = 0.18;
      ctx.beginPath();
      for (const k of [1, 2]) {
        ctx.moveTo(tx, y0 + rowH * k);
        ctx.lineTo(x0, y0 + rowH * k);
      }
      ctx.stroke();
      rows.forEach(([name, value], i) => {
        label(name, tx + 3, y0 + rowH * i + 3.5);
        fit(value || '—', tx + 3, y0 + rowH * (i + 1) - 2.2, TEXT.cell + 0.5, '600', bw - lw - 6);
      });
    }
  }
  ctx.restore();
}

/** The office block's width beside the title block (mm). */
const OFFICE_W = 90;

/** A PDF's resolution for a paper: 300 dpi on A4 and A3, 200 on A2, 150 on A1 and A0. */
export const sheetDpi = (paper: string): number => (paper === 'A4' || paper === 'A3' ? 300 : paper === 'A2' ? 200 : 150);

/** The sheets as one PDF, a page each, downloaded: the whole set, or the one given. */
export async function downloadSheetsPdf(app: App, only?: string): Promise<void> {
  const made = await sheetsPdf(app, only);
  if (made) app.download(made.file, new Blob([made.pdf as BlobPart], { type: 'application/pdf' }), 'application/pdf');
}

/** The sheets (or one) as a PDF and its file's name; null when there are none. */
export async function sheetsPdf(app: App, only?: string): Promise<{ pdf: Uint8Array; file: string } | null> {
  const all = sheetsOf(app.store.get());
  const chosen = only ? all.filter((s) => s.id === only) : all;
  if (chosen.length === 0) return null;
  // The logo decoded before the pages are drawn; one that cannot be is left out, and said.
  if (!(await logoReady(lotOf(app.store.get()).logo))) app.toast(t('lot.logoBad'));
  // Each sheet a vector page: its lines, fills and texts as the screen draws them.
  const pages = chosen.map((s) => sheetPdf(app, s, { n: all.indexOf(s) + 1, of: all.length }));
  const doc = app.store.get();
  const one = chosen.length === 1 ? chosen[0]! : null;
  const title = one ? `${doc.name || t('app.untitled')} · ${one.number} ${one.name}` : `${doc.name || t('app.untitled')} · ${t('sheet.set')}`;
  const pdf = await pdfOfVectorPages(pages, title);
  const file = one ? `${app.fileBase()}-${one.number}.pdf` : `${app.fileBase()}-${t('sheet.setFile')}.pdf`;
  return { pdf, file };
}

/**
 * The scale a view is put at: the one asked for, or the next smaller of those offered (1:100 after
 * 1:50) while what it shows (`need`, mm at 1:1000 per metre… its size at 1 : den is need · 1000/den,
 * plus `margin`) does not fit the drawing area; the smallest when none fits.
 */
export function fittingScale(den: number, need: { w: number; h: number }, margin: { w: number; h: number }, room: { w: number; h: number }): number {
  const from = SCALES.filter((d) => d >= den);
  return from.find((d) => need.w * (1000 / d) + margin.w <= room.w && need.h * (1000 / d) + margin.h <= room.h) ?? from.at(-1) ?? den;
}

/** A view of a level's plan framed round it: its whole plan at the scale (or a smaller one it fits at), inside the drawing area. */
export function planViewport(app: App, s: Pick<Sheet, 'paper' | 'landscape'>, levelId: string, asked: number, id: string): PlanViewport {
  const area = drawingArea(s);
  const center = planMiddle(app, levelId);
  const box = boundsOf(levelPlan(app.store.get(), levelId, app.ui.hidden));
  const room = { w: area.x1 - area.x0, h: area.y1 - area.y0 - 10 };
  // Its plan's extent at the scale, with room round it for tags and dimensions.
  const need = box ? { w: box.max.x - box.min.x, h: box.max.y - box.min.y } : { w: 0, h: 0 };
  const den = box ? fittingScale(asked, need, { w: 30, h: 30 }, room) : asked;
  const per = 1000 / den;
  const w = Math.min(box ? need.w * per + 30 : 120, room.w);
  const h = Math.min(box ? need.h * per + 30 : 90, room.h);
  return { id, kind: 'plan', levelId, den, at: { x: area.x0 + w / 2, y: area.y0 + h / 2 }, w, h, center };
}

/** A view of a section or an elevation: its whole drawing at the scale (or a smaller one it fits at), room at the right for the level marks. */
export function sectionViewport(app: App, s: Pick<Sheet, 'paper' | 'landscape'>, m: SectionMark, asked: number, id: string): SectionViewport {
  const area = drawingArea(s);
  const d = sectionOf(app, m);
  const box = d.box ?? { min: { x: 0, y: 0 }, max: { x: d.length, y: 3 } };
  // The level marks stand out to the right of the drawing: room for them.
  const marks = 40;
  const room = { w: area.x1 - area.x0, h: area.y1 - area.y0 - 10 };
  const need = { w: box.max.x - box.min.x, h: box.max.y - Math.min(d.base, box.min.y) };
  const den = fittingScale(asked, need, { w: 20 + marks, h: 20 }, room);
  const per = 1000 / den;
  const w = Math.min(need.w * per + 20 + marks, room.w);
  const h = Math.min(need.h * per + 20, room.h);
  const center = { x: (box.min.x + box.max.x) / 2 + marks / 2 / per, y: (Math.min(d.base, box.min.y) + box.max.y) / 2 };
  return { id, kind: 'section', sectionId: m.id, den, at: { x: area.x0 + w / 2, y: area.y0 + h / 2 }, w, h, center };
}
