// The model as OBJ with its materials (an .mtl beside it): the OBJ alone named its materials and no file
// that says what they are, so another program showed it all grey. Each material gets a name an OBJ reader
// takes (letters, digits, _ and -, no spaces: some stop at a space) and its colour, opacity and shine.

import * as THREE from 'three';

/** A name for `usemtl`/`newmtl`: accents dropped, anything else not a letter, digit, _ or - made _. */
export function mtlName(name: string): string {
  const plain = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return plain || 'material';
}

/**
 * The OBJ and its MTL for `scene`, the OBJ naming `base`.mtl: its materials renamed for the files while it
 * is written (each its own name, the same name twice told apart by a number) and named back after.
 */
export function objWithMtl(scene: THREE.Object3D, base: string, toObj: (scene: THREE.Object3D) => string): { obj: string; mtl: string } {
  const materials: THREE.Material[] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) if (!materials.includes(x)) materials.push(x);
  });
  const taken = new Set<string>();
  const was = materials.map((m) => m.name);
  const lines: string[] = [];
  materials.forEach((m, i) => {
    let name = mtlName(m.name || `material_${i + 1}`);
    for (let n = 2; taken.has(name); n++) name = `${mtlName(m.name || 'material')}_${n}`;
    taken.add(name);
    m.name = name;
    const std = m as THREE.MeshStandardMaterial;
    const c = std.color ? std.color.clone().convertLinearToSRGB() : new THREE.Color(0.8, 0.8, 0.8);
    const f = (v: number) => v.toFixed(4);
    lines.push(`newmtl ${name}`, `Kd ${f(c.r)} ${f(c.g)} ${f(c.b)}`, `Ka 0 0 0`, `Ks 0.04 0.04 0.04`, `Ns ${f((1 - (std.roughness ?? 1)) * 500)}`, `d ${f(m.transparent ? m.opacity : 1)}`, 'illum 2', '');
  });
  const obj = `mtllib ${base}.mtl\n${toObj(scene)}`;
  materials.forEach((m, i) => (m.name = was[i]!));
  return { obj, mtl: lines.join('\n') };
}
