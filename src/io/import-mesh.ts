// A 3D model as a parametric object (phase 11: "importação de glTF/OBJ como objeto da biblioteca, com
// parâmetros de escala e material"): its meshes, one a material, put in a unit box (mesh parts,
// elements/object/schema.ts) that its width, depth and height stretch, each dragged by a handle as the
// library's objects are; a material parameter for each of its colours, its own colour by default. The
// file's unit is guessed from its size: a model over 20 m across is in centimetres (over 2 km, in
// millimetres). Pure: the loaders (three.js's glTF and OBJ) are the app's.

import type { Material } from '../elements/material/schema';
import type { DefinitionCategory, MeshData, ObjectDefinition, ParamDef, Part } from '../elements/object/schema';
import type { MaterialId } from '../elements/material/schema';
import type { DefinitionId } from '../elements/object/schema';

/** A mesh as the loader gives it, already in plan axes (x, y, z up), in the file's units. */
export interface MeshGroup {
  readonly positions: ArrayLike<number>;
  /** Its triangles' corners; none: every three positions are one. */
  readonly indices?: ArrayLike<number>;
  /** Its colour, #rrggbb. */
  readonly color: string;
}

/** Triangles more than this make the file too heavy for a library object. */
export const MAX_TRIANGLES = 60000;

/** The convex hull of points (Andrew's monotone chain), counter-clockwise. */
export function hull(points: readonly (readonly [number, number])[]): [number, number][] {
  const p = [...new Map(points.map((q) => [`${q[0].toFixed(5)},${q[1].toFixed(5)}`, q] as const)).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p.map((q) => [q[0], q[1]]);
  const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const lower: (readonly [number, number])[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: (readonly [number, number])[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].map((q) => [q[0], q[1]]);
}

export interface MeshDefinition {
  readonly definition: ObjectDefinition;
  /** The materials of its colours, new to the project. */
  readonly materials: readonly Material[];
  /** Metres a unit of the file, as guessed. */
  readonly unit: number;
  readonly triangles: number;
}

/** A definition of the model; `id` makes the ids (the app's newId). Null when it has no triangles or too many. */
export function meshDefinition(name: string, groups: readonly MeshGroup[], category: DefinitionCategory, id: (prefix: string) => string): MeshDefinition | null {
  const tris = groups.reduce((n, g) => n + (g.indices ? g.indices.length : g.positions.length / 3) / 3, 0);
  if (tris === 0 || tris > MAX_TRIANGLES) return null;
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const g of groups)
    for (let i = 0; i + 2 < g.positions.length; i += 3)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k]!, g.positions[i + k]!);
        max[k] = Math.max(max[k]!, g.positions[i + k]!);
      }
  const size = [0, 1, 2].map((k) => Math.max(1e-9, max[k]! - min[k]!));
  const across = Math.max(...size);
  const unit = across > 2000 ? 0.001 : across > 20 ? 0.01 : 1;
  // A flat model (a rug) still has a height to stretch.
  const dims = size.map((v) => Math.max(0.01, v * unit));
  const colours = [...new Set(groups.map((g) => g.color.toLowerCase()))];
  const materials: Material[] = colours.map((c, i) => ({ id: id('mat') as MaterialId, name: `${name} ${i + 1}`, color: c, roughness: 0.7, metalness: 0, cut: 'solid' }));
  const meshes: MeshData[] = [];
  const parts: Part[] = [];
  colours.forEach((c, ci) => {
    const positions: number[] = [];
    const indices: number[] = [];
    const flat: [number, number][] = [];
    for (const g of groups.filter((x) => x.color.toLowerCase() === c)) {
      const base = positions.length / 3;
      for (let i = 0; i + 2 < g.positions.length; i += 3) {
        const u = (g.positions[i]! - min[0]!) / size[0]!;
        const v = (g.positions[i + 1]! - min[1]!) / size[1]!;
        const w = (g.positions[i + 2]! - min[2]!) / size[2]!;
        positions.push(u, v, w);
        flat.push([u, v]);
      }
      const n = g.positions.length / 3;
      if (g.indices) for (let i = 0; i < g.indices.length; i++) indices.push(base + g.indices[i]!);
      else for (let i = 0; i < n; i++) indices.push(base + i);
    }
    const mid = id('mesh');
    meshes.push({ id: mid, positions: positions.map((v) => Math.round(v * 1e5) / 1e5), indices, outline: hull(flat).flat().map((v) => Math.round(v * 1e5) / 1e5) });
    parts.push({ kind: 'mesh', mesh: mid, name: { pt: `Parte ${ci + 1}`, en: `Part ${ci + 1}` }, x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 'altura', material: `material${ci + 1}` });
  });
  const len = (n: string, pt: string, en: string, v: number): ParamDef => ({
    name: n,
    label: { pt, en },
    kind: 'length',
    default: Math.round(v * 1000) / 1000,
    min: Math.round(v * 0.1 * 1000) / 1000 || 0.001,
    max: Math.round(v * 10 * 1000) / 1000,
    step: 0.005,
    group: { pt: 'Dimensões', en: 'Dimensions' },
  });
  const params: ParamDef[] = [
    len('largura', 'Largura', 'Width', dims[0]!),
    len('profundidade', 'Profundidade', 'Depth', dims[1]!),
    len('altura', 'Altura', 'Height', dims[2]!),
    ...materials.map((m, i): ParamDef => ({ name: `material${i + 1}`, label: { pt: `Material ${i + 1}`, en: `Material ${i + 1}` }, kind: 'material', default: m.id, group: { pt: 'Materiais', en: 'Materials' } })),
  ];
  const definition: ObjectDefinition = {
    id: id('def') as DefinitionId,
    name: { pt: name, en: name },
    category,
    params,
    parts,
    handles: [
      { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 },
      { param: 'largura', axis: 'x', at: ['-largura/2', 0, 'altura'], shift: 0.5, sign: -1 },
      { param: 'profundidade', axis: 'y', at: [0, 'profundidade/2', 'altura'], shift: 0.5 },
      { param: 'profundidade', axis: 'y', at: [0, '-profundidade/2', 'altura'], shift: 0.5, sign: -1 },
      { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
    ],
    types: [{ id: 'imported', name: { pt: 'Como importado', en: 'As imported' }, values: {} }],
    meshes,
  };
  return { definition, materials, unit, triangles: tris };
}
