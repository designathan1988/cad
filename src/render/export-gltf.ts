// The model as glTF 2.0 binary (GLB, ref/chat.txt:122, l.149): read from the derived geometry, never
// from the view, so what the 3D shows for now (cut, box, x-ray, explode, a hidden wall) is not in it. One
// group per level at its own height; one node per wall, door, window and floor, named as the interface
// names it, with its id, kind, type and level in the node's extras; a material per material of the
// layers (plaster, brick), in its own colour and finish (elements/material).
// Metres, y up, as glTF wants (three.js's axes, prisms.ts).

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import type { Doc } from '../app/document';
import { levelOf, wallNumber } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { add, scale } from '../core/vector';
import { visibleFaces } from '../elements/wall/geometry/faces';
import type { LayerFunction } from '../elements/wall/schema';
import type { Material } from '../elements/material/schema';
import { prism, shownPrism } from './prisms';
import { eachSolid } from '../elements/registry';
import type { KindKey } from '../elements/contract';

/** How the nodes and materials are named: as the interface says it. */
export interface ExportNaming {
  readonly name: (stored: string) => string;
  readonly wallTag: (n: number) => string;
  readonly door: (n: number) => string;
  readonly window: (n: number) => string;
  /** A registry kind's node (elements/registry.ts), numbered within its kind, and its material. */
  readonly kindName: (key: KindKey, n: number) => string;
  readonly kindMaterial: (key: KindKey) => string;
  /** A layer's material by its id (plaster, brick): what a renderer assigns its own materials by. */
  readonly material: (materialId: string) => string;
  readonly glass: string;
  readonly leaf: string;
}

/** Plain colours for the materials, as a viewer shows them lit: not the interface's, which follow its theme. */
const COLOUR: Readonly<Record<LayerFunction | 'floor' | 'leaf' | 'glass' | 'roof', number>> = {
  structure: 0xc9b8a3,
  substrate: 0xd8cfc2,
  thermal: 0xe5d68c,
  finish1: 0xece8e0,
  finish2: 0xece8e0,
  floor: 0xd6d0c6,
  roof: 0xa8634a,
  leaf: 0x8a5a3c,
  glass: 0x9cc3dd,
};

export function modelScene(doc: Doc, g: DerivedGeometry, naming: ExportNaming): THREE.Scene {
  const scene = new THREE.Scene();
  scene.name = doc.name;
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (key: keyof typeof COLOUR, label: string) => {
    let m = materials.get(label);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: COLOUR[key], roughness: 0.9, metalness: 0 });
      if (key === 'glass') Object.assign(m, { transparent: true, opacity: 0.4, roughness: 0.1 });
      m.name = label;
      materials.set(label, m);
    }
    return m;
  };
  // A wall layer in its project material's own colour and finish, one per material, named by it.
  const layerMaterial = (x: Material) => {
    const label = naming.material(x.id);
    let m = materials.get(label);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: x.color, roughness: x.roughness, metalness: x.metalness });
      m.name = label;
      materials.set(label, m);
    }
    return m;
  };
  // One group per level, at its own height already in the blocks' heights: no lift, no explode.
  const levels = new Map<string, THREE.Group>();
  const levelGroup = (id: string) => {
    let group = levels.get(id);
    if (!group) {
      group = new THREE.Group();
      const l = levelOf(doc, id);
      group.name = l ? naming.name(l.name) : id;
      group.userData = { cad2Id: id, kind: 'level', elevation: l?.elevation ?? 0 };
      scene.add(group);
      levels.set(id, group);
    }
    return group;
  };
  const levelName = (id: string) => {
    const l = levelOf(doc, id);
    return l ? naming.name(l.name) : '';
  };

  // Walls: every block, only its faces that show (faces between touching blocks would fight in a viewer).
  const solids = [...g.solids.values()];
  const faces = visibleFaces(solids.flatMap((s) => s.blocks));
  let k = 0;
  for (const s of solids) {
    const type = doc.wallTypes.find((t) => t.id === s.wall.wallTypeId);
    const node = new THREE.Group();
    node.name = naming.wallTag(wallNumber(doc, s.wall.id) ?? 0);
    node.userData = { cad2Id: s.wall.id, kind: 'wall', type: type ? naming.name(type.name) : '', level: levelName(s.wall.levelId) };
    for (const b of s.blocks) {
      const f = faces[k++];
      const layer = s.materials[b.layerIndex];
      const m = layer ? layerMaterial(layer) : material('structure', naming.material('structure'));
      node.add(new THREE.Mesh(f ? shownPrism(b.polygon, b.bottom, b.top, f) : prism(b.polygon, b.bottom, b.top), [m, m]));
    }
    levelGroup(s.wall.levelId).add(node);
  }

  // Doors and windows: the leaf closed, the glass in the middle of the wall, as the 3D shows them.
  const count = { door: 0, window: 0 };
  for (const o of g.openings.values()) {
    const f = o.frame;
    const host = g.solids.get(o.opening.wallId);
    if (!f || !host) continue;
    const door = o.opening.kind === 'door';
    const mid = (f.faces[0] + f.faces[1]) / 2;
    const half = door ? 0.02 : 0.01;
    const at = (p: { x: number; y: number }, off: number) => add(p, scale(f.normal, off));
    const poly = [at(f.start, mid - half), at(f.end, mid - half), at(f.end, mid + half), at(f.start, mid + half)];
    const m = door ? material('leaf', naming.leaf) : material('glass', naming.glass);
    const mesh = new THREE.Mesh(prism(poly, o.bottom, o.top), [m, m]);
    const n = ++count[o.opening.kind];
    mesh.name = door ? naming.door(n) : naming.window(n);
    mesh.userData = {
      cad2Id: o.opening.id,
      kind: o.opening.kind,
      width: o.opening.width,
      height: o.opening.height,
      sill: o.opening.sill,
      wall: naming.wallTag(wallNumber(doc, o.opening.wallId) ?? 0),
      level: levelName(host.wall.levelId),
    };
    levelGroup(host.wall.levelId).add(mesh);
  }

  // The registry's kinds (elements/registry.ts): each its solid, named and numbered as the interface
  // calls it, its own data on the node for a renderer or a viewer to read.
  const counts = new Map<string, number>();
  for (const x of eachSolid(g.kinds)) {
    const made = x.levelId === null ? null : x.kind.solid?.(x.solid);
    if (!made || x.levelId === null) continue;
    made.geometry.translate(0, made.y, 0);
    const n = (counts.get(x.kind.key) ?? 0) + 1;
    counts.set(x.kind.key, n);
    const mesh = new THREE.Mesh(made.geometry, material(x.kind.exportColour, naming.kindMaterial(x.kind.key)));
    mesh.name = naming.kindName(x.kind.key, n);
    mesh.userData = { cad2Id: x.id, kind: x.kind.prefix, level: levelName(x.levelId), params: x.kind.element(x.solid) };
    levelGroup(x.levelId).add(mesh);
  }
  return scene;
}

/** The scene as GLB bytes. */
export async function toGlb(scene: THREE.Scene): Promise<ArrayBuffer> {
  const out = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false });
  if (!(out instanceof ArrayBuffer)) throw new Error('GLTFExporter gave JSON where GLB was asked for');
  return out;
}
