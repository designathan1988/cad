// The model as GLB (export-gltf.ts), on the schedules' box: 4 × 3 m between the axes of 15 cm walls, a
// divider at x = 2 with a door, a window in the right wall, a floor in the left room. Read back as a
// viewer reads it: the GLB header, its JSON chunk, the nodes and their extras, the extent.

import { beforeAll, describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { newOpening } from '../../src/elements/opening/schema';
import { type ExportNaming, modelScene, toGlb } from '../../src/render/export-gltf';

// Node has Blob but not FileReader, which the exporter uses to read its own Blob back.
beforeAll(() => {
  class NodeFileReader {
    result: ArrayBuffer | null = null;
    onloadend: (() => void) | null = null;
    readAsArrayBuffer(blob: Blob): void {
      void blob.arrayBuffer().then((b) => {
        this.result = b;
        this.onloadend?.();
      });
    }
  }
  (globalThis as { FileReader?: unknown }).FileReader ??= NodeFileReader;
});

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

const doc: Doc = {
  ...newDocument(),
  name: 'Caixa',
  walls: [wall('w1', [0, 0], [4, 0]), wall('w2', [4, 0], [4, 3]), wall('w3', [4, 3], [0, 3]), wall('w4', [0, 3], [0, 0]), wall('w5', [2, 0], [2, 3])],
  openings: [
    newOpening('opening_d', 'w5', 'door', { kind: 'centered' }, { width: 0.8, height: 2.1 }),
    newOpening('opening_w', 'w2', 'window', { kind: 'centered' }, { width: 1.2, height: 1.0, sill: 1.1 }),
  ],
  rooms: [{ id: 'room_a', levelId: 'lvl_ground', seed: { x: 1, y: 1.5 }, name: 'Sala', number: '1' }],
  floors: [{ id: 'floor_a', levelId: 'lvl_ground', source: { kind: 'room', roomId: 'room_a' }, thickness: 0.15, offset: 0 }],
};
const naming: ExportNaming = {
  name: (s) => s,
  wallTag: (n) => `Parede ${n}`,
  door: (n) => `Porta ${n}`,
  window: (n) => `Janela ${n}`,
  floor: (n) => `Piso ${n}`,
  column: (n) => `Pilar ${n}`,
  beam: (n) => `Viga ${n}`,
  roof: (n) => `Telhado ${n}`,
  stair: (n) => `Escada ${n}`,
  material: (id) => ({ plaster: 'Reboco', brick: 'Tijolo' })[id] ?? id,
  glass: 'Vidro',
  leaf: 'Folha de porta',
  floorMaterial: 'Piso',
  columnMaterial: 'Pilar',
  roofMaterial: 'Telhado',
};

interface Gltf {
  asset: { version: string };
  scenes: { nodes: number[] }[];
  nodes: { name?: string; children?: number[]; mesh?: number; extras?: Record<string, unknown> }[];
  meshes: { primitives: { attributes: { POSITION: number }; material: number }[] }[];
  materials: { name: string }[];
  accessors: { min?: number[]; max?: number[] }[];
}

function readGlb(bytes: ArrayBuffer): Gltf {
  const view = new DataView(bytes);
  expect(view.getUint32(0, true)).toBe(0x46546c67); // "glTF"
  expect(view.getUint32(4, true)).toBe(2);
  expect(view.getUint32(8, true)).toBe(bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a); // "JSON"
  return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength))) as Gltf;
}

describe('the model as GLB', () => {
  const g = deriveGeometry(doc);
  const scene = modelScene(doc, g, naming);

  it('one group per level; under it a node per wall, door, window and floor, named as shown', () => {
    expect(scene.children.map((c) => c.name)).toEqual(['Ground floor']);
    const names = scene.children[0]!.children.map((c) => c.name);
    expect(names).toEqual(['Parede 1', 'Parede 2', 'Parede 3', 'Parede 4', 'Parede 5', 'Porta 1', 'Janela 1', 'Piso 1']);
  });

  it('a valid GLB: the nodes, their extras, a material per material of the layers', async () => {
    const gltf = readGlb(await toGlb(scene));
    expect(gltf.asset.version).toBe('2.0');
    const byName = new Map(gltf.nodes.filter((n) => n.name).map((n) => [n.name!, n]));
    expect(byName.get('Parede 2')?.extras).toEqual({ cad2Id: 'w2', kind: 'wall', type: 'Masonry 15 cm', level: 'Ground floor' });
    expect(byName.get('Janela 1')?.extras).toEqual({ cad2Id: 'opening_w', kind: 'window', width: 1.2, height: 1, sill: 1.1, wall: 'Parede 2', level: 'Ground floor' });
    expect(byName.get('Ground floor')?.extras).toEqual({ cad2Id: 'lvl_ground', kind: 'level', elevation: 0 });
    // Masonry 15 cm: plaster, brick, plaster; both plasters one material.
    expect(new Set(gltf.materials.map((m) => m.name))).toEqual(new Set(['Reboco', 'Tijolo', 'Folha de porta', 'Vidro', 'Piso']));
  });

  it("in metres, y up: from the faces at x = −0.075 to 4.075, from the floor's underside (−0.15) to the walls' tops (2.8)", async () => {
    const gltf = readGlb(await toGlb(scene));
    const positions = gltf.meshes.flatMap((m) => m.primitives.map((p) => gltf.accessors[p.attributes.POSITION]!));
    const min = [0, 1, 2].map((i) => Math.min(...positions.map((a) => a.min![i]!)));
    const max = [0, 1, 2].map((i) => Math.max(...positions.map((a) => a.max![i]!)));
    // three.js and glTF: x as the plan's x, y the height, z the plan's −y.
    expect(min[0]).toBeCloseTo(-0.075, 6);
    expect(max[0]).toBeCloseTo(4.075, 6);
    // The floor's top on the level, its 15 cm below.
    expect(min[1]).toBeCloseTo(-0.15, 6);
    expect(max[1]).toBeCloseTo(2.8, 6);
    expect(min[2]).toBeCloseTo(-3.075, 6);
    expect(max[2]).toBeCloseTo(0.075, 6);
  });
});
