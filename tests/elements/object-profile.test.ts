// A profile part: its corners as formulas of the parameters, extruded; its plan outline the polygon.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/app/document';
import { pieceGeometry } from '../../src/elements/kinds/object';
import { evaluateObject, pieceOutline, pieceSpan } from '../../src/elements/object/evaluate';
import type { ObjectDefinition } from '../../src/elements/object/schema';
import { isDefinition } from '../../src/elements/object/valid';

/** An L-shaped counter: its arms as wide as `fundo`, its length `largura`, `lado` the other arm. */
const counter: ObjectDefinition = {
  id: 'def_l',
  name: { pt: 'Bancada em L', en: 'L counter' },
  category: 'furniture',
  params: [
    { name: 'largura', label: { pt: 'Largura', en: 'Width' }, kind: 'length', default: 2 },
    { name: 'lado', label: { pt: 'Lado', en: 'Side' }, kind: 'length', default: 1.5 },
    { name: 'fundo', label: { pt: 'Fundo', en: 'Depth' }, kind: 'length', default: 0.6 },
  ],
  parts: [
    {
      kind: 'profile',
      x: 0,
      y: 0,
      z: 0.87,
      h: 0.03,
      points: [
        [0, 0],
        ['largura', 0],
        ['largura', 'fundo'],
        ['fundo', 'fundo'],
        ['fundo', 'lado'],
        [0, 'lado'],
      ],
      material: 'concrete',
    },
  ],
  handles: [],
  types: [{ id: 't', name: { pt: 'Padrão', en: 'Standard' }, values: {} }],
};

const volume = (g: THREE.BufferGeometry) => {
  const geo = g.index ? g.toNonIndexed() : g;
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let v = 0;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
};

