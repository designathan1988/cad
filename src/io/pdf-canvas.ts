// A vector PDF (phase 10: "PDF vetorial"): a stand-in for a 2D canvas context that writes a PDF page's
// content instead of pixels, so the plan, the sections and the sheets are drawn by the very code that
// draws them on screen and come out as lines, fills and text a printer and a CAD reader keep sharp at
// any zoom. It takes what that code uses of the canvas: paths (lines, arcs, rectangles), fills (nonzero
// and even-odd), strokes with their width, caps, joins and dashes, clips, transforms, the global alpha,
// text (Helvetica and Helvetica-Bold in WinAnsi, the standard 14 fonts every reader has, measured as
// Arial, whose widths are Helvetica's), the cut hatches as tiling patterns of lines (render/hatch.ts),
// and pictures (references, maps, the logo) as images. Coordinates: the canvas's, a millimetre a unit at
// first, y down; the page's in points, y up.

/** An affine map [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f (a canvas's DOMMatrix). */
export type Affine = readonly [number, number, number, number, number, number];

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];
export const multiply = (m: Affine, n: Affine): Affine => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Affine, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
/** How much a map stretches lengths, on average (a pen's width, a dash). */
const stretch = (m: Affine) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

/** Points (1/72 in) a millimetre. */
export const PT_PER_MM = 72 / 25.4;

/** A number as the content stream writes it: three decimals, no exponent, no "-0". */
export const n = (v: number): string => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
};

/** A colour as 0..1 red, green, blue and its alpha. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** A CSS colour read without a browser: hex and rgb()/rgba(); null for any other form. */
export function parseColour(s: string): Rgba | null {
  const t = s.trim().toLowerCase();
  if (t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (t === 'white') return { r: 1, g: 1, b: 1, a: 1 };
  if (t === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  const hex = /^#([0-9a-f]{3,8})$/.exec(t);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const v = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: v(0), g: v(2), b: v(4), a: h.length === 8 ? v(6) : 1 };
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(t);
  if (fn) {
    const parts = fn[1]!.split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const ch = (p: string) => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p) / 255);
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    const c = { r: ch(parts[0]!), g: ch(parts[1]!), b: ch(parts[2]!), a: alpha };
    return [c.r, c.g, c.b, c.a].every(Number.isFinite) ? c : null;
  }
  return null;
}

/**
 * Text to WinAnsi bytes (what the standard fonts read): Latin-1 as it is, the Windows codes for the
 * typographic marks, and the signs the fonts lack written with what they have ("≤" as "<=").
 */
const WIN: Readonly<Record<number, number>> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
const SPELLED: Readonly<Record<string, string>> = { '−': '-', '≤': '<=', '≥': '>=', '→': '->', '←': '<-', '↑': '^', '↓': 'v', '≈': '~', '≠': '/=', 'φ': 'f', 'θ': 'th', 'α': 'a', 'λ': 'l', 'ρ': 'r', 'μ': 'µ', 'Δ': 'D', 'Σ': 'S', 'Ø': 'Ø', '⌀': 'Ø', ' ': ' ', ' ': ' ' };
export function winAnsi(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const spelled = SPELLED[ch];
    if (spelled !== undefined && spelled !== ch) {
      out.push(...winAnsi(spelled));
      continue;
    }
    const c = ch.codePointAt(0)!;
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else if (WIN[c] !== undefined) out.push(WIN[c]);
    else if (c === 0x09) out.push(0x20);
    else out.push(0x3f);
  }
  return out;
}
/** Bytes as a PDF literal string: the brackets and the backslash escaped, the rest over 126 in octal. */
const literal = (bytes: readonly number[]) =>
  `(${bytes.map((b) => (b === 0x28 || b === 0x29 || b === 0x5c ? `\\${String.fromCharCode(b)}` : b < 0x20 || b > 0x7e ? `\\${b.toString(8).padStart(3, '0')}` : String.fromCharCode(b))).join('')})`;

/** A cut hatch as lines in a square tile `tile` units wide, repeated (render/hatch.ts). */
export interface VectorPattern {
  readonly vectorPattern: true;
  readonly lines: readonly (readonly (readonly [number, number])[])[];
  readonly tile: number;
  readonly color: string;
  readonly width: number;
  transform: Affine;
  setTransform(m?: DOMMatrix2DInit): void;
}

