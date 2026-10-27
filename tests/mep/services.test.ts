// Phase 13: building services. Networks joined by themselves, the load table, the water pressures at
// the points, the sewer's falls, the runs through the structure, the analytic model.

import { describe, expect, it } from 'vitest';
import { type Doc, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { analyticModel, clashesOf, isometricSvg, waterproofing } from '../../src/elements/mep/coordination';
import { balance, generalDemand, loadTable, protect, showerFactor, voltageDrop } from '../../src/elements/mep/electrical';
import { fittingsOf, networksOf } from '../../src/elements/mep/network';
import { GROUP_OF, isMepPoint, isMepRun, type MepPoint, type MepRun } from '../../src/elements/mep/schema';
import { equivalentLength, hazenWilliams, mostUhc, neededDiameter, pressures, probableFlow, rainCapacity, rainDiameter, sewerFalls, sewerStacks, stackDiameter, trapReach, ventBranchDiameter, ventDiameter } from '../../src/elements/mep/water';
import { DEFAULT_SIM } from '../../src/sim/settings';
import { RAIN_PLACES, rainOf } from '../../src/elements/mep/rain-places';
import { readProject, writeProject } from '../../src/io/project-file';
import { runVertices } from '../../src/app/mep-ui';
import { gutters } from '../../src/elements/mep/gutters';
import { roofSolid } from '../../src/elements/roof/geometry';
import { edgesFor, type Roof } from '../../src/elements/roof/schema';
import { mepPointKind, mepRunKind } from '../../src/elements/kinds/mep';

const pt = (id: string, kind: MepPoint['kind'], x: number, y: number, height: number, systemId: string, extra: Partial<MepPoint> = {}): MepPoint => ({ id, levelId: 'lvl_ground', at: { x, y }, height, kind, systemId, ...extra });
const run = (id: string, systemId: string, diameter: number, ...points: [number, number, number][]): MepRun => ({ id, levelId: 'lvl_ground', systemId, kind: 'pipe', diameter, points: points.map(([x, y, z]) => ({ x, y, z })) });

const house: Doc = {
  ...newDocument(),
  mepPoints: [
    pt('qd', 'panel', 0, 0, 1.5, 'sys_power'),
    pt('t1', 'socket', 4, 0, 0.3, 'sys_power'),
    pt('t2', 'socket', 4, 3, 0.3, 'sys_power'),
    pt('ch', 'shower', 0, 3, 2.2, 'sys_power'),
    pt('rs', 'reservoir', 0, 0, 4, 'sys_cold'),
    pt('af', 'coldOutlet', 3, 0, 0.6, 'sys_cold'),
    pt('ci', 'sewerOutlet', 5, 0, -0.4, 'sys_sewer'),
    pt('ralo', 'drain', 0, 0, 0, 'sys_sewer'),
  ],
  mepRuns: [
    run('e1', 'sys_power', 0.025, [0, 0, 1.5], [0, 0, 2.7], [4, 0, 2.7], [4, 3, 2.7]),
    run('e2', 'sys_power', 0.025, [0, 0, 2.7], [0, 3, 2.7]),
    run('a1', 'sys_cold', 0.025, [0, 0, 4], [0, 0, 2.7], [3, 0, 2.7]),
    run('s1', 'sys_sewer', 0.1, [0, 0, -0.2], [5, 0, -0.3], [5, 0, -0.4]),
  ],
};

describe('networks', () => {
  it('runs meet at their vertices and points join the run over them', () => {
    const net = networksOf(house).get('electric')!;
    // The panel on the first vertex; the sockets and the shower each joined by a drop.
    expect(net.pointNode.size).toBe(4);
    const drops = net.edges.filter((e) => !e.runId);
    expect(drops.map((e) => Math.round(e.length * 100) / 100).sort()).toEqual([0.5, 2.4, 2.4]);
  });

  it('a run drawn to a point comes down to it; one drawn to a vertex takes its height', () => {
    const v = runVertices(house, 'lvl_ground', 'sys_power', [
      { x: 0, y: 3 },
      { x: 4, y: 3 },
    ]);
    // From the shower (at 2.20) up to the run's height, across, then on the socket down to 0.30.
    expect(v.map((p) => [p.x, p.y, Math.round(p.z * 100) / 100])).toEqual([
      [0, 3, 2.2],
      [0, 3, 2.7],
      [4, 3, 2.7],
      [4, 3, 0.3],
    ]);
  });

  it('a sewer run falls the way it is drawn, by its least fall, from the drain down to the way out', () => {
    // Drawn where no sewer pipe is yet.
    const bare: Doc = { ...house, mepRuns: house.mepRuns.filter((r) => r.id !== 's1') };
    const v = runVertices(bare, 'lvl_ground', 'sys_sewer', [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
    // A 100 mm pipe: 1 %, 5 cm over 5 m; up from the drain at 0, down into the box at −0.40.
    expect(v.map((p) => [p.x, p.y, Math.round(p.z * 1000) / 1000])).toEqual([
      [0, 0, 0],
      [0, 0, -0.2],
      [5, 0, -0.25],
      [5, 0, -0.4],
    ]);
  });

  it('a sewer run drawn into a pipe ends at its height, its fall kept; at a drain with a pipe it joins that pipe', () => {
    // From a vent terminal at 3.40, 0.60 m from the drain, to the drain, whose pipe leaves it at −0.20.
    const doc: Doc = { ...house, mepPoints: [...house.mepPoints, pt('tv', 'ventTerminal', -0.6, 0, 3.4, 'sys_sewer')] };
    const v = runVertices(doc, 'lvl_ground', 'sys_sewer', [
      { x: -0.6, y: 0 },
      { x: 0, y: 0 },
    ]);
    // Up at the terminal, 1 % over 0.60 m down into the pipe's −0.20: no drop added at the drain, it has one.
    expect(v.map((p) => [p.x, p.y, Math.round(p.z * 1000) / 1000])).toEqual([
      [-0.6, 0, 3.4],
      [-0.6, 0, -0.194],
      [0, 0, -0.2],
    ]);
    // Drawn into a pipe's bare vertex the same: the box's pipe end at −0.30, 2 m away.
    const w = runVertices(house, 'lvl_ground', 'sys_sewer', [
      { x: 5, y: 2 },
      { x: 5, y: 0 },
    ]);
    expect(w.map((p) => Math.round(p.z * 1000) / 1000)).toEqual([-0.28, -0.3]);
  });

  it('a point raised in the panel takes the run\'s vertex on it along', () => {
    let next: Doc = house;
    const solid = mepPointKind.derive(house, house.mepPoints.find((p) => p.id === 'rs')!, deriveGeometry(house))!;
    const fields = mepPointKind.fields!([solid], { dispatch: (c: { apply: (d: Doc) => Doc }) => (next = c.apply(next)), doc: house } as never);
    const height = fields.find((f) => f.id === 'mepHeight') as { set: (v: number) => void };
    height.set(5);
    expect(next.mepPoints.find((p) => p.id === 'rs')!.height).toBe(5);
    expect(next.mepRuns.find((r) => r.id === 'a1')!.points.map((v) => v.z)).toEqual([5, 2.7, 2.7]);
    // The other runs where they were: the panel's conduit starts at the same place, but at 1.50.
    expect(next.mepRuns.find((r) => r.id === 'e1')).toBe(house.mepRuns.find((r) => r.id === 'e1'));
  });

  it('in 3D a run comes down to the points it passes over, not to those it reaches itself', () => {
    const g = deriveGeometry(house);
    const e1 = mepRunKind.derive(house, house.mepRuns.find((r) => r.id === 'e1')!, g)!;
    // The socket under the corner (4, 0) and the one under its end (4, 3), which it stops over; the
    // panel is on its first vertex, the shower under the other run.
    expect(e1.drops.map((d) => [d.to.x, d.to.y, d.from.z, d.to.z])).toEqual([
      [4, 0, 2.7, 0.3],
      [4, 3, 2.7, 0.3],
    ]);
  });

  it('the fittings from the geometry: tees where a branch leaves, elbows where it turns', () => {
    const f = fittingsOf(house).map((x) => [x.group, x.kind, x.diameter, x.count]);
    expect(f).toEqual([
      [GROUP_OF.coldWater, 'elbow90', 0.025, 2],
      [GROUP_OF.power, 'elbow90', 0.025, 2],
      [GROUP_OF.power, 'tee', 0.025, 2],
      [GROUP_OF.sewer, 'elbow90', 0.1, 2],
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]))));
  });

  it('kept in the file', () => {
    expect(house.mepPoints.every(isMepPoint) && house.mepRuns.every(isMepRun)).toBe(true);
    const r = readProject(writeProject(house));
    expect(r.ok && [r.doc.mepPoints.length, r.doc.mepRuns.length]).toEqual([8, 4]);
  });
});

