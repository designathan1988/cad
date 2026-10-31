// Ready-made models of the elements that have no types of their own (columns, beams, stairs, railings):
// each a name and the properties it sets on the tool's next element (app/next-element.ts). The store
// (ui/presets-dialog.ts) shows them pictured, and places one by setting the next element to it.

import type { Beam } from './beam/schema';
import type { Column } from './column/schema';
import type { Curtain } from './curtain/schema';
import type { Words } from './object/schema';
import type { Railing } from './railing/schema';
import { edgesFor, type Roof, type RoofKind } from './roof/schema';
import type { Stair } from './stair/schema';

export type PresetSlot = 'columns' | 'beams' | 'stairs' | 'railings' | 'roofs' | 'curtains';

/** The element each slot makes. */
interface SlotElement {
  readonly columns: Column;
  readonly beams: Beam;
  readonly stairs: Stair;
  readonly railings: Railing;
  readonly roofs: Roof;
  readonly curtains: Curtain;
}

/**
 * A preset: its patch holds only fields of its slot's element, with their types, so a field renamed in a kind
 * is an error here (as an untyped record, it stopped applying without a sign).
 */
export type Preset = {
  readonly [S in PresetSlot]: { readonly id: string; readonly slot: S; readonly name: Words; readonly patch: Partial<Omit<SlotElement[S], 'id' | 'levelId'>> };
}[PresetSlot];

const w = (pt: string, en: string): Words => ({ pt, en });

/** The tool each slot is placed with. */
export const PRESET_TOOL = { columns: 'column', beams: 'beam', stairs: 'stair', railings: 'railing', roofs: 'roof', curtains: 'curtain' } as const;

/** A roof's make: its form, its slope (%), its overhang; its sides worked out on a square outline, which it carries:
 * over the outline of the project's last roof (an L), the store pictured four sides on six. Placing draws its own. */
const SQUARE = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }];
const roof = (kind: RoofKind, grade: number, overhang: number, extra: Partial<Roof> = {}): Partial<Roof> => ({ kind, outline: SQUARE, edges: edgesFor(kind, SQUARE, grade, overhang), ...extra });