/** A picture's pixels: RGB, its alpha apart (null when opaque), rows from the top. */
export interface PdfImage {
  readonly rgb: Uint8Array;
  readonly alpha: Uint8Array | null;
  readonly w: number;
  readonly h: number;
}

/** A tiling pattern as written: its lines, its colour, and its matrix to the page. */
export interface PdfPattern {
  readonly pattern: VectorPattern;
  readonly matrix: Affine;
  readonly colour: Rgba;
}

/** Measures a text in a CSS font ("600 2px Arial"): its width and how far its baseline is from the alphabetic one. */
export interface TextMeasurer {
  width(font: string, text: string): number;
  /** From the line `baseline` names to the alphabetic baseline, down positive, for a 1 px font. */
  baseline(font: string, baseline: CanvasTextBaseline): number;
  colour(css: string): Rgba;
  pixels(source: CanvasImageSource): PdfImage | null;
}

/** Baselines from the alphabetic one for Helvetica (em units, down positive), when the browser does not say. */
const BASELINE_EM: Readonly<Record<CanvasTextBaseline, number>> = { alphabetic: 0, top: 0.905, hanging: 0.8, middle: 0.34, ideographic: -0.212, bottom: -0.212 };

/** The browser's own measures: an offscreen canvas, Arial in place of the page's font (Helvetica's widths). */
export function browserMeasurer(): TextMeasurer {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const colours = new Map<string, Rgba>();
  return {
    width(font, text) {
      ctx.font = font;
      return ctx.measureText(text).width;
    },
    baseline(font, baseline) {
      ctx.font = font;
      ctx.textBaseline = baseline;
      const m = ctx.measureText('Hg') as TextMetrics & { alphabeticBaseline?: number };
      ctx.textBaseline = 'alphabetic';
      const size = parseFloat(/([\d.]+)px/.exec(font)?.[1] ?? '1') || 1;
      // The line the baseline names is the alphabetic one moved by this (negative: above it).
      return typeof m.alphabeticBaseline === 'number' && Number.isFinite(m.alphabeticBaseline) ? -m.alphabeticBaseline / size : BASELINE_EM[baseline];
    },
    colour(css) {
      const known = colours.get(css);
      if (known) return known;
      // Any CSS colour (oklch, color-mix, named): drawn on a pixel and read back in sRGB.
      const parsed = parseColour(css);
      let out = parsed;
      if (!out) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000000';
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        const a = d[3]! / 255;
        out = a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : { r: d[0]! / 255 / a, g: d[1]! / 255 / a, b: d[2]! / 255 / a, a };
      }
      colours.set(css, out);
      return out;
    },
    pixels(source) {
      const s = source as { naturalWidth?: number; naturalHeight?: number; width?: number | SVGAnimatedLength; height?: number | SVGAnimatedLength; videoWidth?: number };
      const w0 = s.naturalWidth || (typeof s.width === 'number' ? s.width : 0);
      const h0 = s.naturalHeight || (typeof s.height === 'number' ? s.height : 0);
      if (!w0 || !h0) return null;
      // Big pictures drawn at most 2400 px on their longer side: enough for paper, not the file's size.
      const k = Math.min(1, 2400 / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * k));
      const h = Math.max(1, Math.round(h0 * k));
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const t = tmp.getContext('2d', { willReadFrequently: true })!;
      t.drawImage(source, 0, 0, w, h);
      const d = t.getImageData(0, 0, w, h).data;
      const rgb = new Uint8Array(w * h * 3);
      const alpha = new Uint8Array(w * h);
      let opaque = true;
      for (let i = 0, j = 0, q = 0; i < d.length; i += 4, j += 3, q++) {
        rgb[j] = d[i]!;
        rgb[j + 1] = d[i + 1]!;
        rgb[j + 2] = d[i + 2]!;
        alpha[q] = d[i + 3]!;
        if (d[i + 3] !== 255) opaque = false;
      }
      return { rgb, alpha: opaque ? null : alpha, w, h };
    },
  };
}

interface State {
  ctm: Affine;
  fill: string | VectorPattern;
  stroke: string | VectorPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  dash: number[];
  dashOffset: number;
  alpha: number;
  font: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
}

