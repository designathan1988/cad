// The sectors' families (children, commerce, health, school) at the ends of every parameter's range: each
// still closes and stays on the floor; the toy chest's lid turns about its hinge (closed it lies on the box,
// open it stands at the back); the mobile whiteboard stands on its castors.

import { describe, expect, it } from 'vitest';
import { BUILT_IN_MATERIALS } from '../../src/elements/material/schema';
import { evaluateObject, type Piece } from '../../src/elements/object/evaluate';
import { boxCorners, pieceSpan } from '../../src/elements/object/piece-shape';
import { LIBRARY } from '../../src/elements/object/library';
import * as THREE from 'three';
import { byMaterial, cutGeometries } from '../../src/elements/kinds/object';
import { GONDOLA, HOUSE_BED, LIBRARY_SECTORS, TOY_CHEST, WHITEBOARD } from '../../src/elements/object/library-sectors';
import type { ObjectDefinition } from '../../src/elements/object/schema';
import { objid } from '../ids';

const context = { definitions: LIBRARY, materials: BUILT_IN_MATERIALS };
const at = (def: ObjectDefinition, typeId: string, values: Record<string, number | string>) =>
  evaluateObject(def, { id: objid('o'), levelId: 'l', definitionId: def.id, typeId, at: { x: 0, y: 0 }, angle: 0, elevation: 0, values }, context);
const low = (pieces: readonly Piece[]) => Math.min(...pieces.filter((p) => !p.cut).map((p) => pieceSpan(p).bottom));
const tilted = (pieces: readonly Piece[]) => pieces.filter((p): p is Extract<Piece, { kind: 'box' }> => p.kind === 'box' && p.material.id === 'lacquerSage' && p.w > 0.5);

describe('the sectors at the ends of their ranges', () => {
  for (const def of LIBRARY_SECTORS) {
    it(`${def.name.en}: every parameter at its least and most`, () => {
      for (const p of def.params) {
        if (p.formula !== undefined || (p.kind !== 'length' && p.kind !== 'number' && p.kind !== 'integer')) continue;
        for (const v of [p.min, p.max]) {
          if (v === undefined) continue;
          for (const type of def.types) {
            const ev = at(def, type.id, { [p.name]: v });
            expect(ev.problems, `${type.id}, ${p.name} = ${v}`).toEqual([]);
            expect(ev.pieces.length, `${type.id}, ${p.name} = ${v}`).toBeGreaterThan(0);
            expect(low(ev.pieces), `${type.id}, ${p.name} = ${v}: lowest point`).toBeGreaterThan(-0.005);
          }
        }
      }
    });
  }
});

describe('drawn in 3D', () => {
  it('a gondola of 160 pieces is one geometry a material, with every triangle', () => {
    const ev = at(GONDOLA, 'goods', {});
    const parts = cutGeometries(ev.pieces);
    const triangles = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    const before = parts.reduce((s, p) => s + triangles(p.geometry), 0);
    const materials = new Set(ev.pieces.map((p) => p.material.id));
    expect(ev.pieces.length).toBeGreaterThan(150);
    const merged = byMaterial(parts);
    expect(merged.length).toBe(materials.size);
    expect(merged.reduce((s, p) => s + triangles(p.geometry), 0)).toBe(before);
  });
});

describe('an object never folds up', () => {
  it('a house bed made 1 cm high keeps its least height, its posts and roof whole', () => {
    const ev = at(HOUSE_BED, 'single', { altura: 0.01 });
    expect(ev.env['altura']).toBe(1.3);
    expect(ev.lost).toBe(0);
    expect(low(ev.pieces)).toBeGreaterThan(-0.005);
  });
});

describe('the toy chest lid turns about its hinge', () => {
  it('closed, it lies on the box', () => {
    const ev = at(TOY_CHEST, 'open', { tampa: 0, matTampa: 'lacquerSage' });
    const [lid] = tilted(ev.pieces);
    const corners = boxCorners(lid!);
    expect(Math.min(...corners.map((q) => q.y))).toBeCloseTo(-0.21, 3);
    expect(Math.max(...corners.map((q) => q.y))).toBeCloseTo(0.21, 3);
    expect(Math.max(...corners.map((q) => q.z))).toBeCloseTo(0.45, 3);
  });

  it('open, it stands up from the back edge', () => {
    const ev = at(TOY_CHEST, 'open', { tampa: 90 });
    const [lid] = tilted(ev.pieces);
    const corners = boxCorners(lid!);
    // Standing on the back edge: no corner in front of the back, none below the rim, up a lid's depth.
    expect(Math.min(...corners.map((q) => q.y))).toBeGreaterThan(0.21 - 0.03);
    expect(Math.min(...corners.map((q) => q.z))).toBeGreaterThan(0.45 - 0.03);
    expect(Math.max(...corners.map((q) => q.z))).toBeCloseTo(0.45 + 0.42, 2);
  });
});

describe('the mobile whiteboard', () => {
  it('stands on its castors, each under a foot', () => {
    const pieces = at(WHITEBOARD, 'mobile', {}).pieces;
    expect(low(pieces)).toBeCloseTo(0, 3);
    const feet = pieces.filter((p): p is Extract<Piece, { kind: 'box' }> => p.kind === 'box' && p.h === 0.04);
    const castors = pieces.filter((p) => p.kind === 'sphere');
    expect(castors.length).toBe(4);
    for (const c of castors) {
      expect(feet.some((f) => Math.abs(c.cx - f.cx) <= f.w / 2 + 0.03 && Math.abs(c.cy - f.cy) <= f.d / 2), `castor at ${c.cx}, ${c.cy}`).toBe(true);
    }
  });
  it('on the wall it has no stand', () => {
    expect(at(WHITEBOARD, 'white', {}).pieces.length).toBeLessThan(at(WHITEBOARD, 'mobile', {}).pieces.length);
  });
});