describe('the load table', () => {
  it('the circuits: the sockets together, the shower alone; breaker, section and drop along the conduits', () => {
    const t = loadTable(house);
    expect(t.hasPanel).toBe(true);
    expect(t.unreached).toEqual([]);
    const tug = t.circuits.find((c) => c.name === 'TUG1')!;
    expect([tug.power, tug.voltage, tug.breaker, tug.section]).toEqual([200, 127, 6, 2.5]);
    // The farthest socket: up 1.2, along 4 and 3, down 2.4.
    expect(tug.length).toBeCloseTo(10.6, 9);
    expect(tug.drop).toBeCloseTo(voltageDrop(10.6, 200 / 127, 2.5, 127), 9);
    const tue = t.circuits.find((c) => c.name === 'TUE1')!;
    expect([tue.power, tue.voltage, tue.current, tue.breaker, tue.section]).toEqual([5500, 220, 25, 25, 4]);
    expect(tue.length).toBeCloseTo(1.2 + 3 + 0.5, 9);
    expect(t.total).toBe(5700);
  });

  it('the phases: the 220 V shower across both, the 127 V circuits each on the lighter one', () => {
    expect(balance([{ power: 1000, voltage: 127 }, { power: 5500, voltage: 220 }, { power: 600, voltage: 127 }, { power: 500, voltage: 127 }])).toEqual({ phases: ['A', 'AB', 'B', 'B'], a: 3750, b: 3850 });
    const t = loadTable(house);
    expect(t.circuits.map((c) => [c.name, c.phase])).toEqual([
      ['TUE1', 'AB'],
      ['TUG1', 'A'],
    ]);
    expect(t.phases).toEqual({ a: 2950, b: 2750, imbalance: (200 / 2950) * 100 });
  });

  it('a residual-current device for the circuits of a wet room or the outside, with the rooms known', () => {
    const wall = (id: string, a: [number, number], b: [number, number]) => ({ id, wallTypeId: 'wt_masonry15', start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, referenceLine: 'centerline' as const, levelId: 'lvl_ground', baseOffset: 0, top: { kind: 'level' as const, offset: 0 } });
    // A bathroom from (−1, −1) to (2, 5): the panel, the shower and the socket at (4, 0) is outside it.
    const withRoom: Doc = {
      ...house,
      walls: [wall('a', [-1, -1], [2, -1]), wall('b', [2, -1], [2, 5]), wall('c', [2, 5], [-1, 5]), wall('d', [-1, 5], [-1, -1])],
      rooms: [{ id: 'bath', levelId: 'lvl_ground', seed: { x: 0.5, y: 2 }, name: 'Bath', number: '1', use: 'bathroom' }],
    };
    const t = loadTable(withRoom, deriveGeometry(withRoom));
    expect(t.circuits.map((c) => [c.name, c.dr])).toEqual([
      ['TUE1', 'bathroom'],
      ['TUG1', 'outside'],
    ]);
    expect(loadTable(house).circuits.every((c) => c.dr === null)).toBe(true);
  });

  it('breakers and sections by the current', () => {
    expect(protect(9, 'lighting')).toEqual({ breaker: 10, section: 1.5 });
    expect(protect(18, 'tug')).toEqual({ breaker: 20, section: 2.5 });
    expect(protect(45, 'tue')).toEqual({ breaker: 50, section: 10 });
  });

  it('a point no conduit reaches is said', () => {
    const lone: Doc = { ...house, mepPoints: [...house.mepPoints, pt('t9', 'socket', 9, 9, 0.3, 'sys_power')] };
    const t = loadTable(lone);
    expect(t.unreached.map((p) => p.id)).toEqual(['t9']);
    expect(t.circuits.find((c) => c.name === 'TUG1')!.length).toBeNull();
  });
});

