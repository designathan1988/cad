// The drawing scale, the pens and the printed plan (phase 9): pens heavier at a larger scale, the
// detail each scale shows, settings kept in the file and changed by one command, and the PDF a valid
// one whose picture comes back as it went in.

import { describe, expect, it } from 'vitest';
import { drawingOf, newDocument } from '../../src/app/document';
import { DEFAULT_DRAWING, detailOf, isDrawingSettings, scaleFactor, SCALES } from '../../src/elements/drawing/schema';
import { readProject, writeProject } from '../../src/io/project-file';
import { pdfOfRgb, pdfText } from '../../src/io/pdf';
import { setDrawing } from '../../src/ui/print-dialog';
import { fitOf, paperSize } from '../../src/app/print';
import type { DerivedGeometry } from '../../src/app/geometry';

const text = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe('drawing scale and pens', () => {
  it('pens are heavier at a larger scale and lighter at a smaller one, 1:100 as set', () => {
    expect(scaleFactor(100)).toBe(1);
    expect(scaleFactor(50)).toBeGreaterThan(1);
    expect(scaleFactor(200)).toBeLessThan(1);
    for (let i = 1; i < SCALES.length; i++) expect(scaleFactor(SCALES[i]!)).toBeLessThanOrEqual(scaleFactor(SCALES[i - 1]!));
  });

  it('the detail: layers at 1:50 and larger, outlines at 1:100, less at 1:200 and smaller', () => {
    expect([20, 25, 50].map(detailOf)).toEqual(['fine', 'fine', 'fine']);
    expect([75, 100].map(detailOf)).toEqual(['medium', 'medium']);
    expect([200, 250, 500].map(detailOf)).toEqual(['coarse', 'coarse', 'coarse']);
  });

  it('settings out of range are refused, by the file and by the command', () => {
    expect(isDrawingSettings(DEFAULT_DRAWING)).toBe(true);
    expect(isDrawingSettings({ ...DEFAULT_DRAWING, scale: 33 })).toBe(false);
    expect(isDrawingSettings({ ...DEFAULT_DRAWING, pens: { ...DEFAULT_DRAWING.pens, cut: 0 } })).toBe(false);
    const doc = newDocument();
    expect(setDrawing({ ...DEFAULT_DRAWING, scale: 33 }).apply(doc)).toBe(doc);
    expect(setDrawing(DEFAULT_DRAWING).apply(doc)).toBe(doc);
    const changed = setDrawing({ ...DEFAULT_DRAWING, scale: 100 }).apply(doc);
    expect(drawingOf(changed).scale).toBe(100);
  });

  it('a project keeps its scale and pens in its file; one without them reads with the defaults', () => {
    const doc = { ...newDocument(), drawing: { scale: 100, pens: { cut: 0.5, seen: 0.25, fine: 0.1, annotation: 0.15 } } };
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc.drawing).toEqual(doc.drawing);
    const bad = readProject(JSON.stringify({ ...newDocument(), drawing: { scale: 7 } }));
    expect(bad.ok && drawingOf(bad.doc)).toEqual(DEFAULT_DRAWING);
  });
});

describe('the printed plan', () => {
  it("the paper's size as it is turned", () => {
    expect(paperSize({ paper: 'A3', landscape: true })).toEqual({ w: 420, h: 297 });
    expect(paperSize({ paper: 'A3', landscape: false })).toEqual({ w: 297, h: 420 });
  });

  it('fits a 26 m plan on A2 at 1:50 and on A4 at 1:100, not on A4 at 1:50', () => {
    const g = { rooms: new Map([['r', { room: { id: 'r' }, outline: [{ x: 0, y: 0 }, { x: 26, y: 0 }, { x: 26, y: 12 }, { x: 0, y: 12 }] }]]), kinds: new Map() } as unknown as DerivedGeometry;
    expect(fitOf(g, { levelId: 'l', den: 50, paper: 'A2', landscape: true }).fits).toBe(true);
    expect(fitOf(g, { levelId: 'l', den: 100, paper: 'A4', landscape: true }).fits).toBe(true);
    const no = fitOf(g, { levelId: 'l', den: 50, paper: 'A4', landscape: true });
    expect(no.fits).toBe(false);
    expect(no.need).toEqual({ w: 26, h: 12 });
    // 277 mm across at 1:50: 13.85 m.
    expect(no.room.w).toBeCloseTo(13.85, 9);
  });

  it('is a valid PDF: the page in points, the xref pointing at each object, the picture inflating back', async () => {
    const w = 3;
    const h = 2;
    const rgb = new Uint8Array(Array.from({ length: w * h * 3 }, (_, i) => (i * 37) % 256));
    const pdf = await pdfOfRgb(rgb, w, h, 210, 297, 'Térreo · 1:50');
    const s = text(pdf);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(s).toContain(`/Title ${pdfText('Térreo · 1:50')}`);
    const offsets = [...s.matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(6);
    offsets.forEach((o, i) => expect(s.startsWith(`${i + 1} 0 obj\n`, o)).toBe(true));
    const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe('xref');
    const m = /\/Length (\d+) >>\nstream\n/.exec(s.slice(s.indexOf('/Subtype /Image')))!;
    const at = s.indexOf('/Subtype /Image') + m.index + m[0].length;
    expect(await inflate(pdf.slice(at, at + Number(m[1])))).toEqual(rgb);
  });

  it('writes a title in UTF-16, accents and all', () => {
    expect(pdfText('é')).toBe('<FEFF00E9>');
  });
});
