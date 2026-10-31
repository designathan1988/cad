// Materials as data (docs/plano-de-escopo.md, phase 2): what a wall layer is made of, kept in the
// project. Its colour and finish (roughness, metalness: physically based, as three.js and glTF read
// them) paint the layer in 3D and in the GLB; its colour and cut pattern fill it in plan where the
// walls are cut. Changing a material changes every layer made of it, in plan and in 3D. A pattern
// (pattern.ts: tiles, boards, bricks) is painted on its faces in 3D.

import { PATTERN_DEFAULTS, type SurfacePattern } from './pattern';
import type { MaterialPhysics } from './physics';
import { type Brand, newId } from '../../core/id';

/** A material's id: a built-in one's name (concrete, brick…) or the user's mat_…. */
export type MaterialId = Brand<'material'>;

/** A new material's id (mat_…). */
export const newMaterialId = (): MaterialId => newId('mat') as MaterialId;

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
  /** Its own physics (material/physics.ts); absent, the table's for its id, if any. */
  readonly physics?: MaterialPhysics;
}

/** The materials a new project has, and those an older file gets for the names it used. */
export const BUILT_IN_MATERIALS: readonly Material[] = [
  { id: 'plaster' as MaterialId, name: '', color: '#e7e1d6', roughness: 0.9, metalness: 0, cut: 'solid' },
  { id: 'brick' as MaterialId, name: '', color: '#b9653f', roughness: 0.85, metalness: 0, cut: 'brick', pattern: PATTERN_DEFAULTS.brick },
  { id: 'concrete' as MaterialId, name: '', color: '#a3a29d', roughness: 0.8, metalness: 0, cut: 'concrete' },
  { id: 'gypsum' as MaterialId, name: '', color: '#f2f0ea', roughness: 0.9, metalness: 0, cut: 'solid' },
  { id: 'insulation' as MaterialId, name: '', color: '#f1d36e', roughness: 0.95, metalness: 0, cut: 'insulation' },
  // What the objects of the library are made of (elements/object/library.ts).
  { id: 'wood' as MaterialId, name: '', color: '#a87a52', roughness: 0.7, metalness: 0, cut: 'wood', pattern: PATTERN_DEFAULTS.wood },
  // Furniture's: a panel's grain, no boards (the wood above is a floor's, boards of 90 × 12 cm).
  { id: 'woodVeneer' as MaterialId, name: '', color: '#9c6f4a', roughness: 0.55, metalness: 0, cut: 'wood', pattern: { kind: 'wood', layout: 'stack', length: 2.4, width: 0.4, joint: 0, jointColor: '#9c6f4a', variation: 0.05, angle: 0 } },
  { id: 'mdfWhite' as MaterialId, name: '', color: '#eeece6', roughness: 0.6, metalness: 0, cut: 'solid' },
  { id: 'metal' as MaterialId, name: '', color: '#8e949b', roughness: 0.35, metalness: 0.8, cut: 'solid' },
  { id: 'glass' as MaterialId, name: '', color: '#bfd9e8', roughness: 0.05, metalness: 0, cut: 'none' },
  // What floors are built of (room/schema.ts FLOOR_BUILDUPS).
  { id: 'tile' as MaterialId, name: '', color: '#d9d4cb', roughness: 0.3, metalness: 0, cut: 'solid', pattern: PATTERN_DEFAULTS.tiles },
  { id: 'screed' as MaterialId, name: '', color: '#b8b3aa', roughness: 0.9, metalness: 0, cut: 'concrete' },
  { id: 'gravel' as MaterialId, name: '', color: '#8f8a80', roughness: 1, metalness: 0, cut: 'concrete' },
  // What the library's other objects are made of (object/library-more.ts).
  { id: 'fabric' as MaterialId, name: '', color: '#8b8f98', roughness: 0.95, metalness: 0, cut: 'solid' },
  { id: 'ceramic' as MaterialId, name: '', color: '#f3f2ee', roughness: 0.15, metalness: 0, cut: 'solid' },
  { id: 'foliage' as MaterialId, name: '', color: '#5e8a4c', roughness: 0.9, metalness: 0, cut: 'none' },
  { id: 'bark' as MaterialId, name: '', color: '#96765a', roughness: 0.95, metalness: 0, cut: 'wood' },
  // What the roofs are covered with (roof/schema.ts ROOF_COVERING).
  { id: 'clayTile' as MaterialId, name: '', color: '#b4644a', roughness: 0.8, metalness: 0, cut: 'solid' },
  // The furniture, fittings and equipment of the library's families (object/library-*.ts): woods,
  // lacquers, metals, upholstery, stones, glass, plastics.
  { id: 'oak' as MaterialId, name: '', color: '#b88f5c', roughness: 0.55, metalness: 0, cut: 'wood', pattern: { kind: 'wood', layout: 'stack', length: 2.4, width: 0.4, joint: 0, jointColor: '#b88f5c', variation: 0.06, angle: 0 } },
  { id: 'walnut' as MaterialId, name: '', color: '#5f4231', roughness: 0.5, metalness: 0, cut: 'wood', pattern: { kind: 'wood', layout: 'stack', length: 2.4, width: 0.4, joint: 0, jointColor: '#5f4231', variation: 0.06, angle: 0 } },
  { id: 'pine' as MaterialId, name: '', color: '#d8b886', roughness: 0.6, metalness: 0, cut: 'wood', pattern: { kind: 'wood', layout: 'stack', length: 2.4, width: 0.4, joint: 0, jointColor: '#d8b886', variation: 0.06, angle: 0 } },
  { id: 'freijo' as MaterialId, name: '', color: '#a07a4e', roughness: 0.5, metalness: 0, cut: 'wood', pattern: { kind: 'wood', layout: 'stack', length: 2.4, width: 0.4, joint: 0, jointColor: '#a07a4e', variation: 0.06, angle: 0 } },
  { id: 'lacquerWhite' as MaterialId, name: '', color: '#f4f3ef', roughness: 0.25, metalness: 0, cut: 'solid' },
  { id: 'lacquerBlack' as MaterialId, name: '', color: '#1b1c1e', roughness: 0.25, metalness: 0, cut: 'solid' },
  { id: 'lacquerSage' as MaterialId, name: '', color: '#8d9c88', roughness: 0.35, metalness: 0, cut: 'solid' },
  { id: 'lacquerTerracotta' as MaterialId, name: '', color: '#b8664a', roughness: 0.35, metalness: 0, cut: 'solid' },
  { id: 'blackSteel' as MaterialId, name: '', color: '#2a2c2f', roughness: 0.45, metalness: 0.85, cut: 'solid' },
  { id: 'stainless' as MaterialId, name: '', color: '#c4c8cc', roughness: 0.32, metalness: 1, cut: 'solid' },
  { id: 'chrome' as MaterialId, name: '', color: '#e2e5e9', roughness: 0.08, metalness: 1, cut: 'solid' },
  { id: 'brass' as MaterialId, name: '', color: '#c49c4e', roughness: 0.3, metalness: 1, cut: 'solid' },
  { id: 'copper' as MaterialId, name: '', color: '#b8734b', roughness: 0.32, metalness: 1, cut: 'solid' },
  { id: 'aluminium' as MaterialId, name: '', color: '#b5b9bd', roughness: 0.4, metalness: 0.9, cut: 'solid' },
  { id: 'leather' as MaterialId, name: '', color: '#6c4129', roughness: 0.6, metalness: 0, cut: 'solid' },
  { id: 'leatherBlack' as MaterialId, name: '', color: '#262422', roughness: 0.55, metalness: 0, cut: 'solid' },
  { id: 'linen' as MaterialId, name: '', color: '#d2c9b6', roughness: 0.95, metalness: 0, cut: 'solid' },
  { id: 'velvet' as MaterialId, name: '', color: '#3e5b6c', roughness: 0.9, metalness: 0, cut: 'solid' },
  { id: 'boucle' as MaterialId, name: '', color: '#e8e2d6', roughness: 1, metalness: 0, cut: 'solid' },
  { id: 'rattan' as MaterialId, name: '', color: '#c8a46a', roughness: 0.8, metalness: 0, cut: 'solid' },
  { id: 'marble' as MaterialId, name: '', color: '#ece9e4', roughness: 0.12, metalness: 0, cut: 'solid', pattern: { kind: 'marble', layout: 'stack', length: 1.2, width: 0.6, joint: 0.001, jointColor: '#d6d2ca', variation: 0.03, angle: 0 } },
  { id: 'graniteBlack' as MaterialId, name: '', color: '#2b2b2d', roughness: 0.2, metalness: 0, cut: 'solid', pattern: { kind: 'granite', layout: 'stack', length: 1.2, width: 0.6, joint: 0.001, jointColor: '#1e1e20', variation: 0.03, angle: 0 } },
  { id: 'quartz' as MaterialId, name: '', color: '#dad8d2', roughness: 0.15, metalness: 0, cut: 'solid', pattern: { kind: 'granite', layout: 'stack', length: 3, width: 1.4, joint: 0, jointColor: '#dad8d2', variation: 0.01, angle: 0 } },
  { id: 'terrazzo' as MaterialId, name: '', color: '#cbc5bb', roughness: 0.35, metalness: 0, cut: 'solid', pattern: { kind: 'granite', layout: 'stack', length: 1, width: 1, joint: 0.003, jointColor: '#9c968c', variation: 0.04, angle: 0 } },
  { id: 'stone' as MaterialId, name: '', color: '#a69e8f', roughness: 0.85, metalness: 0, cut: 'concrete' },
  { id: 'concretePolished' as MaterialId, name: '', color: '#9e9d98', roughness: 0.35, metalness: 0, cut: 'concrete' },
  { id: 'mirror' as MaterialId, name: '', color: '#dfe6ea', roughness: 0.02, metalness: 1, cut: 'none' },
  { id: 'frostedGlass' as MaterialId, name: '', color: '#e3edf1', roughness: 0.5, metalness: 0, cut: 'none' },
  { id: 'plasticWhite' as MaterialId, name: '', color: '#f0f0ee', roughness: 0.4, metalness: 0, cut: 'solid' },
  { id: 'plasticBlack' as MaterialId, name: '', color: '#202124', roughness: 0.45, metalness: 0, cut: 'solid' },
  { id: 'rubber' as MaterialId, name: '', color: '#2f3032', roughness: 0.9, metalness: 0, cut: 'solid' },
  { id: 'carpet' as MaterialId, name: '', color: '#77726c', roughness: 1, metalness: 0, cut: 'solid' },
  { id: 'jute' as MaterialId, name: '', color: '#b79b6f', roughness: 1, metalness: 0, cut: 'solid' },
  { id: 'water' as MaterialId, name: '', color: '#5fa2c2', roughness: 0.05, metalness: 0, cut: 'none' },
  { id: 'soil' as MaterialId, name: '', color: '#6b4f3a', roughness: 1, metalness: 0, cut: 'concrete' },
  { id: 'screen' as MaterialId, name: '', color: '#0e1013', roughness: 0.1, metalness: 0.2, cut: 'solid' },
  { id: 'bottleGlass' as MaterialId, name: '', color: '#2e5a35', roughness: 0.08, metalness: 0, cut: 'none' },
  // Construction's materials (wall/library-types.ts, room/schema.ts FLOOR_BUILDUPS): blocks, boards, floorings, claddings, each with its pattern.
  { id: 'concreteBlock' as MaterialId, name: '', color: '#b9b6ae', roughness: 0.9, metalness: 0, cut: 'concrete', pattern: { kind: 'brick', layout: 'running', length: 0.39, width: 0.19, joint: 0.01, jointColor: '#a39f96', variation: 0.06, angle: 0 } },
  { id: 'ceramicBlock' as MaterialId, name: '', color: '#b8704c', roughness: 0.85, metalness: 0, cut: 'brick', pattern: { kind: 'brick', layout: 'running', length: 0.29, width: 0.19, joint: 0.01, jointColor: '#cfc6b8', variation: 0.1, angle: 0 } },
  { id: 'gypsumGreen' as MaterialId, name: '', color: '#d8e3d3', roughness: 0.9, metalness: 0, cut: 'solid' },
  { id: 'osb' as MaterialId, name: '', color: '#c9a56c', roughness: 0.8, metalness: 0, cut: 'wood' },
  { id: 'cementBoard' as MaterialId, name: '', color: '#a9a8a2', roughness: 0.85, metalness: 0, cut: 'concrete' },
  { id: 'eps' as MaterialId, name: '', color: '#f2f1ec', roughness: 0.95, metalness: 0, cut: 'insulation' },
  { id: 'vinylPlank' as MaterialId, name: '', color: '#a88563', roughness: 0.5, metalness: 0, cut: 'solid', pattern: { kind: 'wood', layout: 'running', length: 1.22, width: 0.18, joint: 0.0005, jointColor: '#7a5a3d', variation: 0.1, angle: 0 } },
  { id: 'laminate' as MaterialId, name: '', color: '#b99572', roughness: 0.45, metalness: 0, cut: 'wood', pattern: { kind: 'wood', layout: 'running', length: 1.38, width: 0.19, joint: 0.0008, jointColor: '#86664a', variation: 0.12, angle: 0 } },
  { id: 'parquet' as MaterialId, name: '', color: '#9b6c44', roughness: 0.5, metalness: 0, cut: 'wood', pattern: { kind: 'wood', layout: 'herringbone', length: 0.35, width: 0.07, joint: 0.001, jointColor: '#5b3f27', variation: 0.15, angle: 0 } },
  { id: 'porcelainLarge' as MaterialId, name: '', color: '#cfcac2', roughness: 0.25, metalness: 0, cut: 'solid', pattern: { kind: 'tiles', layout: 'running', length: 1.2, width: 0.6, joint: 0.002, jointColor: '#b9b3aa', variation: 0.03, angle: 0 } },
  { id: 'subwayTile' as MaterialId, name: '', color: '#f2f0ec', roughness: 0.2, metalness: 0, cut: 'solid', pattern: { kind: 'tiles', layout: 'running', length: 0.2, width: 0.1, joint: 0.002, jointColor: '#d3cfc6', variation: 0.03, angle: 0 } },
  { id: 'hydraulicTile' as MaterialId, name: '', color: '#cdbc9f', roughness: 0.6, metalness: 0, cut: 'solid', pattern: { kind: 'tiles', layout: 'checker', length: 0.2, width: 0.2, joint: 0.002, jointColor: '#9c8c72', variation: 0.04, angle: 0, color2: '#5e7a6e' } },
  { id: 'deck' as MaterialId, name: '', color: '#8a6243', roughness: 0.7, metalness: 0, cut: 'wood', pattern: { kind: 'wood', layout: 'running', length: 1.5, width: 0.14, joint: 0.006, jointColor: '#2e2219', variation: 0.14, angle: 0 } },
  { id: 'stoneCladding' as MaterialId, name: '', color: '#9e9385', roughness: 0.9, metalness: 0, cut: 'concrete', pattern: { kind: 'brick', layout: 'running', length: 0.3, width: 0.05, joint: 0.004, jointColor: '#6f675c', variation: 0.28, angle: 0 } },
  { id: 'flagstone' as MaterialId, name: '', color: '#a49a88', roughness: 0.85, metalness: 0, cut: 'concrete', pattern: { kind: 'flagstone', layout: 'stack', length: 0.45, width: 0.4, joint: 0.015, jointColor: '#7d776d', variation: 0.2, angle: 0 } },
  { id: 'woodSlats' as MaterialId, name: '', color: '#a77b51', roughness: 0.6, metalness: 0, cut: 'wood', pattern: { kind: 'wood', layout: 'stack', length: 2.4, width: 0.04, joint: 0.012, jointColor: '#2a2119', variation: 0.08, angle: 0 } },
];