describe('probable demand (CELG D CT 04/18)', () => {
  it('lighting and general outlets band by band; showers by their number; other dedicated outlets whole', () => {
    // 7.2 kW: 0.86 + 0.75 + 0.66 + 0.59 + 0.52 + 0.45 + 0.40 + 0.2 × 0.35 = 4.30 kW.
    expect(generalDemand(7200)).toBeCloseTo(4300, 6);
    // 12 kW: the ten bands (5.16 kW) and 2 kW at 24 %.
    expect(generalDemand(12000)).toBeCloseTo(5160 + 480, 6);
    expect(generalDemand(500)).toBeCloseTo(430, 6);
    expect([showerFactor(1), showerFactor(2), showerFactor(10), showerFactor(12), showerFactor(70)]).toEqual([1, 0.68, 0.3, 0.29, 0.23]);
    // The test house: two sockets of 100 VA and a 5500 VA shower.
    const d = loadTable(house).demand;
    expect(d.general.load).toBe(200);
    expect(d.general.demand).toBeCloseTo(172, 6);
    expect([d.showers.count, d.showers.demand]).toEqual([1, 5500]);
    // A second shower: 11 000 VA at 68 %.
    const two: Doc = { ...house, mepPoints: [...house.mepPoints, pt('ch2', 'shower', 4, 3, 2.2, 'sys_power')] };
    expect(loadTable(two).demand.showers.demand).toBeCloseTo(11000 * 0.68, 6);
  });
});

