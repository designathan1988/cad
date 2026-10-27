// Construction quantities out of the layers (phase 11, diferenciais 6): blocks, their mortar, plaster
// per face, the rooms' finishes by piece, the doors' and windows' holes taken off; a wall's modulation.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { demolitionQuantities, finishQuantities, layerQuantities, modulation, mortarFor, piecesFor } from '../../src/app/quantities';
import { type Naming, schedule } from '../../src/app/schedules';
import { newOpening } from '../../src/elements/opening/schema';

const wall = (id: string, a: [number, number], b: [number, number], type = 'wt_masonry15'): DocWall => ({
  id,
  wallTypeId: type,
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

const naming: Naming = {
  name: (s) => s,
  wallTag: (n) => `Parede ${n}`,
  outside: 'exterior',
  use: (u) => u,
  markPrefix: { door: 'P', window: 'J' },
  model: () => '',
  material: (id) => id,
  term: (key, vars) => (vars ? `${key} ${Object.values(vars).join(' ')}` : key),
  number: (v, places) => v.toFixed(places),
};

// One masonry wall 6 m long, 2.80 m high (the level's), with a door of 0.80 × 2.10 in it.
const one: Doc = {
  ...newDocument(),
  walls: [wall('a', [0, 0], [6, 0])],
  openings: [newOpening('d', 'a', 'door', { kind: 'centered' }, { width: 0.8, height: 2.1 })],
};

describe('construction quantities', () => {
  it('a masonry wall: blocks and their mortar over its net area, plaster on each face', () => {
    const q = layerQuantities(one, deriveGeometry(one));
    expect(q.map((x) => [x.place, x.function, x.materialId])).toEqual([
      ['exterior', 'finish1', 'plaster'],
      ['inner', 'structure', 'brick'],
      ['interior', 'finish2', 'plaster'],
    ]);
    // 6 × 2.80 less the door's 0.80 × 2.10.
    const net = 6 * 2.8 - 0.8 * 2.1;
    for (const x of q) expect(x.area).toBeCloseTo(net, 9);
    const brick = q[1]!;
    // The built-in brick: 23 × 6.5 cm with a 1 cm joint, a module of 24 × 7.5 cm.
    expect(brick.pieces).toBe(Math.ceil(net / (0.24 * 0.075) - 1e-9));
    expect(brick.pieces).toBe(840);
    expect(brick.mortar).toBeCloseTo(net * 0.12 * (1 - (0.23 * 0.065) / (0.24 * 0.075)), 9);
    expect(brick.volume).toBeCloseTo(net * 0.12, 9);
    // Plaster is not laid in pieces and has no bedding mortar.
    expect(q[0]!.pieces).toBeNull();
    expect(q[0]!.mortar).toBeNull();
    expect(q[0]!.volume).toBeCloseTo(net * 0.015, 9);
  });

  it('pieces are whole ones; mortar is the volume less the pieces\'', () => {
    const p = { length: 0.29, width: 0.19, joint: 0.01 };
    expect(piecesFor(0.3 * 0.2, p)).toBe(1);
    expect(piecesFor(0.3 * 0.2 + 0.001, p)).toBe(2);
    expect(piecesFor(0, p)).toBe(0);
    expect(mortarFor(1, 0.14, p)).toBeCloseTo(0.14 * (1 - (0.29 * 0.19) / 0.06), 12);
  });

  it('a concrete wall is one body: no face finish, no pieces', () => {
    const doc: Doc = { ...newDocument(), walls: [wall('c', [0, 0], [5, 0], 'wt_concrete20')] };
    const [q] = layerQuantities(doc, deriveGeometry(doc));
    expect(q!.place).toBe('inner');
    expect(q!.pieces).toBeNull();
    expect(q!.mortar).toBeNull();
    expect(q!.volume).toBeCloseTo(5 * 2.8 * 0.2, 9);
  });

  it('a room\'s finishes: its floor by the tile, its walls less its door', () => {
    const doc: Doc = {
      ...newDocument(),
      walls: [wall('s', [0, 0], [4, 0], 'wt_concrete20'), wall('e', [4, 0], [4, 3], 'wt_concrete20'), wall('n', [4, 3], [0, 3], 'wt_concrete20'), wall('w', [0, 3], [0, 0], 'wt_concrete20')],
      openings: [newOpening('d', 's', 'door', { kind: 'centered' }, { width: 0.8, height: 2.1 })],
      rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'R', number: '1', finishes: { floor: 'tile', wall: 'plaster' } }],
    };
    const f = finishQuantities(doc, deriveGeometry(doc));
    const floor = f.find((x) => x.surface === 'floor')!;
    expect(floor.area).toBeCloseTo(3.8 * 2.8, 9);
    // 60 × 60 cm tiles with a 3 mm joint.
    expect(floor.pieces).toBe(Math.ceil((3.8 * 2.8) / (0.603 * 0.603)));
    const walls = f.find((x) => x.surface === 'wall')!;
    expect(walls.area).toBeCloseTo(2 * (3.8 + 2.8) * 2.8 - 0.8 * 2.1, 9);
    expect(walls.pieces).toBeNull();
    expect(f.some((x) => x.surface === 'ceiling')).toBe(false);
  });

  it('a wall\'s modulation: blocks along it and courses up it, and what is left', () => {
    const m = modulation(one, one.walls[0]!)!;
    expect(m.module).toBeCloseTo(0.24, 12);
    // 6 m is 25 modules of 24 cm exactly.
    expect(m.count).toBe(25);
    expect(m.rest).toBe(0);
    // 2.80 m is 37 courses of 7.5 cm and 2.5 cm.
    expect(m.courses).toBe(37);
    expect(m.courseRest).toBeCloseTo(0.025, 9);
    const short: Doc = { ...one, walls: [wall('a', [0, 0], [6.1, 0])] };
    const s = modulation(short, short.walls[0]!)!;
    expect(s.count).toBe(25);
    expect(s.rest).toBeCloseTo(0.1, 9);
    const concrete: Doc = { ...newDocument(), walls: [wall('c', [0, 0], [5, 0], 'wt_concrete20')] };
    expect(modulation(concrete, concrete.walls[0]!)).toBeNull();
  });

  it('the schedule: one row per item and material, the walls schedule with each wall\'s modulation', () => {
    const s = schedule(one, deriveGeometry(one), 'construction', naming);
    expect(s.columns.map((c) => c.key)).toEqual(['schedule.col.item', 'schedule.col.material', 'schedule.col.area', 'schedule.col.volume', 'schedule.col.pieces']);
    expect(s.rows.map((r) => [r[0], r[1]])).toEqual([
      ['qty.faceExterior', 'plaster'],
      ['qty.masonry', 'brick'],
      ['qty.mortar', 'brick'],
      ['qty.faceInterior', 'plaster'],
    ]);
    expect(s.rows[1]![4]).toBe(840);
    expect(s.totals).toEqual([4, null, null, null, null]);
    const w = schedule(one, deriveGeometry(one), 'walls', naming);
    expect(w.rows[0]!.at(-1)).toBe('mod.along 25 24 0; mod.upRest 37 7.5 2.5');
  });

  it('a renovation: existing and demolished walls are not built; the demolished ones are taken down, by type', () => {
    // Beside the 6 m wall with its door, a 4 m existing one and a 3 m one to be demolished (2.80 m high).
    const reform: Doc = { ...one, walls: [...one.walls, { ...wall('e', [0, 5], [4, 5]), phase: 'existing' }, { ...wall('x', [0, 9], [3, 9]), phase: 'demolish' }] };
    const g = deriveGeometry(reform);
    expect(new Set(layerQuantities(reform, g).map((q) => q.wallId))).toEqual(new Set(['a']));
    const [d] = demolitionQuantities(reform, g);
    expect(d!.wallId).toBe('x');
    expect(d!.area).toBeCloseTo(3 * 2.8, 9);
    expect(d!.volume).toBeCloseTo(3 * 2.8 * 0.15, 9);
    const rows = schedule(reform, g, 'construction', naming).rows;
    expect(rows.find((r) => String(r[0]).startsWith('qty.demolish'))!.slice(2, 4)).toEqual([expect.closeTo(8.4, 9), expect.closeTo(1.26, 9)]);
  });
});
