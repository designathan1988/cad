// Sections and elevations drawn from the model, and sheets (phase 10), on a box worked out by hand:
// 4 × 3 m between the axes of 15 cm walls, 2.8 m high. A section across it at x = 1, looking west (−x):
// its line runs north from y = −1, so a point's distance along it is y + 1, and the walls it cuts are
// the south one (y = 0) and the north one (y = 3), each 15 cm thick from the floor to 2.8 m.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { featureEdges, loopsOf, modelSolids, outlineOf, sectionDrawing } from '../../src/app/section-drawing';
import type { Point3 } from '../../src/app/section-box';
import { elevationsAround, isSectionMark, lookOf, nextSectionName, type SectionMark } from '../../src/elements/section/schema';
import { flipSections, renameSection, setSectionDepth } from '../../src/elements/section/commands';
import { addSheet, addViewport, deleteSheet, moveSheet, sheetsOf, updateSheet, updateViewport } from '../../src/elements/sheet/commands';
import { drawingArea, frameOf, isSheet, isViewport, nextSheetNumber, type Sheet } from '../../src/elements/sheet/schema';
import { readProject, writeProject } from '../../src/io/project-file';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

const box = (southY = 0): Doc => ({
  ...newDocument(),
  walls: [wall('w1', [0, southY], [4, southY]), wall('w2', [4, southY], [4, 3]), wall('w3', [4, 3], [0, 3]), wall('w4', [0, 3], [0, southY])],
});

const across: SectionMark = { id: 'sec_a', name: 'A', kind: 'section', start: { x: 1, y: -1 }, end: { x: 1, y: 4 }, depth: 5 };

/** The cut's extent along the line and up, per closed outline. */
const extents = (d: ReturnType<typeof sectionDrawing>) =>
  d.cuts
    .flatMap((c) => c.loops)
    .map((l) => ({ s0: Math.min(...l.map((p) => p.x)), s1: Math.max(...l.map((p) => p.x)), z0: Math.min(...l.map((p) => p.y)), z1: Math.max(...l.map((p) => p.y)) }))
    .sort((a, b) => a.s0 - b.s0);

describe('a section drawn from the model', () => {
  it('fills the two walls its line cuts, each its thickness wide and the wall high', () => {
    const doc = box();
    const d = sectionDrawing(doc, modelSolids(doc, deriveGeometry(doc)), across);
    const e = extents(d);
    expect(e).toHaveLength(2);
    // The south wall: y from −0.075 to 0.075, so 0.925 to 1.075 along the line; the north one 3.925 to 4.075.
    expect(e[0]!.s0).toBeCloseTo(0.925, 6);
    expect(e[0]!.s1).toBeCloseTo(1.075, 6);
    expect(e[1]!.s0).toBeCloseTo(3.925, 6);
    expect(e[1]!.s1).toBeCloseTo(4.075, 6);
    for (const x of e) {
      expect(x.z0).toBeCloseTo(0, 6);
      expect(x.z1).toBeCloseTo(2.8, 6);
    }
  });

  it('moving a wall moves its cut: the drawing follows the model', () => {
    const doc = box(-0.5);
    const e = extents(sectionDrawing(doc, modelSolids(doc, deriveGeometry(doc)), across));
    expect(e[0]!.s0).toBeCloseTo(0.425, 6);
    expect(e[0]!.s1).toBeCloseTo(0.575, 6);
  });

  it('sees the west wall beyond its line, and nothing past its depth', () => {
    const doc = box();
    const solids = modelSolids(doc, deriveGeometry(doc));
    const seen = sectionDrawing(doc, solids, across).faces.filter((f) => f.depth > 0.5);
    expect(seen.length).toBeGreaterThan(0);
    // The west wall's east face is 1 − 0.075 = 0.925 m beyond the line.
    expect(seen.some((f) => Math.abs(f.depth - 0.925) < 1e-6)).toBe(true);
    const short = sectionDrawing(doc, solids, { ...across, depth: 0.5 });
    expect(short.faces.every((f) => f.depth <= 0.5 + 1e-9)).toBe(true);
  });

  it('looking the other way, it sees the east wall instead', () => {
    const doc = box();
    const back = sectionDrawing(doc, modelSolids(doc, deriveGeometry(doc)), { ...across, start: across.end, end: across.start });
    // The east wall's west face: 4 − 0.075 − 1 = 2.925 m beyond the line.
    expect(back.faces.some((f) => Math.abs(f.depth - 2.925) < 1e-6)).toBe(true);
    expect(back.faces.some((f) => Math.abs(f.depth - 0.925) < 1e-6)).toBe(false);
  });

  it('marks every level at its height', () => {
    const doc = { ...box(), levels: [...box().levels, { id: 'lvl_1', name: 'Upper', elevation: 2.8, height: 2.8 }] };
    const d = sectionDrawing(doc, modelSolids(doc, deriveGeometry(doc)), across);
    expect(d.levels.map((l) => l.z)).toEqual([0, 2.8]);
  });
});