describe('water and sewer', () => {
  it('NBR 5626:1998 table A.3 by diameter: its row, the next larger for one between, the largest past it', () => {
    expect([equivalentLength('elbow90', 0.025), equivalentLength('elbow45', 0.025), equivalentLength('teeStraight', 0.025), equivalentLength('teeSide', 0.025)]).toEqual([1.5, 0.7, 0.9, 3.1]);
    expect(equivalentLength('elbow90', 0.022)).toBe(1.5);
    expect(equivalentLength('teeSide', 0.1)).toBe(8.3);
    expect(equivalentLength('elbow90', 0.2)).toBe(5.4);
  });

  it('the pressure at an outlet: the tank\'s head less the losses on its way', () => {
    const [p] = pressures(house, 'coldWater');
    expect(p!.head).toBeCloseTo(3.4, 9);
    expect(p!.staticKpa).toBeCloseTo(3.4 * 9.80665, 6);
    const q = probableFlow(0.3) / 1000;
    // NBR 5626:1998 table A.3, 25 mm: the two 90° elbows on its way (down from the tank, then down to the
    // outlet), 1,5 m each.
    const loss = hazenWilliams(q, 0.025) * (1.3 + 3 + 2.1 + 1.5 + 1.5);
    expect(p!.loss).toBeCloseTo(loss, 9);
    expect(p!.dynamicKpa).toBeCloseTo((3.4 - loss) * 9.80665, 6);
    expect(p!.ok).toBe(true);
  });

  it('hot water: a heater a cold pipe reaches takes the tank\'s head and the cold way\'s losses', () => {
    const hot: Doc = {
      ...house,
      mepPoints: [...house.mepPoints, pt('aq', 'heater', 0, 3, 1.8, 'sys_hot'), pt('q1', 'hotOutlet', 2, 3, 0.6, 'sys_hot')],
      mepRuns: [...house.mepRuns, run('a2', 'sys_cold', 0.025, [0, 0, 2.7], [0, 3, 2.7]), run('h1', 'sys_hot', 0.025, [0, 3, 1.8], [2, 3, 1.8])],
    };
    const [q] = pressures(hot, 'hotWater');
    // The tank at 4 m over the outlet at 0.6.
    expect(q!.head).toBeCloseTo(3.4, 9);
    // Cold: 1.3 m down from the tank carrying the cold and the hot outlet (0.3 + 0.3), then out of the tee's
    // side (3,1 m, table A.3, 25 mm) 3 m to over the heater carrying the hot one; hot: 2 m, the elbow (1,5 m)
    // and the 1.2 m drop to the outlet.
    const hw = (w: number, l: number) => hazenWilliams(probableFlow(w) / 1000, 0.025) * l;
    expect(q!.loss).toBeCloseTo(hw(0.6, 1.3) + hw(0.3, 3 + 3.1) + hw(0.3, 2 + 1.2 + 1.5), 9);
    // The cold outlet's way now carries the heater's draw on its first stretch, and its corner is a tee
    // it leaves by the side.
    expect(pressures(hot, 'coldWater')[0]!.loss).toBeCloseTo(hw(0.6, 1.3) + hw(0.3, 3 + 3.1) + hw(0.3, 2.1 + 1.5), 9);
    // No cold pipe to the heater: the heater's own height, as before.
    const alone: Doc = { ...hot, mepRuns: hot.mepRuns.filter((r) => r.id !== 'a2') };
    expect(pressures(alone, 'hotWater')[0]!.head).toBeCloseTo(1.2, 9);
  });

  it('rain (NBR 10844): Q = I·A/60 down the pipes, the least diameter by table 4, the least fall 0.5 %', () => {
    // A 100 mm pipe falling 10 cm in 5 m: 2 %.
    const rain = (area: number | undefined, intensity?: number): Doc => ({
      ...newDocument(),
      ...(intensity ? { simulation: { ...DEFAULT_SIM, rain: intensity } } : {}),
      mepPoints: [pt('ca', 'rainOutlet', 5, 0, -0.4, 'sys_rain'), pt('rp', 'rainDrain', 0, 0, 0, 'sys_rain', area === undefined ? {} : { area })],
      mepRuns: [run('r1', 'sys_rain', 0.1, [0, 0, -0.2], [5, 0, -0.3], [5, 0, -0.4])],
    });
    // 60 m² at 150 mm/h: 150 L/min; a 75 takes 188 at 2 %.
    const [s] = sewerFalls(rain(60), 'rain').stretches;
    expect(s!.flow).toBeCloseTo(150, 9);
    expect([s!.least, s!.ok, s!.needed, s!.sized]).toEqual([0.5, true, 0.075, true]);
    // 120 m²: 300 L/min, past the 75's 188, within the 100's 405.
    expect(sewerFalls(rain(120), 'rain').stretches[0]!.needed).toBe(0.1);
    // 300 m²: 750 L/min, past the 125's 735: a 150, and the 100 drawn does not do.
    const big = sewerFalls(rain(300), 'rain').stretches[0]!;
    expect([big.needed, big.sized]).toEqual([0.15, false]);
    // The project's own design rain: São Paulo (Mirante Santana), 5 years, 172 mm/h.
    expect(sewerFalls(rain(60, 172), 'rain').stretches[0]!.flow).toBeCloseTo(172, 9);
    // A drain with no area: no flow, and said.
    expect(sewerFalls(rain(undefined), 'rain').unsized.map((p) => p.id)).toEqual(['rp']);
    expect(rainCapacity(0.1, 0.4)).toBe(0);
    expect(rainCapacity(0.1, 3)).toBe(405);
    expect(rainDiameter(11000, 4)).toBeNull();
  });

  it('NBR 10844 table 5: 98 places; a short record says the years its value stands for', () => {
    expect(RAIN_PLACES).toHaveLength(98);
    const sp = RAIN_PLACES.find((p) => p.name === 'São Paulo/SP (Mirante Santana)')!;
    expect([rainOf(sp, 1), rainOf(sp, 5), rainOf(sp, 25)]).toEqual([{ value: 122, years: 1 }, { value: 172, years: 5 }, { value: 191, years: 7 }]);
    // Alto Teresópolis: the "5-year" value is of 3 years, and there is no 25-year one.
    const at = RAIN_PLACES.find((p) => p.name === 'Alto Teresópolis/RJ')!;
    expect([rainOf(at, 5), rainOf(at, 25)]).toEqual([{ value: 137, years: 3 }, null]);
    expect(new Set(RAIN_PLACES.map((p) => p.name)).size).toBe(98);
  });

  it('UHC and diameters (NBR 8160): a toilet asks a 100 mm branch; 25 units pass a 75; 250 at 1 % pass a 100', () => {
    const withToilet: Doc = { ...house, mepPoints: house.mepPoints.map((p) => (p.id === 'ralo' ? { ...p, fixture: 'toilet' as const } : p)) };
    const [s] = sewerFalls(withToilet).stretches;
    expect([s!.uhc, s!.needed, s!.sized]).toEqual([6, 0.1, true]);
    expect(sewerFalls(withToilet).unsized).toEqual([]);
    // The same on a 75 mm pipe: the toilet's branch is 100.
    const narrow: Doc = { ...withToilet, mepRuns: withToilet.mepRuns.map((r) => (r.id === 's1' ? { ...r, diameter: 0.075 } : r)) };
    expect(sewerFalls(narrow).stretches[0]!.sized).toBe(false);
    // A drain with no fixture said: no units, and said.
    expect(sewerFalls(house).unsized.map((p) => p.id)).toEqual(['ralo']);
    expect(neededDiameter(20, 2, 0.04)).toBe(0.075);
    expect(neededDiameter(25, 2, 0.04)).toBe(0.1);
    // DN 100 at 1 %: 180 as a collector (more than the branch's 160); 250 needs DN 150.
    expect(mostUhc(0.1, 1)).toBe(180);
    expect(neededDiameter(250, 1, 0)).toBe(0.15);
    // At 0.5 % DN 100 and 150 are not allowed as collectors: only DN 200 there.
    expect(neededDiameter(500, 0.5, 0)).toBe(0.2);
  });

  it('stacks and vents (NBR 8160 tables 6 and 2): sized, and their open ends over the roof', () => {
    // Two storeys: a toilet upstairs on a branch to a 100 mm stack at the origin, from 6.00 down to the
    // collector at −0.20; its top 0.40 over the top level's ceiling (5.60).
    const upper = { id: 'lvl_1', name: 'Upper', elevation: 2.8, height: 2.8 };
    const twoStorey: Doc = {
      ...house,
      levels: [...house.levels, upper],
      mepPoints: [...house.mepPoints.filter((p) => p.id !== 'ralo'), { ...pt('bs', 'drain', 0.6, 0, 0, 'sys_sewer', { fixture: 'toilet' }), levelId: 'lvl_1' }],
      mepRuns: [...house.mepRuns, run('tq', 'sys_sewer', 0.1, [0, 0, 6], [0, 0, -0.2]), { ...run('r1', 'sys_sewer', 0.1, [0.6, 0, -0.1], [0, 0, -0.1]), levelId: 'lvl_1' }],
    };
    const { stacks, vented } = sewerStacks(twoStorey, []);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toMatchObject({ kind: 'stack', uhc: 6, needed: 0.1, sized: true, runIds: ['tq'], cover: 5.6, through: true });
    expect(stacks[0]!.above).toBeCloseTo(0.4, 9);
    expect(stacks[0]!.length).toBeCloseTo(6.2, 9);
    expect(vented).toBe(true);
    // Under a roof face at 6.50 over it: its end is 0.50 under it, not out.
    const roof = { faces: [{ polygon: [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }], z: () => 6.5 }] };
    const covered = sewerStacks(twoStorey, [roof]);
    expect(covered.stacks[0]!.through).toBe(false);
    expect(covered.vented).toBe(false);
    // One storey: a toilet on the collector and a 50 mm vent pipe up from its start to 3.20, over the ceiling (2.80).
    const withToilet: Doc = { ...house, mepPoints: house.mepPoints.map((p) => (p.id === 'ralo' ? { ...p, fixture: 'toilet' as const } : p)) };
    expect(sewerStacks(withToilet, [])).toMatchObject({ stacks: [], vented: false, fixtures: 1 });
    const withVent: Doc = { ...withToilet, mepRuns: [...withToilet.mepRuns, run('v1', 'sys_sewer', 0.05, [0, 0, -0.2], [0, 0, 3.2])] };
    const v = sewerStacks(withVent, []);
    // It vents the 100 mm collector carrying 6 UHC: table 2's row DN 100 up to 43 UHC, a 50 mm vent up to 11 m.
    expect(v.stacks[0]).toMatchObject({ kind: 'vent', uhc: 6, vented: 0.1, needed: 0.05, sized: true, through: true });
    expect(v.vented).toBe(true);
    // Its group (table 8): the toilet it vents, 6 UHC with a toilet, DN 50; its trap 0.20 down to the vent's foot (table 1: 2.40 m for DN 100).
    expect(v.stacks[0]!.group).toEqual({ uhc: 6, toilet: true, needed: 0.05 });
    expect(v.traps).toHaveLength(1);
    expect(v.traps[0]).toMatchObject({ dn: 0.1, most: 2.4, vent: 0, ok: true });
    expect(v.traps[0]!.distance).toBeCloseTo(0.2, 9);
    // In the two-storey house the toilet's trap is vented by the stack out over the roof: 0.10 down and 0.60 along.
    expect(sewerStacks(twoStorey, []).traps[0]!.distance).toBeCloseTo(0.7, 9);
    // Under the roof the stack vents nothing: no vent reached.
    expect(covered.traps[0]).toMatchObject({ distance: null, vent: null, ok: false });
    // A kitchen sink by its own branch onto the collector 1.50 m along: past the 1.20 m of DN 50; the vent's group now 9 UHC.
    const withSink: Doc = {
      ...withVent,
      mepPoints: [...withVent.mepPoints, pt('pia', 'drain', 1.5, 0.6, 0, 'sys_sewer', { fixture: 'kitchenSink' })],
      mepRuns: [...withVent.mepRuns, run('rp', 'sys_sewer', 0.05, [1.5, 0.6, -0.2], [1.5, 0, -0.23])],
    };
    const s = sewerStacks(withSink, []);
    const sink = s.traps.find((x) => x.point.id === 'pia')!;
    expect(sink).toMatchObject({ dn: 0.05, most: 1.2, vent: 0, ok: false });
    expect(sink.distance).toBeGreaterThan(1.5);
    expect(s.stacks[0]!.group).toEqual({ uhc: 9, toilet: true, needed: 0.05 });
    // Table 8 as it reads: without a toilet up to 12, 18, 36; with one up to 17 and 60.
    expect([ventBranchDiameter(12, false), ventBranchDiameter(13, false), ventBranchDiameter(36, false), ventBranchDiameter(37, false)]).toEqual([0.04, 0.05, 0.075, null]);
    expect([ventBranchDiameter(17, true), ventBranchDiameter(18, true), ventBranchDiameter(60, true), ventBranchDiameter(61, true)]).toEqual([0.05, 0.075, 0.075, null]);
    // Table 1 by the branch.
    expect([trapReach(0.04), trapReach(0.05), trapReach(0.075), trapReach(0.1)]).toEqual([1, 1.2, 1.8, 2.4]);
    // A 40 mm vent over a group with a toilet is under table 8's DN 50: not sized.
    const thin: Doc = { ...withToilet, mepRuns: [...withToilet.mepRuns, run('v1', 'sys_sewer', 0.04, [0, 0, -0.2], [0, 0, 3.2])] };
    expect(sewerStacks(thin, []).stacks[0]!.sized).toBe(false);
    // Table 6 by storeys, never under the largest branch; table 2 by the vented pipe, its UHC and length.
    expect([stackDiameter(30, 3, 0), stackDiameter(31, 3, 0), stackDiameter(31, 4, 0), stackDiameter(241, 3, 0), stackDiameter(6, 2, 0.1), stackDiameter(9000, 4, 0)]).toEqual([0.075, 0.1, 0.075, 0.15, 0.1, null]);
    expect([ventDiameter(0.075, 21, 40), ventDiameter(0.075, 21, 10), ventDiameter(0.1, 600, 10), ventDiameter(0.04, 8, 50)]).toEqual([0.075, 0.04, null, null]);
    // Table 7 to DN 400.
    expect(neededDiameter(2000, 1, 0)).toBe(0.25);
    expect(neededDiameter(11000, 4, 0)).toBe(0.4);
  });

  it('eave gutters (NBR 10844): each sloped face\'s contribution area, its flow and the least gutter of table 3', () => {
    // A 10 × 6 m roof at 30 %, no overhang: each slope 3 m deep in plan, rising 0.90.
    const outline = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }];
    const roof = (kind: Roof['kind']): Roof => ({ id: `roof_${kind}`, levelId: 'lvl_ground', outline, edges: edgesFor(kind, outline, 30, 0), kind, thickness: 0.12, baseOffset: 0 });
    const gable = gutters([roofSolid(roof('gable'), 2.8)], 150);
    expect(gable).toHaveLength(2);
    for (const x of gable) {
      expect(x.eaves).toBeCloseTo(10, 6);
      expect(x.plan).toBeCloseTo(30, 6);
      // (a + h/2)·b = (3 + 0.45) × 10.
      expect(x.area).toBeCloseTo(34.5, 6);
      expect(x.flow).toBeCloseTo((150 * 34.5) / 60, 6);
      expect(x.diameter).toBe(0.1);
    }
    // Four slopes: the hip ends triangles 6 m wide, 3 deep: 9 m² in plan and half of 6 × 0.90 / 2 upright.
    const hip = gutters([roofSolid(roof('hip'), 2.8)], 150);
    expect(hip).toHaveLength(4);
    const ends = hip.filter((x) => Math.abs(x.eaves - 6) < 1e-6);
    expect(ends).toHaveLength(2);
    for (const x of ends) expect(x.area).toBeCloseTo(9 + 1.35, 6);
    // A heavy rain on the long slopes asks a 150 mm gutter; a flat roof none.
    expect(gutters([roofSolid(roof('gable'), 2.8)], 600)[0]!.diameter).toBe(0.15);
    expect(gutters([roofSolid(roof('flat'), 2.8)], 150)).toEqual([]);
    // Past table 3: none.
    expect(gutters([roofSolid(roof('gable'), 2.8)], 2000)[0]!.diameter).toBeNull();
  });

  it('the sewer\'s falls: 2 % on a 100 mm pipe holds, a flat one does not', () => {
    const f = sewerFalls(house);
    expect(f.hasOutlet).toBe(true);
    expect(f.unreached).toEqual([]);
    expect(f.stretches).toHaveLength(1);
    expect(f.stretches[0]!.slope).toBeCloseTo(2, 9);
    expect(f.stretches[0]!.ok).toBe(true);
    const flat: Doc = { ...house, mepRuns: house.mepRuns.map((r) => (r.id === 's1' ? run('s1', 'sys_sewer', 0.1, [0, 0, -0.3], [5, 0, -0.3], [5, 0, -0.4]) : r)) };
    expect(sewerFalls(flat).stretches[0]!.ok).toBe(false);
  });
});

