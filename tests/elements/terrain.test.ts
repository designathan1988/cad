// The terrain (phase 11): heights between spot heights, its surface cut to its outline, its contour lines.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { earthworksOf } from '../../src/elements/terrain/earthworks';
import { deriveTerrain } from '../../src/elements/terrain/derive';
import { heightAt, isTerrain, type Terrain } from '../../src/elements/terrain/schema';
import { readProject, writeProject } from '../../src/io/project-file';
import { SOIL_DEPTH, soilBlock } from '../../src/elements/kinds/terrain';

const square = (w: number) => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: w },
  { x: 0, y: w },
];
const area = (tris: ReturnType<typeof deriveTerrain>['tris']) =>
  tris.reduce((s, r) => s + Math.abs((r[3] - r[0]) * (r[7] - r[1]) - (r[6] - r[0]) * (r[4] - r[1])) / 2, 0);

describe('terrain', () => {
  it('a height between spots: their own at them, between them weighted by distance, 0 with none', () => {
    const spots = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 2 },
    ];
    expect(heightAt(spots, { x: 0, y: 0 })).toBe(0);
    expect(heightAt(spots, { x: 10, y: 0 })).toBe(2);
    expect(heightAt(spots, { x: 5, y: 0 })).toBeCloseTo(1, 9);
    expect(heightAt([], { x: 3, y: 3 })).toBe(0);
  });

  it('flat with no spots: its surface covers its outline, no contour but the zero one', () => {
    const t: Terrain = { id: 'terrain_1', levelId: 'lvl_ground', outline: square(20), spots: [], interval: 0.5 };
    const s = deriveTerrain(t);
    expect(area(s.tris)).toBeCloseTo(400, 6);
    expect(s.bottom).toBe(0);
    expect(s.top).toBe(0);
  });

  it('in 3D a block of soil under it: its sides down from its border to 1.50 m under its lowest point, its bottom its outline', () => {
    const t: Terrain = { id: 'terrain_1', levelId: 'lvl_ground', outline: square(20), spots: [{ x: 0, y: 0, z: 0 }, { x: 20, y: 20, z: 2 }], interval: 0.5 };
    const s = deriveTerrain(t);
    const pos = soilBlock(s).getAttribute('position');
    const ys = Array.from({ length: pos.count }, (_, i) => pos.getY(i));
    expect(Math.min(...ys)).toBeCloseTo(s.bottom - SOIL_DEPTH, 9);
    // Its top: the border's own heights, never over the surface.
    expect(Math.max(...ys)).toBeLessThanOrEqual(s.top + 1e-9);
    // Its bottom (the triangles all at the base): the outline's 400 m².
    let bottom = 0;
    for (let i = 0; i < pos.count; i += 3) {
      if ([0, 1, 2].some((k) => Math.abs(pos.getY(i + k) - (s.bottom - SOIL_DEPTH)) > 1e-9)) continue;
      const [ax, az, bx, bz, cx, cz] = [pos.getX(i), pos.getZ(i), pos.getX(i + 1), pos.getZ(i + 1), pos.getX(i + 2), pos.getZ(i + 2)];
      bottom += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    }
    expect(bottom).toBeCloseTo(400, 6);
  });

  it('an object out of doors stands on the terrain under it; on a floor it stands on its level', () => {
    const base = newDocument();
    const def = base.definitions[0]!;
    const spots = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 20, z: 2 }];
    const object = { id: 'object_1', levelId: 'lvl_ground', definitionId: def.id, typeId: 'standard', at: { x: 14, y: 12 }, angle: 0, elevation: 0, values: {} };
    const doc: Doc = { ...base, terrains: [{ id: 'terrain_1', levelId: 'lvl_ground', outline: square(20), spots, interval: 0.5 }], objects: [object] };
    const floorOf = (d: Doc) => (deriveGeometry(d).kinds.get('objects')?.get('object_1') as { floor: number }).floor;
    expect(floorOf(doc)).toBeCloseTo(heightAt(spots, object.at), 9);
    expect(floorOf(doc)).toBeGreaterThan(0.5);
    // On a floor drawn round it: on its level's floor, the terrain under the slab left alone.
    const slab = { id: 'floor_1', levelId: 'lvl_ground', source: { kind: 'outline' as const, points: square(20).map((p) => ({ x: p.x * 0.9 + 1, y: p.y * 0.9 + 1 })) }, thickness: 0.12, offset: 0 };
    expect(floorOf({ ...doc, floors: [slab as never] })).toBe(0);
    // Off the terrain: its level's floor.
    expect(floorOf({ ...doc, objects: [{ ...object, at: { x: 30, y: 30 } }] })).toBe(0);
  });

  it('an L-shaped lot: the surface is the L, not its box', () => {
    const l = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ];
    const s = deriveTerrain({ id: 'terrain_2', levelId: 'lvl_ground', outline: l, spots: [], interval: 0.5 });
    expect(area(s.tris)).toBeCloseTo(300, 4);
  });

  it('a slope of 2 m across 20 m: contour lines at each half metre between, running across it', () => {
    const t: Terrain = {
      id: 'terrain_3',
      levelId: 'lvl_ground',
      outline: square(20),
      spots: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 20, z: 0 },
        { x: 20, y: 0, z: 2 },
        { x: 20, y: 20, z: 2 },
      ],
      interval: 0.5,
    };
    const s = deriveTerrain(t);
    expect(s.bottom).toBeCloseTo(0, 6);
    expect(s.top).toBeCloseTo(2, 6);
    const levels = s.contours.map((c) => c.z);
    expect(levels).toEqual(expect.arrayContaining([0.5, 1, 1.5]));
    // The metre line crosses the lot from south to north, about halfway east.
    const one = s.contours.find((c) => c.z === 1)!;
    const ys = one.segments.flatMap(([a, b]) => [a.y, b.y]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(18);
    const xs = one.segments.flatMap(([a, b]) => [a.x, b.x]);
    expect(Math.abs(xs.reduce((p, q) => p + q, 0) / xs.length - 10)).toBeLessThan(1.5);
  });

  it('checked when read and kept in the file', () => {
    const t: Terrain = { id: 'terrain_1', levelId: 'lvl_ground', outline: square(10), spots: [{ x: 1, y: 1, z: 0.4 }], interval: 0.5 };
    expect(isTerrain(t)).toBe(true);
    expect(isTerrain({ ...t, outline: square(10).slice(0, 2) })).toBe(false);
    expect(isTerrain({ ...t, interval: 0 })).toBe(false);
    const r = readProject(writeProject({ ...newDocument(), terrains: [t] }));
    expect(r.ok && r.doc.terrains).toEqual([t]);
  });
});

