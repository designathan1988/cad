// The OBJ with its MTL: every material it uses defined, names an OBJ reader takes, the scene's names
// given back after.

import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { describe, expect, it } from 'vitest';
import { mtlName, objWithMtl } from '../../src/io/export-obj';

describe('OBJ with its MTL', () => {
  it('names without spaces nor accents', () => {
    expect([mtlName('Madeira de móvel'), mtlName('Vidro'), mtlName('  '), mtlName('Aço/inox')]).toEqual(['Madeira_de_movel', 'Vidro', 'material', 'Aco_inox']);
  });

  it('each material used is in the MTL, once, with its colour; two of one name told apart; the names back after', () => {
    const wood = new THREE.MeshStandardMaterial({ name: 'Madeira de móvel', color: 0x9c6f4a, roughness: 0.55 });
    const glass = new THREE.MeshStandardMaterial({ name: 'Vidro', color: 0xbfd9e8, transparent: true, opacity: 0.45 });
    const other = new THREE.MeshStandardMaterial({ name: 'Vidro', color: 0x000000 });
    const scene = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    scene.add(new THREE.Mesh(box, wood), new THREE.Mesh(box, wood), new THREE.Mesh(box, glass), new THREE.Mesh(box, other));
    const { obj, mtl } = objWithMtl(scene, 'Casa', (s) => new OBJExporter().parse(s));
    expect(obj.startsWith('mtllib Casa.mtl\n')).toBe(true);
    const used = new Set([...obj.matchAll(/^usemtl (.+)$/gm)].map((m) => m[1]));
    const defined = [...mtl.matchAll(/^newmtl (.+)$/gm)].map((m) => m[1]);
    expect(new Set(defined)).toEqual(used);
    expect(defined).toEqual(['Madeira_de_movel', 'Vidro', 'Vidro_2']);
    // The wood's colour as the screen shows it (sRGB), the glass's opacity.
    expect(mtl).toContain(`Kd ${(0x9c / 255).toFixed(4)} ${(0x6f / 255).toFixed(4)} ${(0x4a / 255).toFixed(4)}`);
    expect(mtl).toMatch(/newmtl Vidro\n[^]*?d 0\.4500/);
    expect([wood.name, glass.name, other.name]).toEqual(['Madeira de móvel', 'Vidro', 'Vidro']);
  });
});
