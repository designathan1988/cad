// Phase 14, the quick level: transmittance and capacity, Glaser, the mass law, the sun on the windows,
// the daylight factor, the Wi-Fi signal, and the risk rules; each against numbers worked by hand.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { DEFAULT_SITE } from '../../src/app/sun';
import { newOpening } from '../../src/elements/opening/schema';
import { acousticOf, glaserOf, limitsFor, reverberationOf, saturation, thermalOf } from '../../src/sim/envelope';
import { daylightOf, exteriorWindows, hoursOf, roomSun, sunDays, sunSlots } from '../../src/sim/exposure';
import { absorptanceOf } from '../../src/sim/physics';
import { risksOf } from '../../src/sim/risks';
import { DEFAULT_SIM } from '../../src/sim/settings';
import { signalAt, wifiGrid } from '../../src/sim/wifi';
import { readProject, writeProject } from '../../src/io/project-file';
import { energyPlusIdf, fdsInput, radianceScene } from '../../src/io/export-sim';

const doc0 = newDocument();
const type = (id: string) => doc0.wallTypes.find((t) => t.id === id)!;

describe('the envelope', () => {
  it('a 15 cm masonry wall: R, U and CT by NBR 15220-2; within NBR 15575-4 in zone 3', () => {
    const t = thermalOf(type('wt_masonry15'), doc0.materials, DEFAULT_SIM);
    const r = 0.13 + 0.04 + (2 * 0.015) / 1.15 + 0.12 / 0.9;
    expect(t.resistance).toBeCloseTo(r, 9);
    expect(t.transmittance).toBeCloseTo(1 / r, 9);
    expect(t.capacity).toBeCloseTo(0.03 * 1 * 2000 + 0.12 * 0.92 * 1600, 9);
    // A light render: absorptance under 0.6, so U up to 3.7.
    expect(t.absorptance).toBeLessThan(0.6);
    expect([t.limitU, t.limitCT, t.okU, t.okCT]).toEqual([3.7, 130, true, true]);
  });

  it('bare grey concrete absorbs more than 0.6: its limit falls to 2.5 and its 3.52 fails', () => {
    const t = thermalOf(type('wt_concrete20'), doc0.materials, DEFAULT_SIM);
    expect(t.transmittance).toBeCloseTo(1 / (0.17 + 0.2 / 1.75), 9);
    expect(t.absorptance).toBeGreaterThan(0.6);
    expect([t.limitU, t.okU]).toEqual([2.5, false]);
    expect(limitsFor(2, 0.2)).toEqual({ u: 2.5, ct: 130 });
    expect(limitsFor(8, 0.2)).toEqual({ u: 3.7, ct: null });
  });

  it('absorptance from the colour: white none, black all', () => {
    expect(absorptanceOf('#ffffff')).toBe(0);
    expect(absorptanceOf('#000000')).toBe(1);
  });

  it('the saturation pressure (ISO 13788 annex E)', () => {
    expect(saturation(0)).toBeCloseTo(610.5, 9);
    expect(saturation(20)).toBeCloseTo(2337, 0);
    // Over ice the tables give 401.7 Pa at −5 °C; the annex's formula is within a pascal of it.
    expect(Math.abs(saturation(-5) - 401.7)).toBeLessThan(1);
  });

  it('Glaser: a drywall with wool and no vapour barrier condenses behind the wool; masonry does not', () => {
    const d = glaserOf(type('wt_drywall10'), doc0.materials, DEFAULT_SIM);
    // From the inside: gypsum (0), wool (1), gypsum (2); the plane after the wool passes saturation.
    expect(d.condenses).toContain(1);
    const m = glaserOf(type('wt_masonry15'), doc0.materials, DEFAULT_SIM);
    expect(m.condenses).toEqual([]);
    // Its inside surface at 14 °C under 20 °C, 65 % air: over 80 %, a mould risk.
    expect(m.planes[0]!.temperature).toBeCloseTo(20 - (15 * 0.13) / (0.17 + 0.03 / 1.15 + 0.12 / 0.9), 9);
    expect(m.mould).toBe(true);
  });

  it('Sabine: a 4 × 4 × 2.8 m room of plaster and screed, with a window and a door, empty', () => {
    const [r] = reverberationOf([{ id: 'r', area: 16, perimeter: 16, height: 2.8 }], () => ({ windows: 1.44, doors: 1.68 }));
    const a = 16 * 0.02 + 16 * 0.02 + (16 * 2.8 - 1.44 - 1.68) * 0.02 + 1.44 * 0.18 + 1.68 * 0.1;
    expect(r!.absorption).toBeCloseTo(a, 9);
    expect(r!.time).toBeCloseTo((0.161 * 16 * 2.8) / a, 9);
    // Wood on the floor takes it down.
    const [w] = reverberationOf([{ id: 'r', area: 16, perimeter: 16, height: 2.8, finishes: { floor: 'wood' } }], () => ({ windows: 1.44, doors: 1.68 }));
    expect(w!.time).toBeLessThan(r!.time);
  });

  it('the mass law: Rw for heavy walls, only R at 500 Hz for a light one', () => {
    const c = acousticOf(type('wt_concrete20'), doc0.materials);
    expect(c.mass).toBeCloseTo(460, 9);
    expect(c.rw).toBeCloseTo(37.5 * Math.log10(460) - 42, 9);
    const d = acousticOf(type('wt_drywall10'), doc0.materials);
    expect(d.mass).toBeCloseTo(0.025 * 875 + 0.075 * 100, 9);
    expect(d.rw).toBeNull();
    expect(d.r500).toBeCloseTo(20 * Math.log10(d.mass! * 500) - 47, 9);
  });
});