describe('cut and fill', () => {
  const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({ id, wallTypeId: 'wt_masonry15', start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, referenceLine: 'centerline', levelId: 'lvl_ground', baseOffset: 0, top: { kind: 'level', offset: 0 } });
  const house = (z: number): Doc => ({
    ...newDocument(),
    walls: [wall('s', [0, 0], [4, 0]), wall('e', [4, 0], [4, 3]), wall('n', [4, 3], [0, 3]), wall('w', [0, 3], [0, 0])],
    rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Sala', number: '1' }],
    terrains: [{ id: 'terrain_1', levelId: 'lvl_ground', outline: square(20), spots: [{ x: 10, y: 10, z }], interval: 0.5 }],
  });

  it('flat ground 50 cm over the floor: the whole footprint cut 50 cm deep; 30 cm under it, filled', () => {
    // The walls' outer faces: 4.15 × 3.15 m; the 10 cm grid's cells along the edge make it a little off.
    const a = earthworksOf(house(0.5), deriveGeometry(house(0.5)))!;
    expect(a.area).toBeCloseTo(4.15 * 3.15, 0);
    expect(Math.abs(a.cut - 0.5 * 4.15 * 3.15)).toBeLessThan(0.15);
    expect(a.fill).toBe(0);
    const b = earthworksOf(house(-0.3), deriveGeometry(house(-0.3)))!;
    expect(b.cut).toBe(0);
    expect(Math.abs(b.fill - 0.3 * 4.15 * 3.15)).toBeLessThan(0.1);
  });

  it('no spot height, no answer', () => {
    const doc: Doc = { ...house(0), terrains: [] };
    expect(earthworksOf(doc, deriveGeometry(doc))).toBeNull();
  });
});
