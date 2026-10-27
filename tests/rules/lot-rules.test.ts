// Phase 12: rules by pack, on rooms and on the lot; the table of areas; the compliance report.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { lotReport } from '../../src/app/lot-areas';
import { DEFAULT_LOT, isLot } from '../../src/app/lot';
import { newOpening } from '../../src/elements/opening/schema';
import { checkRules, complianceReport, leastWidth, LOT_ELEMENT } from '../../src/rules/check';
import { importPacks } from '../../src/rules/commands';
import { DEFAULT_RULES, rulesOf } from '../../src/rules/schema';
import { CURRENT_VERSION, readProject, writeProject } from '../../src/io/project-file';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// A 10 × 8 m house (centre lines), on a 20 × 30 m lot with its front (side 0) on y = 0, the house 5 m back
// and 4 m from the left side.
const square = (x0: number, y0: number, w: number, d: number) => [
  { x: x0, y: y0 },
  { x: x0 + w, y: y0 },
  { x: x0 + w, y: y0 + d },
  { x: x0, y: y0 + d },
];
const house: Doc = {
  ...newDocument(),
  walls: [wall('s', [4, 5], [14, 5]), wall('e', [14, 5], [14, 13]), wall('n', [14, 13], [4, 13]), wall('w', [4, 13], [4, 5])],
  openings: [newOpening('win', 's', 'window', { kind: 'centered' }, { width: 2, height: 1.2, sill: 1 })],
  rooms: [{ id: 'room', levelId: 'lvl_ground', seed: { x: 9, y: 9 }, name: 'Sala', number: '1', use: 'living' }],
  terrains: [{ id: 'terrain_1', levelId: 'lvl_ground', outline: square(0, 0, 20, 30), spots: [], interval: 0.5 }],
};

describe('the lot and its table of areas', () => {
  it('built area to the outer faces, projection, shares, setbacks and height', () => {
    const r = lotReport(house, deriveGeometry(house));
    expect(r.lotArea).toBeCloseTo(600, 9);
    // 10.2 × 8.2 to the outer faces of 20 cm walls.
    expect(r.levels).toHaveLength(1);
    expect(r.built).toBeCloseTo(10.2 * 8.2, 6);
    expect(r.projection).toBeCloseTo(10.2 * 8.2, 6);
    expect(r.occupancy).toBeCloseTo((10.2 * 8.2 * 100) / 600, 6);
    expect(r.floorRatio).toBeCloseTo((10.2 * 8.2) / 600, 6);
    expect(r.permeability).toBeCloseTo(100 - (10.2 * 8.2 * 100) / 600, 6);
    expect(r.setbacks.front).toBeCloseTo(4.9, 6);
    // The back is the side farthest from the front: y = 30, 30 − 13.1.
    expect(r.setbacks.back).toBeCloseTo(16.9, 6);
    // The sides: x = 0 (3.9) and x = 20 (5.9); the least.
    expect(r.setbacks.side).toBeCloseTo(3.9, 6);
    expect(r.height).toBeCloseTo(2.8, 6);
  });

  it('a patio drawn outside the house is paving: the permeable share less it, its overlap with the house once', () => {
    // A 6 × 3 m patio in front of the house, 1 m of it under the house's south wall (y 4 to 7, x 6 to 12).
    const patio = { id: 'floor_p', levelId: 'lvl_ground', source: { kind: 'outline' as const, points: square(6, 3, 6, 3) }, thickness: 0.1, offset: 0 };
    const withPatio: Doc = { ...house, floors: [patio as never] };
    const r = lotReport(withPatio, deriveGeometry(withPatio));
    // Outside the projection (which starts at y = 4.9): 6 × 1.9.
    expect(r.paving).toBeCloseTo(6 * 1.9, 6);
    expect(r.permeability).toBeCloseTo(100 - ((10.2 * 8.2 + 6 * 1.9) * 100) / 600, 6);
    // The occupancy is the building's alone.
    expect(r.occupancy).toBeCloseTo((10.2 * 8.2 * 100) / 600, 6);
    // A ceiling is no paving.
    const ceiling: Doc = { ...house, floors: [{ ...patio, kind: 'ceiling' } as never] };
    expect(lotReport(ceiling, deriveGeometry(ceiling)).paving).toBeCloseTo(0, 9);
  });

  it('the lot rules take the lot\'s parameters: a setback short of it is found, cited', () => {
    const doc: Doc = { ...house, lot: { address: '', city: 'São Paulo', state: 'SP', registry: '', taxNumber: '', zone: 'ZM', law: 'LPUOS', frontEdge: 0, front: 5, maxOccupancy: 70 } };
    const findings = checkRules(deriveGeometry(doc), rulesOf(doc), doc);
    const lot = findings.filter((f) => f.elementId === LOT_ELEMENT);
    expect(lot.map((f) => f.rule.subject)).toEqual(['setbackFront']);
    expect(lot[0]!.min).toBe(5);
    expect(lot[0]!.value).toBeCloseTo(4.9, 6);
    expect(lot[0]!.rule.article).toBe('Quadro 3');
  });
});

