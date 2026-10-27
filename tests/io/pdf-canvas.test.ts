// The vector PDF's stand-in context (io/pdf-canvas.ts): what a canvas call becomes in the page's
// content, in points with y up, and the file around it.

import { describe, expect, it } from 'vitest';
import { multiply, n, parseColour, PdfCanvas, pdfOfVectorPages, PT_PER_MM, type TextMeasurer, winAnsi } from '../../src/io/pdf-canvas';

// Half an em a letter; the baselines as the fallback table; colours read as hex and rgb().
const measurer: TextMeasurer = {
  width: (font, text) => (parseFloat(/([\d.]+)px/.exec(font)![1]!) / 2) * text.length,
  baseline: (_f, b) => (b === 'middle' ? 0.34 : b === 'top' ? 0.905 : 0),
  colour: (css) => parseColour(css) ?? { r: 0, g: 0, b: 0, a: 1 },
  pixels: () => ({ rgb: new Uint8Array([255, 0, 0, 0, 255, 0]), alpha: null, w: 2, h: 1 }),
};
const page = () => new PdfCanvas(100, 50, measurer);
const k = PT_PER_MM;

describe('the stand-in context', () => {
  it('a line in millimetres comes out in points, y up from the bottom; its pen and colour set before it', () => {
    const p = page();
    p.strokeStyle = '#ff0000';
    p.lineWidth = 0.5;
    p.setLineDash([2, 1]);
    p.beginPath();
    p.moveTo(10, 10);
    p.lineTo(20, 10);
    p.stroke();
    const c = p.content();
    expect(c).toContain(`${n(10 * k)} ${n(40 * k)} m`);
    expect(c).toContain(`${n(20 * k)} ${n(40 * k)} l`);
    expect(c).toContain('1 0 0 RG');
    expect(c).toContain(`${n(0.5 * k)} w`);
    expect(c).toContain(`[${n(2 * k)} ${n(k)}] 0 d`);
    expect(c.trim().endsWith('S\nQ')).toBe(true);
  });

  it('a path kept after a fill is stroked again; even-odd is f*; a clip is W n inside its save', () => {
    const p = page();
    p.beginPath();
    p.rect(0, 0, 10, 10);
    p.fill('evenodd');
    p.stroke();
    expect(p.content().match(/ m\n/g)!.length).toBeGreaterThanOrEqual(2);
    expect(p.content()).toContain('f*');
    p.save();
    p.beginPath();
    p.rect(0, 0, 5, 5);
    p.clip();
    p.restore();
    expect(p.content()).toMatch(/q\n[^Q]*W n[\s\S]*Q$/);
  });

  it('transforms: translated, scaled and turned points; setTransform starts from the base a view pushed', () => {
    const p = page();
    p.translate(10, 0);
    p.scale(2, 2);
    p.beginPath();
    p.moveTo(1, 1);
    expect(p.content()).toBe('');
    p.stroke();
    expect(p.content()).toContain(`${n(12 * k)} ${n(48 * k)} m`);
    p.pushBase();
    p.setTransform(1, 0, 0, 1, 0, 0);
    p.beginPath();
    p.moveTo(1, 1);
    p.lineTo(2, 1);
    p.stroke();
    // Back at the pushed map (translated 10, twice the size), not the page's.
    expect(p.content()).toContain(`${n(12 * k)} ${n(48 * k)} m`);
    p.popBase();
    p.setTransform(1, 0, 0, 1, 0, 0);
    p.beginPath();
    p.moveTo(1, 1);
    p.lineTo(2, 1);
    p.stroke();
    expect(p.content()).toContain(`${n(1 * k)} ${n(49 * k)} m`);
    expect(multiply([1, 0, 0, 1, 5, 0], [2, 0, 0, 2, 0, 0])).toEqual([2, 0, 0, 2, 5, 0]);
  });

  it('a whole circle is four curves that end where they began', () => {
    const p = page();
    p.beginPath();
    p.arc(50, 25, 10, 0, Math.PI * 2);
    p.stroke();
    const curves = p.content().split('\n').filter((l) => l.endsWith(' c'));
    expect(curves).toHaveLength(4);
    expect(curves[3]!.split(' ').slice(4, 6)).toEqual([n(60 * k), n(25 * k)]);
    // A quarter: one curve, its control points 0.5523 r out along the tangents.
    const q = page();
    q.beginPath();
    q.arc(0, 0, 1, 0, Math.PI / 2);
    q.stroke();
    const [c1] = q.content().split('\n').filter((l) => l.endsWith(' c'));
    expect(Number(c1!.split(' ')[1])).toBeCloseTo((50 - 0.5523) * k, 2);
  });

  it('text: Helvetica (bold for 600 and up), upright, at its baseline, centred by its width; WinAnsi bytes', () => {
    const p = page();
    p.font = '600 4px Inter, sans-serif';
    p.textAlign = 'center';
    p.textBaseline = 'middle';
    p.fillStyle = '#000';
    p.fillText('Sala (2)', 50, 20);
    const c = p.content();
    expect(c).toContain('/F2 4 Tf');
    // 8 letters of 2 mm: 16 mm wide, its start 8 mm left; the baseline 0.34 em below the middle.
    expect(c).toContain(`1 0 0 1 ${n(42 * k)} ${n((50 - 20 - 0.34 * 4) * k)} Tm`.replace(/^1 0 0 1/, `${n(k)} 0 0 ${n(k)}`));
    expect(c).toContain('(Sala \\(2\\)) Tj');
    expect(p.fonts.has('F2')).toBe(true);
    expect(winAnsi('Térreo 30,38 m² · ≤ 2 – 3 €')).toEqual([...'T'].map((x) => x.charCodeAt(0)).concat([0xe9], [...'rreo 30,38 m'].map((x) => x.charCodeAt(0)), [0xb2, 0x20, 0xb7, 0x20, 0x3c, 0x3d, 0x20, 0x32, 0x20, 0x96, 0x20, 0x33, 0x20, 0x80]));
    expect(p.measureText('abcd').width).toBe(8);
  });

  it('colours: hex, rgb(), their alpha times the global one as a graphics state; nothing drawn when it is 0', () => {
    expect(parseColour('#f80')).toEqual({ r: 1, g: 0x88 / 255, b: 0, a: 1 });
    expect(parseColour('rgba(255, 0, 0, 0.5)')).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
    expect(parseColour('rgb(0 128 255 / 25%)')!.a).toBe(0.25);
    const p = page();
    p.globalAlpha = 0.5;
    p.fillStyle = 'rgba(0, 0, 255, 0.5)';
    p.fillRect(0, 0, 10, 10);
    expect(p.content()).toContain('/GS0_25 gs');
    expect(p.alphas.get('0.25')).toBe(0.25);
    const none = page();
    none.fillStyle = 'transparent';
    none.fillRect(0, 0, 10, 10);
    expect(none.content()).not.toContain(' f');
  });

  it('a hatch is a pattern of lines whose matrix is the map where it is filled; a picture an image under the map', () => {
    const p = page();
    p.scale(2, 2);
    const hatch = p.vectorPattern([[[0, 8], [8, 0]]], 8, '#000000', 0.75, 0.5);
    p.fillStyle = hatch as never;
    p.fillRect(0, 0, 10, 10);
    expect(p.content()).toContain('/Pattern cs /P0 scn');
    expect(p.patterns[0]!.matrix).toEqual([k, 0, 0, -k, 0, 50 * k]);
    p.drawImage({} as CanvasImageSource, 1, 2, 3, 4);
    expect(p.images).toHaveLength(1);
    expect(p.content()).toContain('/Im0 Do');
  });

  it('the file: header, its objects at the offsets the table says, a page each of the paper\'s size', async () => {
    const a = page();
    a.fillText('A', 1, 1);
    const b = new PdfCanvas(420, 297, measurer);
    b.drawImage({} as CanvasImageSource, 0, 0, 10, 10);
    const bytes = await pdfOfVectorPages([a, b], 'Térreo');
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain(`/MediaBox [0 0 ${n(420 * k)} ${n(297 * k)}]`);
    expect(text).toContain('/BaseFont /Helvetica-Bold');
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const offsets = text.slice(xref).split('\n').filter((l) => / 00000 n $/.test(l)).map((l) => Number(l.slice(0, 10)));
    offsets.forEach((o, i) => expect(text.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
});
