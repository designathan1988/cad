// A stair's well through the floor it reaches, and the guardrail round it.

import { describe, expect, it } from 'vitest';
import { type Doc, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { railingKind } from '../../src/elements/kinds/railing';
import type { RailingSolid } from '../../src/elements/kinds/railing';
import { wellPath } from '../../src/elements/railing/schema';
import type { Floor } from '../../src/elements/room/schema';
import { firstFlight, stairSolid, stairWell } from '../../src/elements/stair/geometry';
import type { Stair } from '../../src/elements/stair/schema';
import { arrivalOf, levelReached, wellsReaching } from '../../src/elements/stair/well';
import { signedArea } from '../../src/elements/wall/geometry/convex';
import { readProject, writeProject } from '../../src/io/project-file';
import type { FloorSolid } from '../../src/elements/room/derive';

const upper = { id: 'lvl_up', name: 'Upper', elevation: 2.8, height: 2.8 };
const stair = (kind: Stair['kind'], extra: Partial<Stair> = {}): Stair => ({
  id: 'stair_s',
  levelId: 'lvl_ground',
  kind,
  at: { x: 0, y: 0 },
  angle: Math.PI / 2,
  width: 1,
  tread: 0.28,
  turn: 'left',
  ...extra,
});
const slab: Floor = { id: 'floor_f', levelId: 'lvl_up', source: { kind: 'outline', points: [{ x: -4, y: -1 }, { x: 4, y: -1 }, { x: 4, y: 6 }, { x: -4, y: 6 }] }, thickness: 0.15, offset: 0 };
const docOf = (s: Stair, extra: Partial<Doc> = {}): Doc => ({ ...newDocument(), levels: [...newDocument().levels, upper], stairs: [s], floors: [slab], ...extra });

describe('a stair well', () => {
  it("is the stair's steps and landing united: a U's flights side by side", () => {
    const s = stairSolid(stair('u'), 2.8, 0);
    const well = stairWell(s);
    expect(signedArea(well)).toBeGreaterThan(0);
    // 16 risers: 8 steps up, the landing, 7 back: two flights of 1 m, 8 × 0.28 + 1 long, less one step on one side.
    expect(Math.abs(signedArea(well))).toBeCloseTo(2 * (8 * 0.28 + 1) - 0.28, 6);
  });

  it('cuts the floor it reaches (and only that one): its area less the well', () => {
    const doc = docOf(stair('straight'));
    expect(levelReached(doc, doc.stairs[0]!)).toBe('lvl_up');
    expect(wellsReaching(doc, 2.8)).toHaveLength(1);
    expect(wellsReaching(doc, 2.0)).toHaveLength(0);
    const f = deriveGeometry(doc).kinds.get('floors')!.get('floor_f') as FloorSolid;
    expect(f.holes).toHaveLength(1);
    expect(f.area).toBeCloseTo(8 * 7 - 16 * 0.28 * 1, 6);
    // Its own setting closes it.
    const closed = deriveGeometry(docOf(stair('straight', { well: false }))).kinds.get('floors')!.get('floor_f') as FloorSolid;
    expect(closed.holes).toHaveLength(0);
  });

  it("an L's or a U's first flight takes its own number of steps, one at least on each side of the landing", () => {
    expect(firstFlight(stair('u'), 16)).toBe(8);
    expect(firstFlight(stair('u', { split: 5 }), 16)).toBe(5);
    expect(firstFlight(stair('u', { split: 40 }), 16)).toBe(14);
  });
});

describe('winders', () => {
  it("turn an L's corner by three steps and a U's by six, each a riser, none a landing", () => {
    const l = stairSolid(stair('l', { winders: true }), 2.8, 0);
    const u = stairSolid(stair('u', { winders: true }), 2.8, 0);
    expect(l.parts).toHaveLength(16);
    expect(u.parts).toHaveLength(16);
    expect(l.parts.every((p) => !p.landing) && u.parts.every((p) => !p.landing)).toBe(true);
    // Each part one riser above the one before, from the first to the last.
    for (const s of [l, u]) s.parts.forEach((p, i) => expect(p.top).toBeCloseTo((i + 1) * s.riser, 9));
    // Three winders fill the L's corner square, 1 m by 1 m.
    const fans = l.parts.slice(firstFlight(l.stair, 16), firstFlight(l.stair, 16) + 3);
    expect(fans.reduce((a, p) => a + Math.abs(signedArea(p.polygon)), 0)).toBeCloseTo(1, 6);
  });
});

describe('the guardrail round a well', () => {
  it('goes round it but where the stair arrives', () => {
    const square = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    // Arriving on the top side's right half (from x = 2 to x = 1): open there, guarded from x = 1 round to x = 2.
    const path = wellPath(square, { x: 2, y: 2 }, { x: 1, y: 2 });
    expect(path[0]).toEqual({ x: 1, y: 2 });
    expect(path.at(-1)).toEqual({ x: 2, y: 2 });
    expect(path).toHaveLength(5);
  });

  it("held by its stair, it follows it; it reads back from a file, and goes with the stair's deletion", () => {
    const s = stair('u');
    const solid = stairSolid(s, 2.8, 0);
    const [a, b] = arrivalOf(solid)!;
    const railing = { id: 'railing_r', levelId: 'lvl_up', points: wellPath(stairWell(solid), a, b), height: 1.1, baseOffset: 0, host: { stairId: s.id } };
    const doc = docOf(s, { railings: [railing] });
    const moved = { ...doc, stairs: [{ ...s, at: { x: 1, y: 0 } }] };
    const r0 = deriveGeometry(doc).kinds.get('railings')!.get('railing_r') as RailingSolid;
    const r1 = deriveGeometry(moved).kinds.get('railings')!.get('railing_r') as RailingSolid;
    expect(r1.points[0]!.x - r0.points[0]!.x).toBeCloseTo(1, 9);
    const back = readProject(writeProject(doc));
    expect(back.ok && back.doc.railings).toEqual([railing]);
    expect(back.ok && back.fixes).toEqual([]);
    expect(railingKind.holders!(railing)).toEqual([s.id]);
  });
});

describe("the guardrail along a floor's edge", () => {
  it('goes all round its outline, closed, on its top; raising the floor takes it along', () => {
    const r = { id: 'railing_e', levelId: 'lvl_up', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], height: 1.1, baseOffset: 0, host: { floorId: 'floor_f' } };
    const doc = docOf(stair('straight', { well: false }), { railings: [r] });
    const s = deriveGeometry(doc).kinds.get('railings')!.get('railing_e') as RailingSolid;
    expect(s.points).toHaveLength(5);
    expect(s.points[0]).toEqual(s.points[4]);
    expect(s.bottom).toBeCloseTo(2.8, 9);
    const raised = { ...doc, floors: [{ ...slab, offset: 0.2 }] };
    expect((deriveGeometry(raised).kinds.get('railings')!.get('railing_e') as RailingSolid).bottom).toBeCloseTo(3, 9);
    expect(railingKind.holders!(r)).toEqual(['floor_f']);
  });
});
