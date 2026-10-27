// Materials as data (docs/plano-de-escopo.md, phase 2): what a wall layer is made of, kept in the
// project. Its colour and finish (roughness, metalness: physically based, as three.js and glTF read
// them) paint the layer in 3D and in the GLB; its colour and cut pattern fill it in plan where the
// walls are cut. Changing a material changes every layer made of it, in plan and in 3D. A pattern
// (pattern.ts: tiles, boards, bricks) is painted on its faces in 3D.

import { PATTERN_DEFAULTS, type SurfacePattern } from './pattern';
import type { MaterialPhysics } from '../../sim/physics';

export type MaterialId = string;

/** How a cut through it is hatched in plan. */
export type CutPattern = 'solid' | 'brick' | 'concrete' | 'insulation' | 'wood' | 'none';

export const CUT_PATTERNS: readonly CutPattern[] = ['solid', 'brick', 'concrete', 'insulation', 'wood', 'none'];

export interface Material {
  readonly id: MaterialId;
  /** Its name; empty for a built-in one, named in the interface's language (i18n.ts: mat.*). */
  readonly name: string;
  /** Its colour, #rrggbb. */
  readonly color: string;
  /** 0 (a mirror) to 1 (matte). */
  readonly roughness: number;
  /** 0 (not metal) to 1 (metal). */
  readonly metalness: number;
  readonly cut: CutPattern;
  /** What its faces show in 3D: tiles, boards or bricks (none: its colour alone). */
  readonly pattern?: SurfacePattern;
  /** Its own physics for the simulations (sim/physics.ts); absent, the table's for its id, if any. */
  readonly physics?: MaterialPhysics;
}

/** The materials a new project has, and those an older file gets for the names it used. */
export const BUILT_IN_MATERIALS: readonly Material[] = [
  { id: 'plaster', name: '', color: '#e7e1d6', roughness: 0.9, metalness: 0, cut: 'solid' },
  { id: 'brick', name: '', color: '#b9653f', roughness: 0.85, metalness: 0, cut: 'brick', pattern: PATTERN_DEFAULTS.brick },
  { id: 'concrete', name: '', color: '#a3a29d', roughness: 0.8, metalness: 0, cut: 'concrete' },
  { id: 'gypsum', name: '', color: '#f2f0ea', roughness: 0.9, metalness: 0, cut: 'solid' },
  { id: 'insulation', name: '', color: '#f1d36e', roughness: 0.95, metalness: 0, cut: 'insulation' },
  // What the objects of the library are made of (elements/object/library.ts).
  { id: 'wood', name: '', color: '#a87a52', roughness: 0.7, metalness: 0, cut: 'wood', pattern: PATTERN_DEFAULTS.wood },
  { id: 'mdfWhite', name: '', color: '#eeece6', roughness: 0.6, metalness: 0, cut: 'solid' },
  { id: 'metal', name: '', color: '#8e949b', roughness: 0.35, metalness: 0.8, cut: 'solid' },
  { id: 'glass', name: '', color: '#bfd9e8', roughness: 0.05, metalness: 0, cut: 'none' },
  // What floors are built of (room/schema.ts FLOOR_BUILDUPS).
  { id: 'tile', name: '', color: '#d9d4cb', roughness: 0.3, metalness: 0, cut: 'solid', pattern: PATTERN_DEFAULTS.tiles },
  { id: 'screed', name: '', color: '#b8b3aa', roughness: 0.9, metalness: 0, cut: 'concrete' },
  { id: 'gravel', name: '', color: '#8f8a80', roughness: 1, metalness: 0, cut: 'concrete' },
  // What the library's other objects are made of (object/library-more.ts).
  { id: 'fabric', name: '', color: '#8b8f98', roughness: 0.95, metalness: 0, cut: 'solid' },
  { id: 'ceramic', name: '', color: '#f3f2ee', roughness: 0.15, metalness: 0, cut: 'solid' },
  { id: 'foliage', name: '', color: '#5e8a4c', roughness: 0.9, metalness: 0, cut: 'none' },
  { id: 'bark', name: '', color: '#96765a', roughness: 0.95, metalness: 0, cut: 'wood' },
];

/** A material for a name an older file used and the built-in ones do not have: grey, plain. */
export const materialFor = (id: MaterialId): Material => BUILT_IN_MATERIALS.find((m) => m.id === id) ?? { id, name: id, color: '#9c9a94', roughness: 0.9, metalness: 0, cut: 'solid' };

export const isColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/** A project's material by id; a name it does not have gets the plain grey one (materialFor). */
export const materialIn = (list: readonly Material[], id: MaterialId): Material => list.find((m) => m.id === id) ?? materialFor(id);

/** A colour darkened (k < 1) toward black, for the plan's dark theme: the light wall line must read on it. */
export function shade(color: string, k: number): string {
  if (k >= 1 || !isColor(color)) return color;
  const n = parseInt(color.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * k);
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
}