describe('coordination', () => {
  const column = { id: 'col_1', levelId: 'lvl_ground', at: { x: 2, y: 0 }, width: 0.2, depth: 0.2, angle: 0 };
  const withColumn: Doc = { ...house, columns: [column] };

  it('a conduit through a column is a clash; moved aside it is not', () => {
    const c = clashesOf(withColumn, deriveGeometry(withColumn));
    // The conduit and the cold pipe also lie along one line at 2.70, and the pipe comes down onto the
    // second conduit's start (the runs' clashes, first).
    expect(c.map((x) => [x.runId, x.elementId])).toEqual([
      ['e1', 'a1'],
      ['e2', 'a1'],
      ['e1', 'col_1'],
      ['a1', 'col_1'],
    ]);
    const aside: Doc = { ...withColumn, columns: [{ ...column, at: { x: 2, y: 1.5 } }] };
    expect(clashesOf(aside, deriveGeometry(aside)).map((x) => [x.runId, x.elementId])).toEqual([
      ['e1', 'a1'],
      ['e2', 'a1'],
    ]);
  });

  it('runs of two disciplines touching are a clash; 10 cm apart, or of one network, they are not', () => {
    const apart: Doc = { ...house, mepRuns: house.mepRuns.map((r) => (r.id === 'a1' ? run('a1', 'sys_cold', 0.025, [0, -0.1, 4], [0, -0.1, 2.7], [3, -0.1, 2.7]) : r)) };
    expect(clashesOf(apart, deriveGeometry(apart))).toEqual([]);
    // Crossing it at its height: the gap between the axes (0) less than the radii.
    const across: Doc = { ...apart, mepRuns: [...apart.mepRuns, run('x1', 'sys_gas', 0.022, [2, -1, 2.7], [2, 1, 2.7])] };
    const c = clashesOf(across, deriveGeometry(across));
    // Across the conduit and the moved cold pipe alike.
    expect(c.map((x) => [x.runId, x.elementId, Math.round(x.at.x * 100) / 100, Math.round(x.at.y * 100) / 100 + 0])).toEqual([
      ['e1', 'x1', 2, 0],
      ['a1', 'x1', 2, -0.1],
    ]);
    // The two power conduits meet at (0, 0, 2.70): one network, no clash.
    expect(c.some((x) => x.runId === 'e1' && x.elementId === 'e2')).toBe(false);
  });

  it('the analytic model and its warnings', () => {
    const thin: Doc = { ...newDocument(), columns: [{ ...column, width: 0.15 }] };
    const m = analyticModel(deriveGeometry(thin));
    expect(m.bars).toHaveLength(1);
    expect(m.bars[0]!.length).toBeCloseTo(2.8, 9);
    expect(m.warnings.map((w) => w.kind)).toEqual(['columnThin']);
  });

  it('the wet rooms\' waterproofing, and the isometric drawing', () => {
    expect(waterproofing(newDocument(), deriveGeometry(newDocument()))).toEqual([]);
    const svg = isometricSvg(house, house.mepRuns);
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<polyline/g) ?? []).length).toBe(4);
    expect((svg.match(/<circle/g) ?? []).length).toBe(8);
    // The drops: two sockets, the shower, the cold outlet, the drain (the panel, the tank and the box are on their runs).
    expect((svg.match(/<line/g) ?? []).length).toBe(5);
  });
});