describe('profile parts', () => {
  const doc = newDocument();
  const place = (values: Record<string, number>) =>
    evaluateObject(counter, { id: 'o', levelId: 'lvl_ground', definitionId: counter.id, typeId: 't', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values }, { definitions: [counter], materials: doc.materials });

  it('a valid definition; a profile of two corners is not', () => {
    expect(isDefinition(counter)).toBe(true);
    expect(isDefinition({ ...counter, parts: [{ ...counter.parts[0]!, points: [[0, 0], [1, 0]] }] })).toBe(false);
  });

  it('its corners follow the parameters, its area and volume those of the L', () => {
    const ev = place({});
    const ring = pieceOutline(ev.pieces[0]!);
    expect(ring).toHaveLength(6);
    // L area: 2 × 0.6 + 0.6 × 0.9.
    const area = (2 * 0.6 + 0.6 * 0.9) * 0.03;
    const g = pieceGeometry(ev.pieces[0]!);
    // Faces outward: a positive volume, the L's (to 6 places: three.js keeps positions in 32-bit floats).
    expect(volume(g)).toBeCloseTo(area, 6);
    const box = new THREE.Box3().setFromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute);
    // three.js axes: plan y is −z, the height y.
    expect([box.min.y, box.max.y]).toEqual([expect.closeTo(0.87, 6), expect.closeTo(0.9, 6)]);
    expect([box.min.z, box.max.z]).toEqual([expect.closeTo(-1.5, 6), expect.closeTo(0, 6)]);
    // Wider arms: the shape keeps its relations.
    const wide = pieceGeometry(place({ fundo: 0.7 }).pieces[0]!);
    expect(volume(wide)).toBeCloseTo((2 * 0.7 + 0.7 * 0.8) * 0.03, 6);
  });

  it('a revolve: a rectangle turned is a cylinder (32 sides), its height and plan outline its own', () => {
    const vase: ObjectDefinition = { ...counter, id: 'def_v', parts: [{ kind: 'revolve', x: 0, y: 0, z: 0.1, points: [[0.2, 0], [0.2, 1]], material: 'concrete' }] };
    expect(isDefinition(vase)).toBe(true);
    const ev = evaluateObject(vase, { id: 'o', levelId: 'lvl_ground', definitionId: vase.id, typeId: 't', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: [vase], materials: doc.materials });
    const g = pieceGeometry(ev.pieces[0]!);
    expect(Math.abs(volume(g))).toBeCloseTo(16 * 0.04 * Math.sin((2 * Math.PI) / 32) * 1, 6);
    const box = new THREE.Box3().setFromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute);
    expect([box.min.y, box.max.y]).toEqual([expect.closeTo(0.1, 6), expect.closeTo(1.1, 6)]);
    expect(pieceOutline(ev.pieces[0]!).every((q) => Math.abs(Math.hypot(q.x, q.y) - 0.2) < 1e-9)).toBe(true);
  });

  it('a box leaning back 90° lies on its back: its outline, span and geometry where they should be', () => {
    const board: ObjectDefinition = { ...counter, id: 'def_b', parts: [{ kind: 'box', x: 0, y: 0, z: 0.5, w: 1, d: 0.1, h: 1, tilt: 90, material: 'concrete' }] };
    expect(isDefinition(board)).toBe(true);
    const ev = evaluateObject(board, { id: 'o', levelId: 'lvl_ground', definitionId: board.id, typeId: 't', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: [board], materials: doc.materials });
    const piece = ev.pieces[0]!;
    // Turned about its base's front edge (y = 0, z = 0.5): it lies from y 0 to 1, its thickness under z 0.5.
    const ring = pieceOutline(piece);
    const xs = ring.map((q) => q.x);
    const ys = ring.map((q) => q.y);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 1, 0, 1]);
    expect(pieceSpan(piece).bottom).toBeCloseTo(0.4, 9);
    expect(pieceSpan(piece).top).toBeCloseTo(0.5, 9);
    const box = new THREE.Box3().setFromBufferAttribute(pieceGeometry(piece).getAttribute('position') as THREE.BufferAttribute);
    expect([box.min.x, box.max.x, box.min.y, box.max.y, box.min.z, box.max.z]).toEqual([0, 1, 0.4, 0.5, -1, 0].map((v) => expect.closeTo(v, 6)));
    // Leaning sideways 30°: its top 1 m up goes half a metre toward +x.
    const leg: ObjectDefinition = { ...counter, id: 'def_l2', parts: [{ kind: 'box', x: 0, y: 0, z: 0, w: 0.05, d: 0.05, h: 1, roll: 30, material: 'concrete' }] };
    const lev = evaluateObject(leg, { id: 'o', levelId: 'lvl_ground', definitionId: leg.id, typeId: 't', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: [leg], materials: doc.materials });
    const top = new THREE.Box3().setFromBufferAttribute(pieceGeometry(lev.pieces[0]!).getAttribute('position') as THREE.BufferAttribute);
    expect(top.max.x).toBeCloseTo(0.05 * Math.cos(Math.PI / 6) + Math.sin(Math.PI / 6), 6);
    expect(top.max.y).toBeCloseTo(Math.cos(Math.PI / 6), 6);
  });

  it('a cylinder leaning 90° lies along y: a rail, from its base to its length', () => {
    const rail: ObjectDefinition = { ...counter, id: 'def_r', parts: [{ kind: 'cylinder', x: 0, y: 0, z: 1, r: 0.02, h: 0.6, tilt: 90, material: 'metal' }] };
    expect(isDefinition(rail)).toBe(true);
    const ev = evaluateObject(rail, { id: 'o', levelId: 'lvl_ground', definitionId: rail.id, typeId: 't', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: [rail], materials: doc.materials });
    const piece = ev.pieces[0]!;
    const ys = pieceOutline(piece).map((q) => q.y);
    expect([Math.min(...ys), Math.max(...ys)].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 0.6]);
    expect(pieceSpan(piece).bottom).toBeCloseTo(0.98, 6);
    expect(pieceSpan(piece).top).toBeCloseTo(1.02, 6);
    const box = new THREE.Box3().setFromBufferAttribute(pieceGeometry(piece).getAttribute('position') as THREE.BufferAttribute);
    // three.js's −z is plan y.
    expect([box.min.z, box.max.z, box.min.y, box.max.y]).toEqual([-0.6, 0, 0.98, 1.02].map((v) => expect.closeTo(v, 6)));
  });

  it('drawn clockwise, it is turned round: the volume still positive', () => {
    const cw = { ...counter, parts: [{ ...counter.parts[0]!, points: [...(counter.parts[0] as { points: readonly (readonly [string | number, string | number])[] }).points].reverse() } as ObjectDefinition['parts'][number]] };
    const ev = evaluateObject(cw, { id: 'o', levelId: 'lvl_ground', definitionId: cw.id, typeId: 't', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: [cw], materials: doc.materials });
    expect(volume(pieceGeometry(ev.pieces[0]!))).toBeGreaterThan(0);
  });
});
