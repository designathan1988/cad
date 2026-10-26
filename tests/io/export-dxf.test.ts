// A level's plan as DXF R12 (export-dxf.ts), on the schedules' box: 4 × 3 m between the axes of 15 cm
// walls, a divider at x = 2 with a 0.8 m door, a 1.2 m window in the right wall, two rooms. Read back
// as group code / value pairs, as a DXF reader reads it.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { newOpening } from '../../src/elements/opening/schema';
import { DXF_LAYERS, planDxf, toCp1252 } from '../../src/io/export-dxf';

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
    { id: 'room_b', levelId: 'lvl_ground', seed: { x: 3, y: 1.5 }, name: 'Cômodo', number: '2' },
  ],
};
const dxf = planDxf(deriveGeometry(doc), 'lvl_ground', { room: (n, name) => `${n} · ${name}`, area: (a) => `${a.toFixed(2).replace('.', ',')} m²` });

/** The file as entities: each a type and its codes (a code met twice keeps its values in order). */
function entities(text: string): { type: string; codes: Map<number, string[]> }[] {
  const lines = text.split('\r\n');
  expect(lines.pop()).toBe('');
  expect(lines.length % 2).toBe(0);
  const out: { type: string; codes: Map<number, string[]> }[] = [];
  let inEntities = false;
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i]!.trim());
    const value = lines[i + 1]!;
    expect(Number.isInteger(code)).toBe(true);
    if (code === 2 && value === 'ENTITIES') inEntities = true;
    if (!inEntities) continue;
    if (code === 0) {
      if (value === 'ENDSEC') inEntities = false;
      else out.push({ type: value, codes: new Map() });
    } else out[out.length - 1]?.codes.set(code, [...(out[out.length - 1]!.codes.get(code) ?? []), value]);
  }
  return out;
}

const n = (e: { codes: Map<number, string[]> }, code: number) => Number(e.codes.get(code)![0]);

describe('a level as DXF R12', () => {
  const all = entities(dxf);

  it('an R12 file in metres and code page 1252, its layers declared, ending in EOF', () => {
    expect(dxf).toContain('$ACADVER\r\n1\r\nAC1009');
    expect(dxf).toContain('$DWGCODEPAGE\r\n3\r\nANSI_1252');
    expect(dxf).toContain('$INSUNITS\r\n70\r\n6');
    for (const l of DXF_LAYERS) expect(dxf).toContain(`0\r\nLAYER\r\n2\r\n${l.name}\r\n`);
    expect(dxf.endsWith('0\r\nEOF\r\n')).toBe(true);
  });

  it('the walls\' outer faces: the bottom one from x = −0.075 to 4.075 at y = −0.075', () => {
    const walls = all.filter((e) => e.type === 'LINE' && e.codes.get(8)![0] === 'A-WALL');
    const bottom = walls.filter((e) => Math.abs(n(e, 20) + 0.075) < 1e-9 && Math.abs(n(e, 21) + 0.075) < 1e-9);
    const xs = bottom.flatMap((e) => [n(e, 10), n(e, 11)]);
    expect(Math.min(...xs)).toBeCloseTo(-0.075, 9);
    expect(Math.max(...xs)).toBeCloseTo(4.075, 9);
    // Whole: one line, not cut where the divider meets it on the inside.
    expect(bottom).toHaveLength(1);
  });

  it('the door: its leaf and a quarter arc of its width about the hinge; the window: three 1.2 m lines', () => {
    const arcs = all.filter((e) => e.type === 'ARC');
    expect(arcs).toHaveLength(1);
    const a = arcs[0]!;
    expect(a.codes.get(8)).toEqual(['A-DOOR']);
    expect(n(a, 40)).toBeCloseTo(0.8, 9);
    expect((((n(a, 51) - n(a, 50)) % 360) + 360) % 360).toBeCloseTo(90, 6);
    const glass = all.filter((e) => e.type === 'LINE' && e.codes.get(8)![0] === 'A-GLAZ');
    expect(glass).toHaveLength(3);
    for (const l of glass) expect(Math.hypot(n(l, 11) - n(l, 10), n(l, 21) - n(l, 20))).toBeCloseTo(1.2, 9);
  });

  it('each room: a closed outline, its name and its area', () => {
    const outlines = all.filter((e) => e.type === 'POLYLINE');
    expect(outlines).toHaveLength(2);
    for (const o of outlines) expect(o.codes.get(70)).toEqual(['1']);
    const texts = all.filter((e) => e.type === 'TEXT').map((e) => e.codes.get(1)![0]);
    expect(texts).toEqual(['1 · Sala', '5,27 m²', '2 · Cômodo', '5,27 m²']);
  });

  it('in code page 1252: Portuguese letters one byte each, a sign outside it "?"', () => {
    expect([...toCp1252('Cômodo ção € ✓')]).toEqual([0x43, 0xf4, 0x6d, 0x6f, 0x64, 0x6f, 0x20, 0xe7, 0xe3, 0x6f, 0x20, 0x80, 0x20, 0x3f]);
  });
});