/** A font's PDF name, its weight from the CSS font ("600 …", "bold …"), and its size in canvas units. */
function fontOf(css: string): { name: 'F1' | 'F2'; size: number; measure: string } {
  const size = parseFloat(/([\d.]+)px/.exec(css)?.[1] ?? '10') || 10;
  const w = /\b(bold|bolder|[6-9]00)\b/.test(css);
  return { name: w ? 'F2' : 'F1', size, measure: `${w ? '700' : '400'} 100px Arial` };
}

/**
 * The stand-in context: a page `wMm` × `hMm`. Draw on it as on a canvas whose unit is a millimetre (y
 * down); `content()` and its resources go to pdfOfVectorPages.
 */
export class PdfCanvas {
  /** What reads `ctx.canvas` gets a canvas-like object of the page's size. */
  readonly canvas: { width: number; height: number };
  readonly ops: string[] = [];
  readonly images: PdfImage[] = [];
  readonly patterns: PdfPattern[] = [];
  readonly alphas = new Map<string, number>();
  readonly fonts = new Set<'F1' | 'F2'>();
  imageSmoothingEnabled = true;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  private s: State;
  private readonly stack: State[] = [];
  /** The maps that `setTransform` starts from: the page's, and those a view set over it (pushBase). */
  private readonly bases: Affine[];
  private path: string[] = [];
  private current: [number, number] | null = null;
  private start: [number, number] | null = null;

  constructor(
    readonly wMm: number,
    readonly hMm: number,
    private readonly measurer: TextMeasurer = browserMeasurer(),
  ) {
    const base: Affine = [PT_PER_MM, 0, 0, -PT_PER_MM, 0, hMm * PT_PER_MM];
    this.bases = [base];
    this.canvas = { width: wMm, height: hMm };
    this.s = { ctm: base, fill: '#000000', stroke: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, dash: [], dashOffset: 0, alpha: 1, font: '10px sans-serif', align: 'start', baseline: 'alphabetic' };
  }

  // The state a canvas keeps.
  get fillStyle(): string | VectorPattern {
    return this.s.fill;
  }
  set fillStyle(v: string | VectorPattern | CanvasPattern | CanvasGradient) {
    if (typeof v === 'string' || (v as VectorPattern).vectorPattern) this.s.fill = v as string | VectorPattern;
  }
  get strokeStyle(): string | VectorPattern {
    return this.s.stroke;
  }
  set strokeStyle(v: string | VectorPattern | CanvasPattern | CanvasGradient) {
    if (typeof v === 'string' || (v as VectorPattern).vectorPattern) this.s.stroke = v as string | VectorPattern;
  }
  get lineWidth() {
    return this.s.lineWidth;
  }
  set lineWidth(v: number) {
    if (Number.isFinite(v) && v > 0) this.s.lineWidth = v;
  }
  get lineCap() {
    return this.s.lineCap;
  }
  set lineCap(v: CanvasLineCap) {
    this.s.lineCap = v;
  }
  get lineJoin() {
    return this.s.lineJoin;
  }
  set lineJoin(v: CanvasLineJoin) {
    this.s.lineJoin = v;
  }
  get miterLimit() {
    return this.s.miterLimit;
  }
  set miterLimit(v: number) {
    if (Number.isFinite(v) && v > 0) this.s.miterLimit = v;
  }
  get lineDashOffset() {
    return this.s.dashOffset;
  }
  set lineDashOffset(v: number) {
    if (Number.isFinite(v)) this.s.dashOffset = v;
  }
  get globalAlpha() {
    return this.s.alpha;
  }
  set globalAlpha(v: number) {
    if (Number.isFinite(v) && v >= 0 && v <= 1) this.s.alpha = v;
  }
  get font() {
    return this.s.font;
  }
  set font(v: string) {
    this.s.font = v;
  }
  get textAlign() {
    return this.s.align;
  }
  set textAlign(v: CanvasTextAlign) {
    this.s.align = v;
  }
  get textBaseline() {
    return this.s.baseline;
  }
  set textBaseline(v: CanvasTextBaseline) {
    this.s.baseline = v;
  }
  setLineDash(d: number[]): void {
    if (d.every((x) => Number.isFinite(x) && x >= 0)) this.s.dash = d.length % 2 === 1 ? [...d, ...d] : [...d];
  }
  getLineDash(): number[] {
    return [...this.s.dash];
  }

  save(): void {
    this.stack.push({ ...this.s, dash: [...this.s.dash] });
    this.ops.push('q');
  }
  restore(): void {
    const s = this.stack.pop();
    if (!s) return;
    this.s = s;
    this.ops.push('Q');
  }