describe('the lines of a face', () => {
  const p = (x: number, y: number, z: number): Point3 => ({ x, y, z });
  it('two triangles of one square: its four sides, not the diagonal between them', () => {
    const tris = [
      [p(0, 0, 0), p(1, 0, 0), p(1, 0, 1)],
      [p(0, 0, 0), p(1, 0, 1), p(0, 0, 1)],
    ] as const;
    const f = featureEdges(tris);
    // Edge 2 of the first (1,0,1 → 0,0,0) and edge 0 of the second (0,0,0 → 1,0,1) are the diagonal.
    expect(f[0]![2]).toEqual([]);
    expect(f[1]![0]).toEqual([]);
    expect(f[0]![0]).toEqual([[0, 1]]);
    expect(f[1]![2]).toEqual([[0, 1]]);
  });

  it('a face joining another along part of its edge keeps a line only where nothing goes on', () => {
    // A long bottom strip and, over half of its top edge, another strip of the same face.
    const tris = [
      [p(0, 0, 0), p(2, 0, 0), p(2, 0, 1)],
      [p(0, 0, 0), p(2, 0, 1), p(0, 0, 1)],
      [p(0, 0, 1), p(1, 0, 1), p(1, 0, 2)],
      [p(0, 0, 1), p(1, 0, 2), p(0, 0, 2)],
    ] as const;
    const f = featureEdges(tris);
    // The bottom strip's top edge (second triangle, edge 1: 2,0,1 → 0,0,1): a line only from x 2 to 1.
    expect(f[1]![1]).toHaveLength(1);
    expect(f[1]![1]![0]![0]).toBeCloseTo(0, 9);
    expect(f[1]![1]![0]![1]).toBeCloseTo(0.5, 9);
  });

  it('two faces at a right angle keep their edge', () => {
    const tris = [
      [p(0, 0, 0), p(1, 0, 0), p(1, 0, 1)],
      [p(1, 0, 0), p(1, 1, 0), p(1, 1, 1)],
      [p(1, 0, 0), p(1, 1, 1), p(1, 0, 1)],
    ] as const;
    const f = featureEdges(tris);
    // The first's edge 1 (1,0,0 → 1,0,1) is the corner.
    expect(f[0]![1]).toEqual([[0, 1]]);
  });

  it('two layers side by side, split at other heights: one outline round both, nothing between them', () => {
    // Layer one from x 0 to 1, layer two from 1 to 3, each 2 high, their shared side cut in pieces at 0.7 and 1.2.
    const segs = [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 1, y: 0 }, { x: 3, y: 0 }],
      [{ x: 3, y: 0 }, { x: 3, y: 2 }],
      [{ x: 3, y: 2 }, { x: 1, y: 2 }],
      [{ x: 1, y: 2 }, { x: 0, y: 2 }],
      [{ x: 0, y: 2 }, { x: 0, y: 0 }],
      [{ x: 1, y: 0 }, { x: 1, y: 0.7 }],
      [{ x: 1, y: 0.7 }, { x: 1, y: 2 }],
      [{ x: 1, y: 0 }, { x: 1, y: 1.2 }],
      [{ x: 1, y: 1.2 }, { x: 1, y: 2 }],
    ] as const;
    const out = outlineOf(segs);
    expect(out.some(([a, b]) => Math.abs(a.x - 1) < 1e-9 && Math.abs(b.x - 1) < 1e-9)).toBe(false);
    const loops = loopsOf(out);
    expect(loops).toHaveLength(1);
    const xs = loops[0]!.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(0, 9);
    expect(Math.max(...xs)).toBeCloseTo(3, 9);
  });

  it('cut segments end to end make closed outlines; an open run is left out', () => {
    const square = [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 1, y: 1 }, { x: 1, y: 0 }],
      [{ x: 1, y: 1 }, { x: 0, y: 1 }],
      [{ x: 0, y: 1 }, { x: 0, y: 0 }],
      [{ x: 5, y: 5 }, { x: 6, y: 5 }],
    ] as const;
    const loops = loopsOf(square);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
  });
});

