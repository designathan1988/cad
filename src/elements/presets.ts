// Ready-made models of the elements that have no types of their own (columns, beams, stairs, railings):
// each a name and the properties it sets on the tool's next element (app/next-element.ts). The store
// (ui/presets-dialog.ts) shows them pictured, and places one by setting the next element to it.

import type { Words } from './object/schema';

export type PresetSlot = 'columns' | 'beams' | 'stairs' | 'railings';

export interface Preset {
  readonly id: string;
  readonly slot: PresetSlot;
  readonly name: Words;
  readonly patch: Readonly<Record<string, unknown>>;
}

const w = (pt: string, en: string): Words => ({ pt, en });

/** The tool each slot is placed with. */
export const PRESET_TOOL = { columns: 'column', beams: 'beam', stairs: 'stair', railings: 'railing' } as const;

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
];