export const PRESETS: readonly Preset[] = [
  { id: 'colConcrete25', slot: 'columns', name: w('Concreto 25 × 25', 'Concrete 25 × 25'), patch: { shape: 'rect', width: 0.25, depth: 0.25 } },
  { id: 'colConcrete20x40', slot: 'columns', name: w('Concreto 20 × 40', 'Concrete 20 × 40'), patch: { shape: 'rect', width: 0.2, depth: 0.4 } },
  { id: 'colConcrete40', slot: 'columns', name: w('Concreto 40 × 40', 'Concrete 40 × 40'), patch: { shape: 'rect', width: 0.4, depth: 0.4 } },
  { id: 'colRound30', slot: 'columns', name: w('Redondo Ø 30', 'Round Ø 30'), patch: { shape: 'round', width: 0.3, depth: 0.3 } },
  { id: 'colSteelI', slot: 'columns', name: w('Aço, perfil I 20', 'Steel I 20'), patch: { shape: 'I', width: 0.2, depth: 0.2, plate: 0.012 } },
  { id: 'colSteelH', slot: 'columns', name: w('Aço, perfil H 25', 'Steel H 25'), patch: { shape: 'H', width: 0.25, depth: 0.25, plate: 0.015 } },
  { id: 'colSteelL', slot: 'columns', name: w('Aço, cantoneira L 15', 'Steel angle L 15'), patch: { shape: 'L', width: 0.15, depth: 0.15, plate: 0.012 } },
  { id: 'beam15x40', slot: 'beams', name: w('Concreto 15 × 40', 'Concrete 15 × 40'), patch: { shape: 'rect', width: 0.15, depth: 0.4 } },
  { id: 'beam20x50', slot: 'beams', name: w('Concreto 20 × 50', 'Concrete 20 × 50'), patch: { shape: 'rect', width: 0.2, depth: 0.5 } },
  { id: 'beam20x60', slot: 'beams', name: w('Concreto 20 × 60', 'Concrete 20 × 60'), patch: { shape: 'rect', width: 0.2, depth: 0.6 } },
  { id: 'beam12x30', slot: 'beams', name: w('Baldrame 12 × 30', 'Ground beam 12 × 30'), patch: { shape: 'rect', width: 0.12, depth: 0.3 } },
  { id: 'beamSteelI', slot: 'beams', name: w('Aço, perfil I 15 × 30', 'Steel I 15 × 30'), patch: { shape: 'I', width: 0.15, depth: 0.3, plate: 0.01 } },
  { id: 'stairStraight100', slot: 'stairs', name: w('Reta, 1,00 m', 'Straight, 1.00 m'), patch: { kind: 'straight', width: 1, tread: 0.28 } },
  { id: 'stairStraight120', slot: 'stairs', name: w('Reta, 1,20 m', 'Straight, 1.20 m'), patch: { kind: 'straight', width: 1.2, tread: 0.3 } },
  { id: 'stairL', slot: 'stairs', name: w('Em L, 1,00 m', 'L-shaped, 1.00 m'), patch: { kind: 'l', width: 1, tread: 0.28 } },
  { id: 'stairU', slot: 'stairs', name: w('Em U, 1,00 m', 'U-shaped, 1.00 m'), patch: { kind: 'u', width: 1, tread: 0.28 } },
  { id: 'stairSpiral', slot: 'stairs', name: w('Caracol, 0,80 m', 'Spiral, 0.80 m'), patch: { kind: 'spiral', width: 0.8, tread: 0.25 } },
  { id: 'stairRamp', slot: 'stairs', name: w('Rampa acessível 8,33 %', 'Accessible ramp 8.33 %'), patch: { kind: 'ramp', width: 1.2, grade: 8.33 } },
  { id: 'railBalusters', slot: 'railings', name: w('Balaústres, 1,10 m', 'Balusters, 1.10 m'), patch: { infill: 'balusters', height: 1.1 } },
  { id: 'railRails', slot: 'railings', name: w('Barras horizontais, 1,10 m', 'Horizontal rails, 1.10 m'), patch: { infill: 'rails', height: 1.1 } },
  { id: 'railGlass', slot: 'railings', name: w('Vidro, 1,10 m', 'Glass, 1.10 m'), patch: { infill: 'glass', height: 1.1 } },
  { id: 'railStair', slot: 'railings', name: w('Balaústres, 0,90 m (escada)', 'Balusters, 0.90 m (stair)'), patch: { infill: 'balusters', height: 0.9 } },
  { id: 'roofHip30', slot: 'roofs', name: w('Quatro águas, telha cerâmica 30 %', 'Hip, clay tiles 30 %'), patch: roof('hip', 30, 0.5, { covering: { materialId: 'clayTile', thickness: 0.01 } }) },
  { id: 'roofGable35', slot: 'roofs', name: w('Duas águas, telha cerâmica 35 %', 'Gable, clay tiles 35 %'), patch: roof('gable', 35, 0.6, { covering: { materialId: 'clayTile', thickness: 0.01 } }) },
  { id: 'roofGable45', slot: 'roofs', name: w('Duas águas íngreme 45 %, granito preto', 'Steep gable 45 %, black granite'), patch: roof('gable', 45, 0.4, { covering: { materialId: 'graniteBlack', thickness: 0.01 } }) },
  { id: 'roofShed10', slot: 'roofs', name: w('Uma água, metálica 10 %', 'Shed, metal sheet 10 %'), patch: roof('shed', 10, 0.3, { covering: { materialId: 'metal', thickness: 0.005 } }) },
  { id: 'roofFlat', slot: 'roofs', name: w('Laje plana com platibanda', 'Flat slab with parapet'), patch: roof('flat', 0, 0, { parapet: 0.9, covering: { materialId: 'concrete', thickness: 0.01 } }) },
  { id: 'cwGrid125', slot: 'curtains', name: w('Pele de vidro, módulos 1,25 m', 'Glass skin, 1.25 m modules'), patch: { vertical: { mode: 'spacing', value: 1.25 }, horizontal: { mode: 'spacing', value: 1.4 }, mullion: 0.05, depth: 0.15, panel: 'glass' } },
  { id: 'cwStorefront', slot: 'curtains', name: w('Vitrine de loja, 2 faixas', 'Storefront, 2 bands'), patch: { vertical: { mode: 'max', value: 1.8 }, horizontal: { mode: 'count', value: 2 }, mullion: 0.06, depth: 0.12, panel: 'glass' } },
  { id: 'cwSlim', slot: 'curtains', name: w('Caixilho fino, 1,00 m', 'Slim frame, 1.00 m'), patch: { vertical: { mode: 'spacing', value: 1 }, horizontal: { mode: 'count', value: 3 }, mullion: 0.03, depth: 0.1, panel: 'glass' } },
  { id: 'cwOpaque', slot: 'curtains', name: w('Painéis opacos', 'Opaque panels'), patch: { vertical: { mode: 'spacing', value: 1.2 }, horizontal: { mode: 'count', value: 3 }, mullion: 0.05, depth: 0.15, panel: 'opaque' } },
];