  // Transforms.
  private set(m: Affine) {
    this.s.ctm = m;
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.set(multiply(this.s.ctm, [a, b, c, d, e, f]));
  }
  translate(x: number, y: number): void {
    this.transform(1, 0, 0, 1, x, y);
  }
  scale(x: number, y: number): void {
    this.transform(x, 0, 0, y, 0, 0);
  }
  rotate(a: number): void {
    const c = Math.cos(a);
    const s = Math.sin(a);
    this.transform(c, s, -s, c, 0, 0);
  }
  setTransform(a?: number | DOMMatrix2DInit, b?: number, c?: number, d?: number, e?: number, f?: number): void {
    const base = this.bases.at(-1)!;
    if (typeof a === 'number') this.set(multiply(base, [a, b!, c!, d!, e!, f!]));
    else if (a) this.set(multiply(base, [a.a ?? a.m11 ?? 1, a.b ?? a.m12 ?? 0, a.c ?? a.m21 ?? 0, a.d ?? a.m22 ?? 1, a.e ?? a.m41 ?? 0, a.f ?? a.m42 ?? 0]));
    else this.set(base);
  }
  resetTransform(): void {
    this.set(this.bases.at(-1)!);
  }
  /**
   * What `setTransform` starts from becomes the map now set: a view drawn inside a frame (a plan on a
   * sheet) resets its transform to the frame's, not to the page's. Undone by popBase.
   */
  pushBase(): void {
    this.bases.push(this.s.ctm);
  }
  popBase(): void {
    if (this.bases.length > 1) this.bases.pop();
  }

