// IFC import (phase 11): STEP read back (strings, numbers, lists, typed values), the house this app exports
// read back as it was, and a file written by another program (IfcOpenShell's API: millimetres, voids
// placed on their walls, a type of two layers, a door with no body of its own) read as a project.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { newOpening } from '../../src/elements/opening/schema';
import { exportIfc } from '../../src/io/export-ifc';
import { importIfc } from '../../src/io/import-ifc';
import { decodeStepString, isEnum, isRef, isTyped, readStep } from '../../src/io/step';

const ids = () => {
  let n = 0;
  return (p: string) => `${p}_${++n}`;
};

describe('STEP read back', () => {
  it('strings with their codes, references, enumerations, numbers, unset, lists and typed values', () => {
    const e = readStep("DATA;\n#7=IFCX('T\\X2\\00E9\\X0\\rreo d''\\X\\E1gua',#12,.POSITIVE.,-1.5E-3,$,(1.,2.,3.),IFCLABEL('a'),*,.T.);\nENDSEC;").get(7)!;
    expect(e.type).toBe('IFCX');
    expect(e.args[0]).toBe("Térreo d'água");
    expect(isRef(e.args[1]) && e.args[1].ref).toBe(12);
    expect(isEnum(e.args[2]) && e.args[2].enum).toBe('POSITIVE');
    expect(e.args[3]).toBeCloseTo(-0.0015, 12);
    expect(e.args[4]).toBeNull();
    expect(e.args[5]).toEqual([1, 2, 3]);
    expect(isTyped(e.args[6]) && e.args[6].value).toBe('a');
    expect(e.args[8]).toBe(true);
    expect(decodeStepString('a\\\\b')).toBe('a\\b');
  });
});

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