/** The materials seen through in the views, each with its opacity: glass, frosted glass, water. */
export const SEE_THROUGH: Readonly<Record<string, number>> = { glass: 0.45, frostedGlass: 0.8, water: 0.7 };

/** A material for a name an older file used and the built-in ones do not have: grey, plain. */
export const materialFor = (ref: string): Material => BUILT_IN_MATERIALS.find((m) => m.id === ref) ?? { id: ref as MaterialId, name: ref, color: '#9c9a94', roughness: 0.9, metalness: 0, cut: 'solid' };

import { isColor } from '../../core/guards';

/** A #rrggbb colour, as the file-read guards use (model/guards is the one copy). */
export { isColor };

/** A project's material by id; a name it does not have gets the plain grey one (materialFor). */
export const materialIn = (list: readonly Material[], ref: string): Material => list.find((m) => m.id === ref) ?? materialFor(ref);

/** A colour's channels (0–255), from #rrggbb or rgb(r g b); null for another form. */
function channels(c: string): [number, number, number] | null {
  if (isColor(c)) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /^rgb\((\d+)[ ,]+(\d+)[ ,]+(\d+)\)$/.exec(String(c).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** WCAG's relative luminance of channels. */
const luminance = ([r, g, b]: [number, number, number]): number => {
  const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

/**
 * A layer's cut as the plan fills it: its colour shaded for the theme (shade), then mixed toward white
 * or black as little as it takes for the wall's line to read on it (3:1, WCAG's for graphics): a walnut
 * or a black lacquer layer under a dark line, a material the user made dark. Its own colour otherwise.
 */
export function cutFill(color: string, k: number, line: string): string {
  const shaded = shade(color, k);
  const fill = channels(shaded);
  const ink = channels(line);
  if (!fill || !ink || contrast(fill, ink) >= 3) return shaded;
  for (let t = 0.05; t <= 1.001; t += 0.05) {
    for (const to of [255, 0]) {
      const mixed = fill.map((v) => Math.round(v + (to - v) * t)) as [number, number, number];
      if (contrast(mixed, ink) >= 3) return `rgb(${mixed[0]} ${mixed[1]} ${mixed[2]})`;
    }
  }
  return shaded;
}

/** A colour darkened (k < 1) toward black, for the plan's dark theme: the light wall line must read on it. */
export function shade(color: string, k: number): string {
  if (k >= 1 || !isColor(color)) return color;
  const n = parseInt(color.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * k);
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
}