  // Paths, in the page's points as they are made (a canvas maps a path's points when they are added).
  beginPath(): void {
    this.path = [];
    this.current = null;
    this.start = null;
  }
  moveTo(x: number, y: number): void {
    const [px, py] = apply(this.s.ctm, x, y);
    this.path.push(`${n(px)} ${n(py)} m`);
    this.current = this.start = [px, py];
  }
  lineTo(x: number, y: number): void {
    if (!this.current) return this.moveTo(x, y);
    const [px, py] = apply(this.s.ctm, x, y);
    this.path.push(`${n(px)} ${n(py)} l`);
    this.current = [px, py];
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    if (!this.current) this.moveTo(c1x, c1y);
    const m = this.s.ctm;
    const a = apply(m, c1x, c1y);
    const b = apply(m, c2x, c2y);
    const p = apply(m, x, y);
    this.path.push(`${n(a[0])} ${n(a[1])} ${n(b[0])} ${n(b[1])} ${n(p[0])} ${n(p[1])} c`);
    this.current = p;
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    if (!this.current) this.moveTo(cx, cy);
    // The current point back in canvas units, to raise the quadratic to a cubic.
    const inv = invert(this.s.ctm);
    const [x0, y0] = inv ? apply(inv, this.current![0], this.current![1]) : [cx, cy];
    this.bezierCurveTo(x0 + (2 / 3) * (cx - x0), y0 + (2 / 3) * (cy - y0), x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y), x, y);
  }
  closePath(): void {
    if (!this.current) return;
    this.path.push('h');
    this.current = this.start;
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
    this.moveTo(x, y);
  }
  /** A circle's arc as cubic curves, a quarter turn at most each, as a canvas sweeps it. */
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): void {
    if (r < 0 || !Number.isFinite(r)) return;
    const tau = Math.PI * 2;
    let sweep: number;
    if (!ccw) sweep = a1 - a0 >= tau ? tau : ((((a1 - a0) % tau) + tau) % tau);
    else sweep = a0 - a1 >= tau ? -tau : -((((a0 - a1) % tau) + tau) % tau);
    const p0x = x + r * Math.cos(a0);
    const p0y = y + r * Math.sin(a0);
    if (this.current) this.lineTo(p0x, p0y);
    else this.moveTo(p0x, p0y);
    const parts = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
    const step = sweep / parts;
    const k = (4 / 3) * Math.tan(step / 4);
    let a = a0;
    for (let i = 0; i < parts; i++) {
      const b = a + step;
      const [ca, sa, cb, sb] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)];
      this.bezierCurveTo(x + r * (ca - k * sa), y + r * (sa + k * ca), x + r * (cb + k * sb), y + r * (sb - k * cb), x + r * cb, y + r * sb);
      a = b;
    }
  }
  arcTo(x1: number, y1: number): void {
    this.lineTo(x1, y1);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false): void {
    this.save();
    this.translate(x, y);
    this.rotate(rot);
    this.scale(rx || 1e-9, ry || 1e-9);
    this.arc(0, 0, 1, a0, a1, ccw);
    // The path stays; only the map is put back (no Q: nothing was drawn).
    const s = this.stack.pop()!;
    this.ops.pop();
    this.s = s;
  }
  roundRect(x: number, y: number, w: number, h: number, radii: number | DOMPointInit | (number | DOMPointInit)[] = 0): void {
    const r0 = Array.isArray(radii) ? radii[0] : radii;
    const r = Math.max(0, Math.min(typeof r0 === 'number' ? r0 : (r0?.x ?? 0), Math.abs(w) / 2, Math.abs(h) / 2));
    if (r === 0) return this.rect(x, y, w, h);
    this.moveTo(x + r, y);
    this.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    this.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    this.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    this.arc(x + r, y + r, r, Math.PI, (3 * Math.PI) / 2);
    this.closePath();
  }

  // Painting: the colour and the pen set before each, so a restore (Q) never leaves a stale one.
  private gs(alpha: number): void {
    if (alpha >= 1 - 1e-6) return;
    const key = n(alpha);
    if (!this.alphas.has(key)) this.alphas.set(key, alpha);
    this.ops.push(`/GS${key.replace('.', '_')} gs`);
  }
  private colour(style: string | VectorPattern): Rgba {
    return typeof style === 'string' ? this.measurer.colour(style) : this.measurer.colour(style.color);
  }
  /** The fill set: a colour (its alpha times the global one), or a hatch pattern; false when nothing would show. */
  private setFill(): boolean {
    const st = this.s.fill;
    if (typeof st !== 'string') {
      const colour = this.colour(st);
      const alpha = colour.a * this.s.alpha;
      if (alpha <= 0) return false;
      this.patterns.push({ pattern: st, matrix: multiply(this.s.ctm, st.transform), colour });
      this.gs(alpha);
      this.ops.push(`/Pattern cs /P${this.patterns.length - 1} scn`);
      return true;
    }
    const c = this.colour(st);
    const alpha = c.a * this.s.alpha;
    if (alpha <= 0) return false;
    this.gs(alpha);
    this.ops.push(`${n(c.r)} ${n(c.g)} ${n(c.b)} rg`);
    return true;
  }
  private setStroke(): boolean {
    const c = this.colour(this.s.stroke);
    const alpha = c.a * this.s.alpha;
    if (alpha <= 0) return false;
    const k = stretch(this.s.ctm);
    this.gs(alpha);
    this.ops.push(`${n(c.r)} ${n(c.g)} ${n(c.b)} RG`);
    this.ops.push(`${n(this.s.lineWidth * k)} w`);
    this.ops.push(`${({ butt: 0, round: 1, square: 2 } as const)[this.s.lineCap]} J`);
    this.ops.push(`${({ miter: 0, round: 1, bevel: 2 } as const)[this.s.lineJoin]} j`);
    this.ops.push(`${n(this.s.miterLimit)} M`);
    this.ops.push(`[${this.s.dash.map((d) => n(d * k)).join(' ')}] ${n(this.s.dashOffset * k)} d`);
    return true;
  }
  fill(rule?: CanvasFillRule): void {
    if (this.path.length === 0) return;
    this.ops.push('q');
    if (this.setFill()) this.ops.push(...this.path, rule === 'evenodd' ? 'f*' : 'f');
    this.ops.push('Q');
  }
  stroke(): void {
    if (this.path.length === 0) return;
    this.ops.push('q');
    if (this.setStroke()) this.ops.push(...this.path, 'S');
    this.ops.push('Q');
  }
  clip(rule?: CanvasFillRule): void {
    // An empty path clips everything away, as on a canvas.
    this.ops.push(...(this.path.length > 0 ? this.path : ['0 0 m', 'h']), rule === 'evenodd' ? 'W* n' : 'W n');
  }
  private box(x: number, y: number, w: number, h: number): string[] {
    const m = this.s.ctm;
    const p = [apply(m, x, y), apply(m, x + w, y), apply(m, x + w, y + h), apply(m, x, y + h)];
    return [`${n(p[0]![0])} ${n(p[0]![1])} m`, ...p.slice(1).map(([a, b]) => `${n(a)} ${n(b)} l`), 'h'];
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.ops.push('q');
    if (this.setFill()) this.ops.push(...this.box(x, y, w, h), 'f');
    this.ops.push('Q');
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.ops.push('q');
    if (this.setStroke()) this.ops.push(...this.box(x, y, w, h), 'S');
    this.ops.push('Q');
  }
  /** Cleared to the paper: white (a page has nothing under it). */
  clearRect(x: number, y: number, w: number, h: number): void {
    this.ops.push('q', '1 1 1 rg', ...this.box(x, y, w, h), 'f', 'Q');
  }

  // Text.
  measureText(text: string): TextMetrics {
    const f = fontOf(this.s.font);
    const width = (this.measurer.width(f.measure, text) * f.size) / 100;
    return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, actualBoundingBoxAscent: f.size * 0.72, actualBoundingBoxDescent: f.size * 0.21, fontBoundingBoxAscent: f.size * 0.905, fontBoundingBoxDescent: f.size * 0.212 } as TextMetrics;
  }
  private text(text: string, x: number, y: number, mode: 0 | 1, maxWidth?: number): void {
    if (text === '') return;
    const f = fontOf(this.s.font);
    const width = (this.measurer.width(f.measure, text) * f.size) / 100;
    const squeeze = maxWidth !== undefined && maxWidth > 0 && width > maxWidth ? maxWidth / width : 1;
    const shown = width * squeeze;
    const align = this.s.align;
    const dx = align === 'center' ? -shown / 2 : align === 'right' || align === 'end' ? -shown : 0;
    const dy = this.measurer.baseline(`${f.name === 'F2' ? '700' : '400'} 100px Arial`, this.s.baseline) * f.size;
    // The text's own map: at its baseline's start, upright (the canvas's y runs down, the font's up).
    const m = multiply(this.s.ctm, [squeeze, 0, 0, -1, x + dx, y + dy]);
    this.fonts.add(f.name);
    this.ops.push('q');
    const ok = mode === 0 ? this.setFill() : this.setStroke();
    if (ok) this.ops.push('BT', `/${f.name} ${n(f.size)} Tf`, `${mode} Tr`, `${m.map(n).join(' ')} Tm`, `${literal(winAnsi(text))} Tj`, 'ET');
    this.ops.push('Q');
  }
  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.text(text, x, y, 0, maxWidth);
  }
  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    this.text(text, x, y, 1, maxWidth);
  }

  // Pictures.
  drawImage(source: CanvasImageSource, ...args: number[]): void {
    const px = this.measurer.pixels(source);
    if (!px) return;
    let [dx, dy, dw, dh] = [0, 0, px.w, px.h];
    if (args.length === 2) [dx, dy] = args as [number, number];
    else if (args.length === 4) [dx, dy, dw, dh] = args as [number, number, number, number];
    else if (args.length === 8) [dx, dy, dw, dh] = args.slice(4) as [number, number, number, number];
    if (args.length === 2) {
      // Drawn at its own size: its pixels a unit each.
      const s = source as { naturalWidth?: number; width?: unknown; naturalHeight?: number; height?: unknown };
      dw = s.naturalWidth || (typeof s.width === 'number' ? s.width : px.w);
      dh = s.naturalHeight || (typeof s.height === 'number' ? s.height : px.h);
    }
    this.images.push(px);
    const m = multiply(this.s.ctm, [dw, 0, 0, -dh, dx, dy + dh]);
    this.ops.push('q');
    this.gs(this.s.alpha);
    this.ops.push(`${m.map(n).join(' ')} cm`, `/Im${this.images.length - 1} Do`, 'Q');
  }

  /** A hatch's tile as a pattern of lines (render/hatch.ts gives it in place of a canvas pattern). */
  vectorPattern(lines: VectorPattern['lines'], tile: number, color: string, width: number, scale = 1): VectorPattern {
    const p: VectorPattern = {
      vectorPattern: true,
      lines,
      tile,
      color,
      width,
      transform: [scale, 0, 0, scale, 0, 0],
      setTransform(m?: DOMMatrix2DInit) {
        p.transform = m ? [m.a ?? 1, m.b ?? 0, m.c ?? 0, m.d ?? 1, m.e ?? 0, m.f ?? 0] : IDENTITY;
      },
    };
    return p;
  }
  createPattern(): null {
    return null;
  }

  /** The page's content stream, every save closed. */
  content(): string {
    const open = this.stack.length;
    return [...this.ops, ...Array.from({ length: open }, () => 'Q')].join('\n');
  }
}