describe('this app\'s IFC read back', () => {
  const house: Doc = {
    ...newDocument(),
    name: 'Casa',
    walls: [wall('wall_1', [0, 0], [4, 0]), wall('wall_2', [4, 0], [4, 3]), wall('wall_3', [4, 3], [0, 3]), wall('wall_4', [0, 3], [0, 0])],
    openings: [
      newOpening('opening_d', 'wall_1', 'door', { kind: 'fromStart', distance: 1 }, { width: 0.8, height: 2.1 }),
      newOpening('opening_w', 'wall_2', 'window', { kind: 'fromStart', distance: 0.9 }, { width: 1.2, height: 1.0, sill: 1.1 }),
    ],
    rooms: [{ id: 'room_a', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Sala', number: '1' }],
  };
  const text = exportIfc(house, deriveGeometry(house), {
    project: 'P',
    site: 'S',
    building: 'B',
    name: (s) => s,
    wall: (n) => `W${n}`,
    material: (m) => m.name || m.id,
    opening: () => 'X',
    element: (k, n) => `${k}${n}`,
    object: (d) => d,
    category: () => null,
    zone: (z) => z,
  }, new Date(0));
  const r = importIfc(text, ids());

  it('the same walls, where they were, of a type with the same layers, on their line', () => {
    expect(r.made.walls).toBe(4);
    for (const [i, w] of r.doc.walls.entries()) {
      const was = house.walls[i]!;
      expect(w.start.x).toBeCloseTo(was.start.x, 6);
      expect(w.start.y).toBeCloseTo(was.start.y, 6);
      expect(w.end.x).toBeCloseTo(was.end.x, 6);
      expect(w.end.y).toBeCloseTo(was.end.y, 6);
      expect(w.referenceLine).toBe('centerline');
      expect(w.top).toBeUndefined();
    }
    const type = r.doc.wallTypes.find((t) => t.id === r.doc.walls[0]!.wallTypeId)!;
    const was = house.wallTypes.find((t) => t.id === 'wt_masonry15')!;
    expect(type.layers.map((l) => [l.thickness, l.materialId])).toEqual(was.layers.map((l) => [l.thickness, l.materialId]));
    expect(r.doc.wallTypes).toHaveLength(1);
  });

  it('the door and the window on their walls, as far along, as wide and high, the window at its sill', () => {
    expect(r.made.doors).toBe(1);
    expect(r.made.windows).toBe(1);
    const door = r.doc.openings.find((o) => o.kind === 'door')!;
    const win = r.doc.openings.find((o) => o.kind === 'window')!;
    expect(door.wallId).toBe(r.doc.walls[0]!.id);
    expect(door.rule.kind === 'fromStart' && door.rule.distance).toBeCloseTo(1, 6);
    expect(door.width).toBeCloseTo(0.8, 6);
    expect(door.height).toBeCloseTo(2.1, 6);
    expect(win.wallId).toBe(r.doc.walls[1]!.id);
    expect(win.rule.kind === 'fromStart' && win.rule.distance).toBeCloseTo(0.9, 6);
    expect(win.sill).toBeCloseTo(1.1, 6);
  });

  it('the room, named and numbered, enclosed by the walls read', () => {
    expect(r.doc.rooms).toHaveLength(1);
    expect(r.doc.rooms[0]).toMatchObject({ name: 'Sala', number: '1' });
    const g = deriveGeometry(r.doc);
    const room = [...g.rooms.values()][0]!;
    expect(room.enclosed).toBe(true);
    expect(room.area).toBeCloseTo(3.85 * 2.85, 4);
  });
});

describe('a file another program wrote (IfcOpenShell, in millimetres)', () => {
  const text = readFileSync(new URL('../fixtures/third-party.ifc', import.meta.url), 'utf8');
  const r = importIfc(text, ids());

  it('its two storeys as levels, at their heights, from the lowest', () => {
    expect(r.doc.levels.map((l) => [l.name, l.elevation])).toEqual([
      ['Ground', 0],
      ['Upper', 3],
    ]);
    expect(r.doc.levels[0]!.height).toBeCloseTo(3, 9);
  });

  it('its four walls of 6 × 4 m, 2.7 m high, of their type of two layers (block 190, plaster 20 mm), on their exterior face', () => {
    expect(r.doc.walls).toHaveLength(4);
    const len = r.doc.walls.map((w) => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y));
    expect(len.map((l) => Math.round(l * 1000) / 1000)).toEqual([6, 4, 6, 4]);
    expect(r.doc.walls[0]!.start).toEqual({ x: 0, y: 0 });
    expect(r.doc.walls.every((w) => w.referenceLine === 'exteriorFace')).toBe(true);
    expect(r.doc.walls[0]!.top).toEqual({ kind: 'fixed', height: 2.7 });
    const type = r.doc.wallTypes.find((t) => t.id === r.doc.walls[0]!.wallTypeId)!;
    expect(type.name).toBe('Block 210');
    expect(type.layers.map((l) => l.thickness)).toEqual([0.19, 0.02]);
    expect(type.layers[0]!.function).toBe('structure');
    expect(r.doc.materials.some((m) => m.name === 'Block')).toBe(true);
  });

  it('the door 1 m along the south wall and the window 1.5 m along the east one, sill 1 m', () => {
    const door = r.doc.openings.find((o) => o.kind === 'door')!;
    const win = r.doc.openings.find((o) => o.kind === 'window')!;
    expect(door.wallId).toBe(r.doc.walls[0]!.id);
    expect(door.rule.kind === 'fromStart' && door.rule.distance).toBeCloseTo(1, 6);
    expect(door.width).toBeCloseTo(0.9, 6);
    expect(win.wallId).toBe(r.doc.walls[1]!.id);
    expect(win.rule.kind === 'fromStart' && win.rule.distance).toBeCloseTo(1.5, 6);
    expect(win.width).toBeCloseTo(1.2, 6);
    expect(win.sill).toBeCloseTo(1, 6);
  });

  it('its space as a room inside the walls; its slab a floor on the upper level; its stair said to have no place', () => {
    expect(r.doc.rooms[0]).toMatchObject({ name: 'Living', number: '101' });
    const room = [...deriveGeometry(r.doc).rooms.values()][0]!;
    expect(room.enclosed).toBe(true);
    expect(r.doc.floors).toHaveLength(1);
    expect(r.doc.floors[0]!.levelId).toBe(r.doc.levels[1]!.id);
    expect(r.doc.floors[0]!.thickness).toBeCloseTo(0.2, 6);
    expect(r.doc.floors[0]!.offset).toBeCloseTo(0, 6);
    expect(r.skipped).toEqual({ IfcStair: 1 });
  });
});
