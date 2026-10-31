// Sections and elevations drawn from the model (phase 10), on a box worked out by hand:
// 4 × 3 m between the axes of 15 cm walls, 2.8 m high. A section across it at x = 1, looking west (−x):
// its line runs north from y = −1, so a point's distance along it is y + 1, and the walls it cuts are
// the south one (y = 0) and the north one (y = 3), each 15 cm thick from the floor to 2.8 m.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { modelSolids, sectionDims, sectionDrawing } from '../../src/elements/section/drawing';
import { featureEdges, loopsOf, outlineOf } from '../../src/elements/section/edges';
import type { Point3 } from '../../src/model/section-box';
import { elevationsAround, elevationsInside, isSectionMark, lookOf, nextSectionName, type SectionMark } from '../../src/elements/section/schema';
import { flipSections, renameSection, setSectionDepth } from '../../src/elements/section/commands';
import { readProject, writeProject } from '../../src/project/file';
import { newOpening } from '../../src/elements/opening/schema';
import { levelOfSolid } from '../../src/elements/registry';
import { sectionKind } from '../../src/elements/kinds/section';
import { oid, rid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

const box = (southY = 0): Doc => ({
  ...newDocument(),
  walls: [wall(wid('w1'), [0, southY], [4, southY]), wall(wid('w2'), [4, southY], [4, 3]), wall(wid('w3'), [4, 3], [0, 3]), wall(wid('w4'), [0, 3], [0, southY])],
});

const across: SectionMark = { id: 'sec_a', name: 'A', kind: 'section', start: { x: 1, y: -1 }, end: { x: 1, y: 4 }, depth: 5 };

/** The cut's extent along the line and up, per closed outline. */
// The outlines of what is cut: the walls' over their layers (lines alone), any other group's own; a
// wall's layers (filled in their materials) are inside them.
const extents = (d: ReturnType<typeof sectionDrawing>) =>
  d.cuts
    .filter((c) => !c.fill)
    .flatMap((c) => (c.loops.length > 0 ? c.loops : loopsOf(c.segments)))
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

  it("a wall's layers cut each in its material: plaster, brick, plaster across the 15 cm, thin lines between", () => {
    const doc = box();
    const d = sectionDrawing(doc, modelSolids(doc, deriveGeometry(doc)), across);
    const layers = d.cuts.filter((c) => c.fill);
    expect(layers.every((c) => c.pen === 'fine')).toBe(true);
    // The south wall's three layers, by their widths along the line, each with its material's pattern.
    const south = layers
      .flatMap((c) => c.loops.map((l) => ({ s0: Math.min(...l.map((p) => p.x)), s1: Math.max(...l.map((p) => p.x)), pattern: c.fill!.pattern })))
      .filter((x) => x.s1 < 2)
      .sort((a, b) => a.s0 - b.s0);
    expect(south.map((x) => Math.round((x.s1 - x.s0) * 1000) / 1000)).toEqual([0.015, 0.12, 0.015]);
    expect(south.map((x) => x.pattern)).toEqual([doc.materials.find((m) => m.id === 'plaster')!.cut, doc.materials.find((m) => m.id === 'brick')!.cut, doc.materials.find((m) => m.id === 'plaster')!.cut]);
  });

  it("its dimensions: the heights from the ground to each level and to the top, its whole length", () => {
    const box2 = { min: { x: 0.9, y: 0 }, max: { x: 4.1, y: 5.6 } };
    expect(sectionDims({ box: box2, levels: [{ name: 'T', z: 0 }, { name: 'P1', z: 2.8 }] })).toEqual({ heights: [0, 2.8, 5.6], along: [0.9, 4.1] });
    // A level at the top is the top; one below the ground is not measured from it.
    expect(sectionDims({ box: { ...box2, max: { x: 4.1, y: 2.8 } }, levels: [{ name: 'S', z: -3 }, { name: 'T', z: 0 }, { name: 'P1', z: 2.8 }] })!.heights).toEqual([0, 2.8]);
    expect(sectionDims({ box: null, levels: [] })).toBeNull();
    const doc = box();
    const dims = sectionDims(sectionDrawing(doc, modelSolids(doc, deriveGeometry(doc)), across))!;
    expect(dims.heights).toEqual([0, expect.closeTo(2.8, 6)]);
    // The length of what it cuts: the south wall's outer face to the north wall's (0.925 to 4.075 along the line).
    expect(dims.along).toEqual([expect.closeTo(0.925, 6), expect.closeTo(4.075, 6)]);
    // Cutting nothing: all it shows.
    expect(sectionDims({ box: box2, levels: [], cutBox: null })!.along).toEqual([0.9, 4.1]);
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

  it('dimensions the doors and windows it cuts and names the rooms it crosses', () => {
    // A window in the south wall from x 0.4 to 1.6 (sill 1, 1.2 high) and a door in the north one from
    // x 1.4 to 0.5 (2.1 high): the line at x = 1 cuts both. The room is the inside, faces 0.075 in.
    const doc: Doc = {
      ...box(),
      openings: [newOpening(oid('opening_w'), wid('w1'), 'window', { kind: 'fromStart', distance: 0.4 }), newOpening(oid('opening_d'), wid('w3'), 'door', { kind: 'fromEnd', distance: 0.5 })],
      rooms: [{ id: rid('room_1'), levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Sala', number: '1' }],
    };
    const g = deriveGeometry(doc);
    const d = sectionDrawing(doc, modelSolids(doc, g), across, g.rooms);
    expect(d.openings).toHaveLength(2);
    const [w, door] = d.openings;
    // The window's cut ends at the south wall's inside face at most (y 0.075, 1.075 along); the door's in the north wall.
    expect(w!.at).toBeGreaterThan(0.925);
    expect(w!.at).toBeLessThanOrEqual(1.075 + 1e-6);
    expect(w).toMatchObject({ floor: expect.closeTo(0, 6), bottom: expect.closeTo(1, 6), top: expect.closeTo(2.2, 6) });
    expect(door!.at).toBeGreaterThan(3.925 - 1e-6);
    expect(door).toMatchObject({ floor: expect.closeTo(0, 6), bottom: expect.closeTo(0, 6), top: expect.closeTo(2.1, 6) });
    // The room from y 0.075 to 2.925, so 1.075 to 3.925 along the line: its name in the middle, half its 2.8 up.
    expect(d.rooms).toEqual([{ id: 'room_1', number: '1', name: 'Sala', at: { x: expect.closeTo(2.5, 6), y: expect.closeTo(1.4, 6) } }]);
    // A section beside the house crosses no room and cuts no opening.
    const beside = sectionDrawing(doc, modelSolids(doc, g), { ...across, start: { x: 6, y: -1 }, end: { x: 6, y: 4 } }, g.rooms);
    expect(beside.rooms).toEqual([]);
    expect(beside.openings).toEqual([]);
  });

  it("a room's interior elevation sees its wall from inside, its level's height alone", () => {
    // The box twice, the upper one on a level 2.8 up; the room inside the lower box, faces 0.075 in.
    const upper = box().walls.map((w) => ({ ...w, id: wid(`${w.id}u`), levelId: 'lvl_1' }));
    const doc: Doc = { ...box(), levels: [...box().levels, { id: 'lvl_1', name: 'Upper', elevation: 2.8, height: 2.8 }], walls: [...box().walls, ...upper] };
    const inner = { min: { x: 0.075, y: 0.075 }, max: { x: 3.925, y: 2.925 } };
    const views = elevationsInside(inner, 0.01, 0.3);
    // Each looks into the room, across it to the wall it is named for, and 30 cm on into it.
    const mid = { x: 2, y: 1.5 };
    for (const v of views) {
      const look = lookOf(v);
      expect((mid.x - v.start.x) * look.x + (mid.y - v.start.y) * look.y).toBeGreaterThan(0);
    }
    const north = views.find((v) => v.side === 'north')!;
    expect(lookOf(north)).toEqual({ x: expect.closeTo(0, 9), y: 1 });
    expect(north.depth).toBeCloseTo(2.85 - 0.01 + 0.3, 9);
    const solids = modelSolids(doc, deriveGeometry(doc));
    const ground = sectionDrawing(doc, solids, { id: 'sec_n', name: '1-N', kind: 'elevation', ...north, levelId: 'lvl_ground' });
    // The north wall's inside face, 2.84 m beyond the line; nothing of the level above.
    expect(ground.faces.some((f) => Math.abs(f.depth - 2.84) < 1e-6)).toBe(true);
    expect(ground.box!.min.y).toBeCloseTo(0, 6);
    expect(ground.box!.max.y).toBeCloseTo(2.8, 6);
    expect(ground.levels.map((l) => l.name)).toEqual([doc.levels[0]!.name]);
    // Its line runs 30 cm into the side walls (from x −0.225): they are cut, the west one 0.15 to 0.3
    // along it, the east one 4.15 to 4.3, from the floor to the ceiling.
    const e = extents(ground);
    expect(e.map((x) => [x.s0, x.s1, x.z0, x.z1].map((v) => Math.round(v * 1000) / 1000))).toEqual([
      [0.15, 0.3, 0, 2.8],
      [4.15, 4.3, 0, 2.8],
    ]);
    // On the upper level: from its floor, 2.8, to its ceiling; its dimensions measured from its floor.
    const up = sectionDrawing(doc, solids, { id: 'sec_n2', name: '1-N', kind: 'elevation', ...north, levelId: 'lvl_1' });
    expect(up.box!.min.y).toBeCloseTo(2.8, 6);
    expect(up.box!.max.y).toBeCloseTo(5.6, 6);
    expect(up.base).toBe(2.8);
    expect(sectionDims(up)!.heights).toEqual([2.8, expect.closeTo(5.6, 6)]);
    // Without a level, the whole height as before.
    const whole = sectionDrawing(doc, solids, { id: 'sec_n3', name: 'N', kind: 'elevation', ...north });
    expect(whole.box!.max.y).toBeCloseTo(5.6, 6);
    expect(whole.base).toBe(0);
  });

  it("a room's elevation is on its level's plan alone, and kept so in the file", () => {
    const inside: SectionMark = { ...across, kind: 'elevation', levelId: 'lvl_ground' };
    expect(levelOfSolid(sectionKind as never, inside)).toBe('lvl_ground');
    expect(levelOfSolid(sectionKind as never, across)).toBeNull();
    expect(isSectionMark(inside)).toBe(true);
    expect(isSectionMark({ ...inside, levelId: 3 })).toBe(false);
    const r = readProject(writeProject({ ...box(), sections: [inside] }));
    expect(r.ok && r.doc.sections).toEqual([inside]);
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

  it('kept in the file', () => {
    const doc: Doc = { ...box(), sections: [across] };
    const r = readProject(writeProject(doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.sections).toEqual([across]);
  });

  it('an older file has none', () => {
    const r = readProject(JSON.stringify({ ...box(), version: 30, sections: undefined }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.sections).toEqual([]);
  });
});
