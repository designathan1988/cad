// The drawing scale and the pens (phase 9): pens heavier at a larger scale, the detail each scale shows,
// settings kept in the file and changed by one command.

import { describe, expect, it } from 'vitest';
import { drawingOf, newDocument } from '../../src/project/doc';
import { DEFAULT_DRAWING, detailOf, isDrawingSettings, scaleFactor, SCALES } from '../../src/elements/drawing/schema';
import { readProject, writeProject } from '../../src/io/project-file';
import { setDrawing } from '../../src/ui/drawing-dialog';

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
