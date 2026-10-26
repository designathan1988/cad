// Quantity schedules (schedules.ts), on a box worked out by hand: 4 × 3 m between the axes of 15 cm
// walls, split by a wall at x = 2 with a door in it, and a window in the right wall. Each room is then
// (2 − 0.15) × (3 − 0.15) = 1.85 × 2.85 = 5.2725 m², perimeter 2·(1.85 + 2.85) = 9.4 m.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { type Naming, schedule, toCsv } from '../../src/app/schedules';
import { newOpening } from '../../src/elements/opening/schema';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

const doc: Doc = {
  ...newDocument(),
  walls: [wall('w1', [0, 0], [4, 0]), wall('w2', [4, 0], [4, 3]), wall('w3', [4, 3], [0, 3]), wall('w4', [0, 3], [0, 0]), wall('w5', [2, 0], [2, 3])],
  openings: [
    newOpening('opening_d', 'w5', 'door', { kind: 'centered' }, { width: 0.8, height: 2.1 }),
    newOpening('opening_w', 'w2', 'window', { kind: 'centered' }, { width: 1.2, height: 1.0, sill: 1.1 }),
  ],
  rooms: [
    { id: 'room_a', levelId: 'lvl_ground', seed: { x: 1, y: 1.5 }, name: 'Sala', number: '1' },
    { id: 'room_b', levelId: 'lvl_ground', seed: { x: 3, y: 1.5 }, name: 'Quarto', number: '2' },
  ],
};
const g = deriveGeometry(doc);
const naming: Naming = {
  name: (s) => s,
  wallTag: (n) => `Parede ${n}`,
  outside: 'exterior',
  use: (u) => (u === 'bedroom' ? 'Dormitório' : u),
  markPrefix: { door: 'P', window: 'J' },
  model: () => 'Simples',
};
const BOM = String.fromCharCode(0xfeff);

describe('quantity schedules', () => {
  it('rooms: number, name, use, level, area, perimeter, ceiling height and volume; the totals', () => {
    const s = schedule(doc, g, 'rooms', naming);
    expect(s.rows.map((r) => r.slice(0, 4))).toEqual([
      ['1', 'Sala', '', 'Ground floor'],
      ['2', 'Quarto', '', 'Ground floor'],
    ]);
    for (const r of s.rows) {
      expect(r[4]).toBeCloseTo(5.2725, 9);
      expect(r[5]).toBeCloseTo(9.4, 9);
      // No height of its own: the level's 2.80 m; the volume 5.2725 × 2.8.
      expect(r[6]).toBeCloseTo(2.8, 9);
      expect(r[7]).toBeCloseTo(14.763, 9);
    }
    expect(s.totals[0]).toBe(2);
    expect(s.totals[4]).toBeCloseTo(10.545, 9);
    // Heights do not add up; volumes do.
    expect(s.totals[6]).toBeNull();
    expect(s.totals[7]).toBeCloseTo(29.526, 9);
  });

  it("a room's own use and height go in its row", () => {
    const own: Doc = { ...doc, rooms: doc.rooms.map((r) => (r.id === 'room_b' ? { ...r, use: 'bedroom' as const, height: 2.5 } : r)) };
    const r = schedule(own, deriveGeometry(own), 'rooms', naming).rows[1]!;
    expect([r[2], r[6]]).toEqual(['Dormitório', 2.5]);
    expect(r[7]).toBeCloseTo(5.2725 * 2.5, 9);
  });

  it('doors and windows: their type mark, wall, size, area, and the rooms on each side (or the outside)', () => {
    const doors = schedule(doc, g, 'doors', naming);
    expect(doors.rows).toEqual([['1', 'P1', 'Ground floor', 'Parede 5', 0.8, 2.1, expect.closeTo(1.68, 9), 'Sala / Quarto', 'Simples']]);
    const windows = schedule(doc, g, 'windows', naming);
    // The right wall runs up from (4, 0): its left side, the first face, is the room; the outside to the right.
    expect(windows.rows).toEqual([['1', 'J1', 'Ground floor', 'Parede 2', 1.2, 1.0, 1.1, expect.closeTo(1.2, 9), 'Quarto / exterior', 'Simples']]);
    expect(windows.totals[0]).toBe(1);
    // Widths, heights and sills do not add up.
    expect([windows.totals[4], windows.totals[5], windows.totals[6]]).toEqual([null, null, null]);
  });

  it('walls: length on the axis, height, gross area, the openings in it, net area; the totals', () => {
    const s = schedule(doc, g, 'walls', naming);
    const right = s.rows.find((r) => r[0] === 'Parede 2')!;
    expect(right.slice(1, 3)).toEqual(['Masonry 15 cm', 'Ground floor']);
    expect(right[3]).toBeCloseTo(3, 9);
    expect(right[4]).toBeCloseTo(2.8, 9);
    expect(right[5]).toBeCloseTo(8.4, 9);
    expect(right[6]).toBeCloseTo(1.2, 9);
    expect(right[7]).toBeCloseTo(7.2, 9);
    expect(s.totals[0]).toBe(5);
    // 4 + 3 + 4 + 3 + 3 m of axis.
    expect(s.totals[3]).toBeCloseTo(17, 9);
    expect(s.totals[7]).toBeCloseTo(17 * 2.8 - 1.2 - 0.8 * 2.1, 9);
  });

  it('CSV: a UTF-8 mark, the language\'s separator and decimal mark, quotes where needed, the totals last', () => {
    const s = schedule(doc, g, 'rooms', { ...naming, name: (n) => (n === 'Sala' ? 'Sala; cozinha' : n) });
    const headers = ['Nº', 'Nome', 'Uso', 'Pavimento', 'Área (m²)', 'Perímetro (m)', 'Pé-direito (m)', 'Volume (m³)'];
    const pt = toCsv(s, headers, 'Total', 'pt');
    expect(pt.startsWith(`${BOM}Nº;Nome;`)).toBe(true);
    const lines = pt.slice(1).trim().split('\r\n');
    expect(lines[1]).toBe('1;"Sala; cozinha";;Ground floor;5,27;9,400;2,800;14,76');
    // 10.545 m² is 10.5449… in binary: 10,54, what the two rooms shown (5,27 each) add to.
    expect(lines[3]).toBe('Total: 2;;;;10,54;18,800;;29,53');
    const en = toCsv(s, headers, 'Total', 'en');
    expect(en.slice(1).split('\r\n')[2]).toBe('2,Quarto,,Ground floor,5.27,9.400,2.800,14.76');
  });
});
