// A profile part: its corners as formulas of the parameters, extruded; its plan outline the polygon.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/app/document';
import { pieceGeometry } from '../../src/elements/kinds/object';
import { evaluateObject, pieceOutline } from '../../src/elements/object/evaluate';
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

  it('drawn clockwise, it is turned round: the volume still positive', () => {
    const cw = { ...counter, parts: [{ ...counter.parts[0]!, points: [...(counter.parts[0] as { points: readonly (readonly [string | number, string | number])[] }).points].reverse() } as ObjectDefinition['parts'][number]] };
    const ev = evaluateObject(cw, { id: 'o', levelId: 'lvl_ground', definitionId: cw.id, typeId: 't', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: [cw], materials: doc.materials });
    expect(volume(pieceGeometry(ev.pieces[0]!))).toBeGreaterThan(0);
  });
});