const wall = (id: string, a: [number, number], b: [number, number], t = 'wt_masonry15'): DocWall => ({ id, wallTypeId: t, start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, referenceLine: 'centerline', levelId: 'lvl_ground', baseOffset: 0, top: { kind: 'level', offset: 0 } });

// A 4 × 4 m room, counter-clockwise, with a 1.20 × 1.20 window in its north wall (plan up is north).
const room: Doc = {
  ...newDocument(),
  walls: [wall('s', [0, 0], [4, 0]), wall('e', [4, 0], [4, 4]), wall('n', [4, 4], [0, 4]), wall('w', [0, 4], [0, 0])],
  openings: [{ ...newOpening('win', 'n', 'window', { kind: 'centered' }, { width: 1.2, height: 1.2 }), sill: 1 }],
  rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 2, y: 2 }, name: 'Room', number: '1', use: 'living' }],
};

describe('sun and daylight', () => {
  it('a north window in São Paulo: sun all the June day and the equinox, hardly any in December', () => {
    const g = deriveGeometry(room);
    const [win] = exteriorWindows(room, g);
    expect(win!.roomId).toBe('r');
    expect(Math.round(win!.azimuth)).toBe(0);
    const [june, december, march] = sunDays(DEFAULT_SITE).map((d) => hoursOf(sunSlots(room, g, win!, d)));
    expect(june).toBeGreaterThan(10);
    expect(june).toBeLessThan(11.5);
    expect(march).toBeGreaterThan(11.5);
    expect(december).toBeLessThan(2.5);
    expect(roomSun(room, g)[0]!.hours).toEqual([june, december, march]);
  });

  it('a tall wall north of it takes the low sun of the June morning and evening', () => {
    const shaded: Doc = { ...room, walls: [...room.walls, { ...wall('x', [-3, 5.5], [7, 5.5]), top: { kind: 'fixed', height: 6 } }] };
    const g0 = deriveGeometry(room);
    const g1 = deriveGeometry(shaded);
    const june = sunDays(DEFAULT_SITE)[0]!;
    const free = hoursOf(sunSlots(room, g0, exteriorWindows(room, g0)[0]!, june));
    const behind = hoursOf(sunSlots(shaded, g1, exteriorWindows(shaded, g1)[0]!, june));
    expect(behind).toBeLessThan(free - 3);
  });

  it('a deep eave over the window takes the high sun; a short one hardly any', () => {
    const roof = (overhang: number): Doc => ({
      ...room,
      roofs: [{ id: 'roof_1', levelId: 'lvl_ground', outline: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], edges: [0, 1, 2, 3].map((i) => ({ grade: i % 2 === 0 ? 30 : null, overhang: i === 2 ? overhang : 0.3 })), kind: 'gable', thickness: 0.12, baseOffset: 0 }],
    });
    const june = sunDays(DEFAULT_SITE)[0]!;
    const hours = (d: Doc) => {
      const g = deriveGeometry(d);
      return hoursOf(sunSlots(d, g, exteriorWindows(d, g)[0]!, june));
    };
    const open = hours(room);
    expect(hours(roof(0.3))).toBeGreaterThan(open - 1);
    expect(hours(roof(2))).toBeLessThan(open - 3);
  });

  it('the average daylight factor: T·Aw·θ / (A·(1 − R²))', () => {
    const g = deriveGeometry(room);
    const s = g.rooms.get('r')!;
    const [d] = daylightOf(room, g);
    const glass = 1.2 * 1.2 * 0.75;
    const surfaces = 2 * s.area + s.perimeter * 2.8;
    expect(d!.glass).toBeCloseTo(glass, 9);
    expect(d!.factor).toBeCloseTo((0.8 * glass * 90) / (surfaces * 0.75), 9);
    expect(d!.target).toBe(1.5);
  });
});