describe('section marks', () => {
  it('a new section is lettered on from the last; a mark looks to the left of its line', () => {
    expect(nextSectionName([])).toBe('A');
    expect(nextSectionName([across, { ...across, id: 'sec_b', name: 'B' }])).toBe('C');
    expect(lookOf(across)).toEqual({ x: -1, y: 0 });
  });

  it('the four elevations stand outside the box, each looking into it, deep enough to see across it', () => {
    const b = { min: { x: 0, y: 0 }, max: { x: 4, y: 3 } };
    const mid = { x: 2, y: 1.5 };
    for (const e of elevationsAround(b, 3)) {
      const look = lookOf(e);
      expect((mid.x - e.start.x) * look.x + (mid.y - e.start.y) * look.y).toBeGreaterThan(0);
      const far = Math.max(...[b.min, b.max, { x: 0, y: 3 }, { x: 4, y: 0 }].map((c) => (c.x - e.start.x) * look.x + (c.y - e.start.y) * look.y));
      expect(e.depth).toBeGreaterThanOrEqual(far);
    }
  });

  it('commands: renamed, deepened and turned round, each refusing what is not one', () => {
    const doc = { ...box(), sections: [across, { ...across, id: 'sec_b', name: 'B' }] };
    expect(renameSection('sec_a', 'B').apply(doc)).toBe(doc);
    expect(renameSection('sec_a', '  ').apply(doc)).toBe(doc);
    expect(renameSection('sec_a', 'C').apply(doc).sections[0]!.name).toBe('C');
    expect(setSectionDepth(['sec_a'], -1).apply(doc)).toBe(doc);
    expect(setSectionDepth(['sec_a'], 12).apply(doc).sections[0]!.depth).toBe(12);
    const flipped = flipSections(['sec_a']).apply(doc).sections[0]!;
    expect(flipped.start).toEqual(across.end);
    expect(lookOf(flipped)).toEqual({ x: 1, y: 0 });
  });

  it('a mark read from a file is checked', () => {
    expect(isSectionMark(across)).toBe(true);
    expect(isSectionMark({ ...across, depth: 0 })).toBe(false);
    expect(isSectionMark({ ...across, end: across.start })).toBe(false);
    expect(isSectionMark({ ...across, kind: 'plan' })).toBe(false);
  });
});

