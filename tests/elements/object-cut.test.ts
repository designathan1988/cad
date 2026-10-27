// Voids in objects (three-bvh-csg): a part marked cut is taken out of the solid parts, not drawn itself,
// not in the plan's outline.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { creaseEdges, cutGeometries } from '../../src/elements/kinds/object';
import type { Piece } from '../../src/elements/object/evaluate';
import { isDefinition } from '../../src/elements/object/valid';
import { BUILT_IN_MATERIALS } from '../../src/elements/material/schema';

/** A closed mesh's volume, by the divergence theorem over its triangles. */
function volume(g: THREE.BufferGeometry): number {
  const geo = g.index ? g.toNonIndexed() : g;
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return Math.abs(v);
}

const mat = BUILT_IN_MATERIALS[0]!;
const box = (cx: number, cy: number, z: number, w: number, d: number, h: number, cut = false): Piece => ({ ...(cut ? { cut: true } : {}), kind: 'box', cx, cy, z, w, d, h, angle: 0, material: mat, round: 0 });

describe('voids in objects', () => {
  it('a 1 m cube less a 0.4 m void in its middle: 1 − 0.064 m³; the void not drawn', () => {
    const out = cutGeometries([box(0, 0, 0, 1, 1, 1), box(0, 0, 0.3, 0.4, 0.4, 0.4, true)]);
    expect(out).toHaveLength(1);
    expect(volume(out[0]!.geometry)).toBeCloseTo(1 - 0.064, 6);
  });

  it('a cut box\'s lines are its creases only: its 12 outer edges and the hole\'s, none across a flat face', () => {
    // A 1 × 1 × 0.1 slab with a 0.4 × 0.4 hole through it: 12 outer edges + 12 of the hole.
    const { geometry } = cutGeometries([box(0, 0, 0, 1, 1, 0.1), box(0, 0, -0.05, 0.4, 0.4, 0.2, true)])[0]!;
    expect(geometry.userData.cut).toBe(true);
    const lines = creaseEdges(geometry, 20);
    const segs = (lines.getAttribute('position') as THREE.BufferAttribute).count / 2;
    // Each straight crease may come in pieces (split where the cut put a vertex), never fewer than 24 lines,
    // and no line runs diagonally across the top or bottom.
    expect(segs).toBeGreaterThanOrEqual(24);
    const p = lines.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i += 2) {
      const dx = Math.abs(p.getX(i) - p.getX(i + 1));
      const dz = Math.abs(p.getZ(i) - p.getZ(i + 1));
      expect(dx > 1e-6 && dz > 1e-6).toBe(false);
    }
  });

  it('a void that reaches no solid part changes nothing', () => {
    const out = cutGeometries([box(0, 0, 0, 1, 1, 1), box(5, 5, 0, 0.4, 0.4, 0.4, true)]);
    expect(volume(out[0]!.geometry)).toBeCloseTo(1, 9);
  });

  it('a part marked cut is a valid definition; cut not a boolean is not', () => {
    const def = { id: 'def_x', name: { pt: 'x', en: 'x' }, category: 'generic', params: [], handles: [], types: [{ id: 't', name: { pt: 'p', en: 'p' }, values: {} }], parts: [{ kind: 'box', x: 0, y: 0, z: 0, w: 1, d: 1, h: 1, cut: true }] };
    expect(isDefinition(def)).toBe(true);
    expect(isDefinition({ ...def, parts: [{ ...def.parts[0], cut: 'yes' }] })).toBe(false);
  });
});