describe('Wi-Fi', () => {
  const withAp: Doc = { ...room, mepPoints: [{ id: 'ap', levelId: 'lvl_ground', at: { x: 2, y: 2 }, height: 1, kind: 'accessPoint', systemId: 'sys_data' }] };

  it('free space inside; a brick wall takes 8 dB more, its window only 3', () => {
    const g = deriveGeometry(withAp);
    const ap = { at: { x: 2, y: 2 }, z: 1, levelId: 'lvl_ground' };
    const at = (x: number, y: number) => signalAt(withAp, g, DEFAULT_SIM, ap, { x, y }, 'lvl_ground');
    const free = (d: number) => 20 - (20 * Math.log10(2440) + 20 * Math.log10(d) - 28);
    expect(at(2, 3.5)).toBeCloseTo(free(1.5), 9);
    // Through the east wall, 3 m away; through the window in the north one.
    expect(at(5, 2)).toBeCloseTo(free(3) - 8, 9);
    expect(at(2, 5)).toBeCloseTo(free(3) - 3, 9);
  });

  it('the map covers the rooms with a metre around, its best signal under the access point', () => {
    const g = deriveGeometry(withAp);
    const grid = wifiGrid(withAp, g, DEFAULT_SIM, 'lvl_ground')!;
    expect(grid.cols * grid.cell).toBeGreaterThan(5.8);
    const best = Math.max(...grid.values);
    expect(best).toBeCloseTo(20 - (20 * Math.log10(2440) - 28), 9);
  });
});