const invert = (m: Affine): Affine | null => {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
};

/** Whether a context is this stand-in (render/hatch.ts asks, to give lines instead of a picture). */
export const isPdfCanvas = (ctx: unknown): ctx is PdfCanvas => ctx instanceof PdfCanvas;

const ascii = (s: string) => new TextEncoder().encode(s);

/** The bytes compressed as a zlib stream (FlateDecode). */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A text as a PDF string in UTF-16 (hex), for the document's information. */
const infoText = (s: string) => `<FEFF${Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join('')}>`;

/** The PDF of drawn pages (PdfCanvas), each its paper's size: PDF 1.4, the streams compressed. */
export async function pdfOfVectorPages(pages: readonly PdfCanvas[], title: string): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('pdfOfVectorPages: no pages');
  const objects: Uint8Array[][] = [];
  const add = (parts: Uint8Array[]) => (objects.push(parts), objects.length);
  const reserve = () => add([]);
  const stream = async (dict: string, data: Uint8Array) => {
    const z = await deflate(data);
    return [ascii(`<< ${dict} /Filter /FlateDecode /Length ${z.length} >>\nstream\n`), z, ascii('\nendstream')];
  };
  const catalog = reserve();
  const pagesObj = reserve();
  const f1 = add([ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')]);
  const f2 = add([ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')]);
  const kids: number[] = [];
  for (const p of pages) {
    const W = n(p.wMm * PT_PER_MM);
    const H = n(p.hMm * PT_PER_MM);
    const images: string[] = [];
    for (const [i, im] of p.images.entries()) {
      const mask = im.alpha ? add(await stream(`/Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceGray /BitsPerComponent 8`, im.alpha)) : null;
      const id = add(await stream(`/Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8${mask ? ` /SMask ${mask} 0 R` : ''}`, im.rgb));
      images.push(`/Im${i} ${id} 0 R`);
    }
    const patterns: string[] = [];
    for (const [i, pt] of p.patterns.entries()) {
      const { pattern: q, matrix, colour } = pt;
      const body = [`${n(colour.r)} ${n(colour.g)} ${n(colour.b)} RG`, `${n(q.width)} w`, '1 J', '1 j', ...q.lines.flatMap((line) => [...line.map(([x, y], k) => `${n(x)} ${n(y)} ${k === 0 ? 'm' : 'l'}`), 'S'])].join('\n');
      const id = add(await stream(`/Type /Pattern /PatternType 1 /PaintType 1 /TilingType 1 /BBox [0 0 ${n(q.tile)} ${n(q.tile)}] /XStep ${n(q.tile)} /YStep ${n(q.tile)} /Resources << >> /Matrix [${matrix.map(n).join(' ')}]`, ascii(body)));
      patterns.push(`/P${i} ${id} 0 R`);
    }
    const gstates = [...p.alphas].map(([key, a]) => `/GS${key.replace('.', '_')} << /ca ${n(a)} /CA ${n(a)} >>`);
    const content = add(await stream('', ascii(p.content())));
    const resources = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${images.length ? ` /XObject << ${images.join(' ')} >>` : ''}${patterns.length ? ` /Pattern << ${patterns.join(' ')} >>` : ''}${gstates.length ? ` /ExtGState << ${gstates.join(' ')} >>` : ''} >>`;
    kids.push(add([ascii(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${resources} /Contents ${content} 0 R >>`)]));
  }
  objects[catalog - 1] = [ascii(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`)];
  objects[pagesObj - 1] = [ascii(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`)];
  const info = add([ascii(`<< /Title ${infoText(title)} /Producer (cad2) >>`)]);
  const parts: Uint8Array[] = [ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')];
  let at = parts[0]!.length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(at);
    const chunk = [ascii(`${i + 1} 0 obj\n`), ...body, ascii('\nendobj\n')];
    for (const c of chunk) at += c.length;
    parts.push(...chunk);
  });
  const xref = at;
  parts.push(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`));
  parts.push(ascii(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(parts.reduce((k, q) => k + q.length, 0));
  let k = 0;
  for (const q of parts) {
    out.set(q, k);
    k += q.length;
  }
  return out;
}
