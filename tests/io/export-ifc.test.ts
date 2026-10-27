// IFC4 export (phase 11): STEP's strings, reals and ids, and a small house written with its classes,
// its wall type's layers, its door and window in their voids and its room as a space. With IFC_OUT set,
// the file is written there too, for an independent reader to open (IfcOpenShell: scripts in the log).

import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { newOpening } from '../../src/elements/opening/schema';
import { exportIfc, ifcClassOf, ifcGuid, stepReal, stepString } from '../../src/io/export-ifc';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

const house: Doc = {
  ...newDocument(),
  name: 'Casa Térrea',
  walls: [wall('wall_1', [0, 0], [4, 0]), wall('wall_2', [4, 0], [4, 3]), wall('wall_3', [4, 3], [0, 3]), wall('wall_4', [0, 3], [0, 0])],
  openings: [
    newOpening('opening_d', 'wall_1', 'door', { kind: 'centered' }, { width: 0.8, height: 2.1 }),
    newOpening('opening_w', 'wall_2', 'window', { kind: 'centered' }, { width: 1.2, height: 1.0, sill: 1.1 }),
  ],
  rooms: [{ id: 'room_a', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Sala', number: '1' }],
};

const naming = {
  project: 'Projeto',
  site: 'Terreno',
  building: 'Edificação',
  name: (s: string) => (s === 'Ground floor' ? 'Térreo' : s),
  wall: (n: number) => `Parede ${n}`,
  material: (m: { id: string; name: string }) => m.name || m.id,
  opening: (_id: string, kind: 'door' | 'window') => (kind === 'door' ? 'P1' : 'J1'),
  element: (key: string, n: number) => `${key} ${n}`,
  object: (id: string) => id,
  category: () => null,
  zone: (z: string) => z,
};

const count = (text: string, entity: string) => (text.match(new RegExp(`=${entity}\\(`, 'g')) ?? []).length;

describe('STEP pieces', () => {
  it('strings keep accents as \\X2\\ codes, quotes doubled', () => {
    expect(stepString("Térreo d'água")).toBe("'T\\X2\\00E9\\X0\\rreo d''\\X2\\00E1\\X0\\gua'");
  });

  it('reals always with their point', () => {
    expect(stepReal(2)).toBe('2.');
    expect(stepReal(0.15)).toBe('0.15');
    expect(stepReal(1e-7)).toBe('1.E-7');
    expect(stepReal(-3.5)).toBe('-3.5');
  });

  it('ids: 22 of IFC\'s 64 characters, the first of 4, the same for the same element, apart for others', () => {
    const a = ifcGuid('wall_1');
    expect(a).toMatch(/^[0-3][0-9A-Za-z_$]{21}$/);
    expect(ifcGuid('wall_1')).toBe(a);
    expect(ifcGuid('wall_2')).not.toBe(a);
  });

  it('classes: a ceiling is a covering, a floor a slab, a sanitary object a sanitary terminal', () => {
    expect(ifcClassOf('floors', null, { floor: { kind: 'ceiling' } })!.entity).toBe('IFCCOVERING');
    expect(ifcClassOf('floors', null, { floor: {} })!.entity).toBe('IFCSLAB');
    expect(ifcClassOf('objects', 'fixture', null)!.entity).toBe('IFCSANITARYTERMINAL');
    expect(ifcClassOf('objects', 'furniture', null)!.entity).toBe('IFCFURNITURE');
    expect(ifcClassOf('notes', null, null)).toBeNull();
  });
});

describe('a small house in IFC4', () => {
  const text = exportIfc(house, deriveGeometry(house), naming, new Date('2026-10-27T10:00:00Z'));
  if (process.env.IFC_OUT) writeFileSync(process.env.IFC_OUT, text);

  it('is a STEP file of IFC4', () => {
    expect(text.startsWith('ISO-10303-21;')).toBe(true);
    expect(text).toContain("FILE_SCHEMA(('IFC4'));");
    expect(text.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
  });

  it('has its project, site, building and a storey a level, named', () => {
    expect(count(text, 'IFCPROJECT')).toBe(1);
    expect(count(text, 'IFCSITE')).toBe(1);
    expect(count(text, 'IFCBUILDING')).toBe(1);
    expect(count(text, 'IFCBUILDINGSTOREY')).toBe(1);
    expect(text).toContain("'Casa T\\X2\\00E9\\X0\\rrea'");
    expect(text).toContain("'T\\X2\\00E9\\X0\\rreo'");
  });

  it('four walls of one type, whose layers are its type\'s, used from the exterior face', () => {
    expect(count(text, 'IFCWALL')).toBe(4);
    expect(count(text, 'IFCWALLTYPE')).toBe(house.wallTypes.length);
    const masonry = house.wallTypes.find((t) => t.id === 'wt_masonry15')!;
    const set = text.split('\n').find((l) => l.includes('IFCMATERIALLAYERSET(') && l.includes(stepString(masonry.name).slice(1, -1)))!;
    expect(set).toBeDefined();
    // As many layers in its set as the type has.
    expect(set.split("=").slice(1).join("=").match(/#\d+/g)!.length).toBe(masonry.layers.length);
    expect(count(text, 'IFCMATERIALLAYERSETUSAGE')).toBe(4);
    // Centre line: the exterior face half the thickness to the right of the line.
    const thick = masonry.layers.reduce((s, l) => s + l.thickness, 0);
    expect(text).toContain(`.AXIS2.,.POSITIVE.,${stepReal(-thick / 2)},$)`);
    expect(count(text, 'IFCRELDEFINESBYTYPE')).toBe(1);
  });

  it('a door and a window, each filling a void through its wall', () => {
    expect(count(text, 'IFCDOOR')).toBe(1);
    expect(count(text, 'IFCWINDOW')).toBe(1);
    expect(count(text, 'IFCOPENINGELEMENT')).toBe(2);
    expect(count(text, 'IFCRELVOIDSELEMENT')).toBe(2);
    expect(count(text, 'IFCRELFILLSELEMENT')).toBe(2);
    expect(text).toMatch(/IFCDOOR\([^)]*'P1'/);
  });

  it('the room as a space with its area, in its storey', () => {
    expect(count(text, 'IFCSPACE')).toBe(1);
    expect(text).toMatch(/IFCSPACE\([^;]*'Sala'/);
    // (4 − 0.15) × (3 − 0.15).
    expect(text).toContain(`IFCQUANTITYAREA('NetFloorArea',$,$,${stepReal(3.85 * 2.85)},$)`);
  });

  it('every reference is to an entity written', () => {
    const n = text.split('\n').filter((l) => /^#\d+=/.test(l)).length;
    const refs = [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...refs)).toBe(n);
  });
});