describe('the detailed engines\' inputs', () => {
  it('EnergyPlus: a zone, its four walls, floor on the ground, roof, the window on the north wall', () => {
    const g = deriveGeometry(room);
    const idf = energyPlusIdf(room, g, 'Casa');
    expect((idf.match(/^Zone,/gm) ?? []).length).toBe(1);
    expect((idf.match(/^BuildingSurface:Detailed,/gm) ?? []).length).toBe(6);
    expect((idf.match(/^FenestrationSurface:Detailed,/gm) ?? []).length).toBe(1);
    expect(idf).toContain('    Ground,');
    expect(idf).toContain('Construction,\n    wt_masonry15,\n    plaster 0_015,\n    brick 0_12,\n    plaster 0_015;');
    // Specific heats in J/(kg·K), whole: 920 for the brick, not 92.
    expect(idf).toContain('    0.12,\n    0.9,\n    1600,\n    920,');
    // The window on the wall whose side runs along y = 3.925 (the inner face of the north wall).
    const win = idf.slice(idf.indexOf('FenestrationSurface:Detailed'));
    expect(win).toMatch(/3\.925, 2\.2;/);
  });

  it('Radiance: six surfaces and the glass, the window a seamed hole in its wall; FDS: four walls and the hole', () => {
    const g = deriveGeometry(room);
    const rad = radianceScene(room, g, 'Casa');
    expect((rad.match(/ polygon s\d+/g) ?? []).length).toBe(6);
    expect((rad.match(/^vidro polygon/gm) ?? []).length).toBe(1);
    // The north wall: 4 corners and the hole's 4, its first again and the outline's first: 10 points.
    expect(rad).toContain('\n30\n');
    const fds = fdsInput(room, g, 'Casa');
    expect((fds.match(/^&OBST/gm) ?? []).length).toBe(4);
    expect((fds.match(/^&HOLE/gm) ?? []).length).toBe(1);
    expect(fds).toMatch(/^&MESH IJK=\d+,\d+,\d+/m);
  });
});

describe('risks of infiltration and fissure', () => {
  it('lintels over openings in masonry, a long panel, a bathroom with no drain, a flat-ish tiled roof', () => {
    const long: Doc = {
      ...room,
      walls: [wall('s', [0, 0], [8, 0]), wall('e', [8, 0], [8, 4]), wall('n', [8, 4], [0, 4]), wall('w', [0, 4], [0, 0])],
      rooms: [{ ...room.rooms[0]!, use: 'bathroom' }],
      roofs: [{ id: 'roof_1', levelId: 'lvl_ground', outline: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 4 }, { x: 0, y: 4 }], edges: [0, 1, 2, 3].map((i) => ({ grade: i % 2 === 0 ? 20 : null, overhang: 0.5 })), kind: 'gable', thickness: 0.12, baseOffset: 0 }],
    };
    const r = risksOf(long, deriveGeometry(long));
    expect(r.filter((x) => x.rule === 'lintel').map((x) => x.elementId)).toEqual(['win']);
    expect(r.filter((x) => x.rule === 'longPanel').map((x) => [x.elementId, x.value])).toEqual([
      ['s', 8],
      ['n', 8],
    ]);
    expect(r.filter((x) => x.rule === 'wetNoDrain').map((x) => x.elementId)).toEqual(['r']);
    expect(r.find((x) => x.rule === 'roofSlope')).toEqual({ kind: 'infiltration', rule: 'roofSlope', elementId: 'roof_1', value: 20 });
    // A wall meeting the long one in its middle braces it.
    const braced: Doc = { ...long, walls: [...long.walls, wall('m', [4, 0], [4, 4])] };
    expect(risksOf(braced, deriveGeometry(braced)).some((x) => x.rule === 'longPanel')).toBe(false);
    // A drain in the bathroom.
    const drained: Doc = { ...long, mepPoints: [{ id: 'd', levelId: 'lvl_ground', at: { x: 2, y: 2 }, height: 0, kind: 'drain', systemId: 'sys_sewer' }] };
    expect(risksOf(drained, deriveGeometry(drained)).some((x) => x.rule === 'wetNoDrain')).toBe(false);
  });

  it('a material\'s own physics and the settings are kept in the file', () => {
    const own: Doc = { ...room, materials: room.materials.map((m) => (m.id === 'brick' ? { ...m, physics: { conductivity: 0.5, density: 1000, specificHeat: 0.9, vapour: 8, wifiLoss: 6 } } : m)), simulation: { ...DEFAULT_SIM, zone: 5 } };
    const r = readProject(writeProject(own));
    expect(r.ok && r.doc.materials.find((m) => m.id === 'brick')!.physics!.conductivity).toBe(0.5);
    expect(r.ok && r.doc.simulation!.zone).toBe(5);
  });
});
