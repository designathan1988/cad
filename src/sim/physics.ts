// The materials' physics for the simulations (docs/plano-de-escopo.md, phase 14): conductivity,
// density and specific heat from NBR 15220-2's table B.3 (as in its 2003 draft text, to confirm in the
// edition in force), the water vapour resistance factor as building physics tables give it (typical
// values, to confirm in ISO 10456), and what a wall of it takes from a Wi-Fi signal (adopted, from
// site survey guides). A project's material may carry its own; the built-in ones have these. Pure.

import type { Material } from '../elements/material/schema';

export interface MaterialPhysics {
  /** λ, W/(m·K). */
  readonly conductivity: number;
  /** ρ, kg/m³. */
  readonly density: number;
  /** c, kJ/(kg·K). */
  readonly specificHeat: number;
  /** μ, the water vapour resistance factor (air 1); 1e6 for a barrier (glass, metal). */
  readonly vapour: number;
  /** dB a wall of it takes from a 2.4 GHz signal. */
  readonly wifiLoss: number;
}

/** What the table says of each built-in material, and where each line comes from. */
export const DEFAULT_PHYSICS: Readonly<Record<string, MaterialPhysics & { readonly source: string }>> = {
  // Argamassa comum: 1800–2100 kg/m³, λ 1,15, c 1,00.
  plaster: { conductivity: 1.15, density: 2000, specificHeat: 1.0, vapour: 10, wifiLoss: 2, source: 'NBR 15220-2 B.3: argamassa comum' },
  // Tijolos e telhas de barro, 1300–1600 kg/m³: λ 0,90, c 0,92.
  brick: { conductivity: 0.9, density: 1600, specificHeat: 0.92, vapour: 10, wifiLoss: 8, source: 'NBR 15220-2 B.3: tijolos de barro 1300–1600 kg/m³' },
  // Concreto normal (agregados de pedra): 2200–2400 kg/m³, λ 1,75, c 1,00.
  concrete: { conductivity: 1.75, density: 2300, specificHeat: 1.0, vapour: 100, wifiLoss: 12, source: 'NBR 15220-2 B.3: concreto normal' },
  // Placa de gesso, gesso cartonado: 750–1000 kg/m³, λ 0,35, c 0,84.
  gypsum: { conductivity: 0.35, density: 875, specificHeat: 0.84, vapour: 10, wifiLoss: 3, source: 'NBR 15220-2 B.3: placa de gesso' },
  // Lã de rocha: 20–200 kg/m³, λ 0,045, c 0,75.
  insulation: { conductivity: 0.045, density: 100, specificHeat: 0.75, vapour: 1, wifiLoss: 1, source: 'NBR 15220-2 B.3: lã de rocha' },
  // Madeira de densidade elevada: 800–1000 kg/m³, λ 0,29, c 1,34.
  wood: { conductivity: 0.29, density: 900, specificHeat: 1.34, vapour: 50, wifiLoss: 4, source: 'NBR 15220-2 B.3: madeira 800–1000 kg/m³' },
  // Aço: 7800 kg/m³, λ 55, c 0,46.
  metal: { conductivity: 55, density: 7800, specificHeat: 0.46, vapour: 1e6, wifiLoss: 26, source: 'NBR 15220-2 B.3: aço' },
  // Vidro comum: 2500 kg/m³, λ 1,00, c 0,84.
  glass: { conductivity: 1.0, density: 2500, specificHeat: 0.84, vapour: 1e6, wifiLoss: 3, source: 'NBR 15220-2 B.3: vidro comum' },
  // Tijolos e telhas de barro, 1800–2000 kg/m³ (a fired tile): λ 1,05, c 0,92.
  tile: { conductivity: 1.05, density: 1900, specificHeat: 0.92, vapour: 200, wifiLoss: 2, source: 'NBR 15220-2 B.3: barro 1800–2000 kg/m³' },
  // A screed is argamassa comum.
  screed: { conductivity: 1.15, density: 2000, specificHeat: 1.0, vapour: 10, wifiLoss: 2, source: 'NBR 15220-2 B.3: argamassa comum' },
};

/** A material's physics: its own, else the table's for its id, else none (it is said in the results). */
export function physicsOf(m: Material): MaterialPhysics | null {
  return m.physics ?? DEFAULT_PHYSICS[m.id] ?? null;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isPhysics = (x: unknown): x is MaterialPhysics => {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return [o.conductivity, o.density, o.specificHeat, o.vapour, o.wifiLoss].every(finite) && (o.conductivity as number) > 0 && (o.density as number) > 0 && (o.specificHeat as number) > 0 && (o.vapour as number) >= 1 && (o.wifiLoss as number) >= 0;
};

/**
 * A surface's solar absorptance from its colour: one less its reflectance, the colour's relative
 * luminance (sRGB). An estimate: a paint's own measured value is what NBR 15575 asks for.
 */
export function absorptanceOf(color: string): number {
  const n = parseInt(color.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return Math.round((1 - y) * 100) / 100;
}