describe('room rules', () => {
  it('a room\'s ceiling, by its use; its windows over its floor', () => {
    const low: Doc = { ...house, rooms: [{ ...house.rooms[0]!, height: 2.4 }] };
    const f = checkRules(deriveGeometry(low), rulesOf(low), low).filter((x) => x.elementId === 'room');
    // A living room under 2.50 m; the 2.30 m rule is for bathrooms and the like, not for it.
    expect(f.map((x) => [x.rule.id, x.value])).toEqual([['rule_ceiling', 2.4]]);
    // A bathroom at 2.40 m holds.
    const bath: Doc = { ...low, rooms: [{ ...low.rooms[0]!, use: 'bathroom' }] };
    expect(checkRules(deriveGeometry(bath), rulesOf(bath), bath).filter((x) => x.elementId === 'room')).toEqual([]);
    // A window rule of 1/6 (16.67 %): 2.4 m² of window over 9.8 × 7.8 m of floor is less.
    const rules = rulesOf(house).map((r) => (r.id === 'rule_windows' ? { ...r, min: 16.67 } : r));
    const w = checkRules(deriveGeometry(house), rules, house).find((x) => x.rule.id === 'rule_windows')!;
    expect(w.value).toBeCloseTo((2.4 / (9.8 * 7.8)) * 100, 6);
  });

  it('a room\'s least width: the widest circle that fits, to 5 mm; an L by its narrower arm, not its hull', () => {
    expect(Math.abs(leastWidth(square(0, 0, 4, 3)) - 3)).toBeLessThan(0.005);
    // An L of 4 × 4 with arms 1.2 m wide: the old hull gave 4.
    const l = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1.2 }, { x: 1.2, y: 1.2 }, { x: 1.2, y: 4 }, { x: 0, y: 4 }];
    // In the corner a circle a little wider than the arms fits, touching the two outer walls and the inner
    // corner: r·√2 + r = 1.2·√2, a diameter of 2·1.2·√2 / (1 + √2) ≈ 1.406.
    expect(Math.abs(leastWidth(l) - (2 * 1.2 * Math.SQRT2) / (1 + Math.SQRT2))).toBeLessThan(0.005);
  });
});

describe('the compliance report', () => {
  it('rule by rule: holds, fails, no bound yet, nothing to check, off', () => {
    const doc: Doc = { ...house, lot: { address: '', city: '', state: '', registry: '', taxNumber: '', zone: '', law: '', frontEdge: 0, front: 5 } };
    const report = complianceReport(deriveGeometry(doc), rulesOf(doc), doc);
    const state = (id: string) => report.find((r) => r.rule.id === id)!.status;
    expect(state('rule_ceiling')).toBe('ok');
    expect(state('rule_setbackFront')).toBe('fails');
    expect(state('rule_windows')).toBe('unset');
    expect(state('rule_lotOccupancy')).toBe('unset');
    expect(state('rule_riser')).toBe('nothing');
    expect(state('rule_stairWidth')).toBe('off');
  });
});

describe('packs and older files', () => {
  it('a file from before packs keeps its own rules, in their pack, and gets the new ones', () => {
    const old = { ...newDocument(), rules: [{ id: 'rule_door', subject: 'doorWidth', min: 0.9, source: 'Meu escritório', on: true }] };
    const text = writeProject(old as Doc).replace(`"version": ${CURRENT_VERSION}`, '"version": 33');
    const r = readProject(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const door = r.doc.rules!.find((x) => x.id === 'rule_door')!;
    expect([door.min, door.source, door.pack]).toEqual([0.9, 'Meu escritório', 'pack_abnt']);
    expect(r.doc.rules!.length).toBe(DEFAULT_RULES.length);
    expect(r.doc.rules!.some((x) => x.id === 'rule_ceiling')).toBe(true);
  });

  it('a pack imported replaces the pack of the same id, its rules too', () => {
    const doc = importPacks([{ id: 'pack_sp', name: 'SP 2026', jurisdiction: 'city' }], [{ id: 'rule_x', subject: 'roomArea', min: 6, source: 'COE', on: true, pack: 'pack_sp' }]).apply(newDocument());
    expect(doc.rulePacks!.find((p) => p.id === 'pack_sp')!.name).toBe('SP 2026');
    expect(doc.rules!.filter((r) => r.pack === 'pack_sp').map((r) => r.id)).toEqual(['rule_x']);
    expect(doc.rules!.some((r) => r.id === 'rule_riser')).toBe(true);
  });
});

describe('who it is for and who answers for it', () => {
  it('the owner, the office and the professional with their registration are kept in the file; a number is not a name', () => {
    const lot = { ...DEFAULT_LOT, owner: 'Maria', firm: 'Estúdio', responsible: 'Ana', license: 'CAU A12345-6', record: 'RRT 1234567' };
    const r = readProject(writeProject({ ...newDocument(), lot }));
    expect(r.ok && r.doc.lot).toEqual(lot);
    expect(isLot({ ...DEFAULT_LOT, owner: 7 })).toBe(false);
  });
});
