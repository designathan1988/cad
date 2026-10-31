// A wall's top up to another level, or under the roof (HeightRule 'toLevel' and 'roof'): its height,
// its 3D blocks following the roof's slope, the roof's own gable infill left out where such a wall
// closes it, and a level deleted under a wall that went up to it.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument, wallHeights } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { edgesFor, type Roof } from '../../src/elements/roof/schema';
import { planeAt } from '../../src/elements/wall/geometry/under-roof';
import { deleteLevel } from '../../src/elements/level/commands';
import { readProject, writeProject } from '../../src/project/file';
import { lid, tid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

// A 10 × 6 m outline, gable roof at 30 %: its two slopes rise from the long sides (y = 0 and y = 6),
// the ridge at y = 3, 0.9 m over the eaves (2.8 m).
const outline = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 6 },
  { x: 0, y: 6 },
];
const roof: Roof = { id: 'roof_r', levelId: lid('lvl_ground'), outline, edges: edgesFor('gable', outline, 30, 0), kind: 'gable', thickness: 0.12, baseOffset: 0 };
const wall = (id: WallId, a: [number, number], b: [number, number], top?: DocWall['top']): DocWall => ({
  id,
  wallTypeId: tid('wt_masonry15'),
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: lid('lvl_ground'),
  ...(top ? { top } : {}),
});
const docOf = (walls: DocWall[], roofs: Roof[] = [roof]): Doc => ({ ...newDocument(), walls, roofs });

describe('a wall under the roof', () => {
  // The gable end x = 0, across the slopes: its top rises to the ridge in the middle.
  const gable = wall(wid('wall_g'), [0, 0], [0, 6], { kind: 'roof' });

  it('reaches as high as the roof over it: the ridge, 2.8 + 3 × 0.3', () => {
    const h = wallHeights(docOf([gable]), gable);
    expect(h.bottom).toBe(0);
    // The band looked at is a little wider than the wall: never under the ridge's height.
    expect(h.top).toBeCloseTo(3.7, 2);
  });

  it('its blocks follow the slope: at the eaves 2.8 m, at the ridge 3.7 m, never above the roof', () => {
    const s = deriveGeometry(docOf([gable])).solids.get(wid('wall_g'))!;
    const tops = (y: number) =>
      s.blocks.flatMap((b) => (b.polygon.some((p) => Math.abs(p.y - y) < 1e-6) ? [b.plane ? planeAt(b.plane, { x: 0, y }) : b.top] : []));
    expect(Math.max(...tops(3))).toBeCloseTo(3.7, 6);
    for (const b of s.blocks) for (const p of b.polygon) expect(b.plane ? planeAt(b.plane, p) : b.top).toBeLessThanOrEqual(2.8 + 0.3 * Math.min(p.y, 6 - p.y) + 1e-6);
    expect(s.blocks.some((b) => b.plane)).toBe(true);
  });

  it("the roof leaves out its gable infill on that side, and keeps the other one's", () => {
    const shown = (walls: DocWall[]) => (deriveGeometry(docOf(walls)).kinds.get('roofs')!.get('roof_r') as { gables: unknown[] }).gables.length;
    expect(shown([])).toBe(2);
    expect(shown([gable])).toBe(1);
    expect(shown([{ ...gable, top: { kind: 'level', offset: 0 } }])).toBe(2);
  });

  it('with no roof over it, it keeps its level’s height', () => {
    const h = wallHeights(docOf([gable], []), gable);
    expect(h.top).toBeCloseTo(2.8, 9);
    expect(deriveGeometry(docOf([gable], [])).solids.get(wid('wall_g'))!.blocks.every((b) => !b.plane)).toBe(true);
  });
});

describe('a wall up to a level', () => {
  const base = newDocument();
  const levels = [...base.levels, { id: lid('lvl_up'), name: 'Upper', elevation: 3, height: 2.8 }];
  const up = wall(wid('wall_u'), [0, 0], [4, 0], { kind: 'toLevel', levelId: lid('lvl_up'), offset: 0.5 });
  const doc: Doc = { ...base, levels, walls: [up] };

  it("reaches that level's floor plus its offset", () => {
    expect(wallHeights(doc, up).top).toBeCloseTo(3.5, 9);
  });

  it('keeps its height, fixed, when that level is deleted', () => {
    const after = deleteLevel(lid('lvl_up')).apply(doc);
    expect(after.levels.map((l) => l.id)).toEqual(['lvl_ground']);
    expect(after.walls[0]!.top).toEqual({ kind: 'fixed', height: 3.5 });
  });

  it('reads back from a file, as does a wall under the roof', () => {
    const both: Doc = { ...doc, walls: [up, wall(wid('wall_r'), [0, 1], [4, 1], { kind: 'roof' })] };
    const r = readProject(writeProject(both));
    expect(r.ok && r.doc.walls.map((w) => w.top)).toEqual([up.top, { kind: 'roof' }]);
    expect(r.ok && r.fixes).toEqual([]);
  });
});
