// A section or an elevation drawn as it prints (section-drawing.ts), for the sections dialog: from the
// model as it is now, on white paper whatever the theme, with the project's pens at its scale.

import type { App } from './app';
import type { Doc } from './document';
import { drawingOf } from './document';
import { type DerivedGeometry, deriveGeometry } from './geometry';
import { modelSolids, paintSection, sectionDrawing, type SectionDrawing, type Solid3 } from './section-drawing';
import { scaleFactor } from '../elements/drawing/schema';
import type { SectionMark } from '../elements/section/schema';
import { name, num } from '../ui/i18n';
import type { Point2 } from '../core/vector';

/** The text of a drawing's cells and labels (mm). */
const TEXT = 2;

/**
 * The model's solids as triangles and its rooms shown, once a document and set of hidden categories (a
 * section drawn again is drawn from them). Keyed by the document alone, hiding a category and opening the
 * sections again still drew what was hidden: the hidden set is not in the document.
 */
type Model = { readonly solids: Solid3[]; readonly rooms: DerivedGeometry['rooms'] };
const modelCache = new WeakMap<Doc, Map<string, Model>>();
const drawingCache = new WeakMap<Model, Map<string, SectionDrawing>>();

/** A section's or an elevation's drawing as the model is now. */
export function sectionOf(app: App, m: SectionMark): SectionDrawing {
  const doc = app.store.get();
  let models = modelCache.get(doc);
  if (!models) modelCache.set(doc, (models = new Map()));
  const hidden = [...app.ui.hidden].sort().join('|');
  let model = models.get(hidden);
  if (!model) {
    const g = deriveGeometry(doc);
    models.set(hidden, (model = { solids: modelSolids(doc, g, app.ui.hidden), rooms: app.ui.hidden.has('rooms') ? new Map() : g.rooms }));
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

/**
 * Paints with the light theme's colours, whatever the theme on screen (paper is white), the canvas
 * and its underlay white; the theme put back after.
 */
function withPaperColours<T>(paint: (color: (name: string) => string, css: CSSStyleDeclaration) => T): T {
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

/** A section or an elevation on a canvas its frame's size at `dpi`. */
export function sectionCanvas(app: App, m: SectionMark, f: { den: number; wMm: number; hMm: number; center: Point2 }, dpi: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const k = dpi / 25.4;
  canvas.width = Math.max(1, Math.round(f.wMm * k));
  canvas.height = Math.max(1, Math.round(f.hMm * k));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
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
      text: TEXT,
      levelText,
      pxPerMm: k,
      lengthText: (m) => num(m, 2),
      roomText: (n, s) => `${n} · ${name(s)}`,
    });
  });
  return canvas;
}