describe('sheets', () => {
  const sheet: Sheet = {
    id: 'sheet_1',
    number: 'A-01',
    name: 'Planta',
    paper: 'A3',
    landscape: true,
    viewports: [{ id: 'vp_1', kind: 'plan', levelId: 'lvl_ground', den: 50, at: { x: 100, y: 80 }, w: 120, h: 90, center: { x: 2, y: 1.5 } }],
  };

  it('numbered on from the highest A-nn', () => {
    expect(nextSheetNumber([])).toBe('A-01');
    expect(nextSheetNumber([sheet, { ...sheet, id: 'sheet_2', number: 'A-07' }, { ...sheet, id: 'sheet_3', number: 'Capa' }])).toBe('A-08');
  });

  it('a view is checked: its scale one offered, its size positive, its schedule one there is', () => {
    expect(isViewport(sheet.viewports[0])).toBe(true);
    expect(isViewport({ ...sheet.viewports[0], den: 33 })).toBe(false);
    expect(isViewport({ ...sheet.viewports[0], h: 0 })).toBe(false);
    expect(isViewport({ id: 'vp_2', kind: 'schedule', schedule: 'rooms', at: { x: 10, y: 10 }, w: 100 })).toBe(true);
    expect(isViewport({ id: 'vp_2', kind: 'schedule', schedule: 'cats', at: { x: 10, y: 10 }, w: 100 })).toBe(false);
    expect(isViewport({ id: 'vp_3', kind: 'section', sectionId: 'sec_a', den: 100, at: { x: 10, y: 10 }, w: 100, h: 50, center: { x: 0, y: 1 } })).toBe(true);
    expect(isSheet({ ...sheet, paper: 'B5' })).toBe(false);
  });

  it('a view framed round its middle; the drawing area keeps clear of the border and the title block', () => {
    expect(frameOf(sheet.viewports[0]!)).toEqual({ x0: 40, y0: 35, x1: 160, y1: 125 });
    const a = drawingArea(sheet);
    expect(a.x0).toBeGreaterThan(10);
    expect(a.y1).toBeLessThan(297 - 10 - 36);
  });

  it('commands: added, renumbered (not to one taken), reordered, a view moved, deleted', () => {
    let doc: Doc = addSheet(sheet).apply(box());
    doc = addSheet({ ...sheet, id: 'sheet_2', number: 'A-02', viewports: [] }).apply(doc);
    expect(sheetsOf(doc).map((s) => s.number)).toEqual(['A-01', 'A-02']);
    expect(updateSheet('sheet_2', { number: 'A-01' }).apply(doc)).toBe(doc);
    expect(updateSheet('sheet_2', { number: ' ' }).apply(doc)).toBe(doc);
    expect(sheetsOf(updateSheet('sheet_2', { name: 'Cortes', landscape: false }).apply(doc))[1]).toMatchObject({ name: 'Cortes', landscape: false });
    expect(sheetsOf(moveSheet('sheet_2', -1).apply(doc)).map((s) => s.id)).toEqual(['sheet_2', 'sheet_1']);
    expect(moveSheet('sheet_1', -1).apply(doc)).toBe(doc);
    const moved = updateViewport('sheet_1', 'vp_1', { at: { x: 150, y: 100 } }).apply(doc);
    expect(sheetsOf(moved)[0]!.viewports[0]).toMatchObject({ id: 'vp_1', kind: 'plan', at: { x: 150, y: 100 } });
    // A change that would make it no view at all changes nothing.
    expect(updateViewport('sheet_1', 'vp_1', { w: -5 }).apply(doc)).toBe(doc);
    const more = addViewport('sheet_2', { id: 'vp_9', kind: 'schedule', schedule: 'sheets', at: { x: 20, y: 20 }, w: 80 }).apply(doc);
    expect(sheetsOf(more)[1]!.viewports).toHaveLength(1);
    expect(sheetsOf(deleteSheet('sheet_1').apply(doc)).map((s) => s.id)).toEqual(['sheet_2']);
  });

  it('kept in the file with the sections; a view that is not one is left out', () => {
    const doc: Doc = { ...box(), sections: [across], sheets: [{ ...sheet, viewports: [...sheet.viewports, { id: 'vp_x', kind: 'plan' } as never] }] };
    const r = readProject(writeProject(doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.sections).toEqual([across]);
    expect(sheetsOf(r.doc)).toEqual([sheet]);
  });

  it('an older file has neither', () => {
    const r = readProject(JSON.stringify({ ...box(), version: 30, sections: undefined, sheets: undefined }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.sections).toEqual([]);
    expect(r.doc.sheets).toBeUndefined();
  });
});
