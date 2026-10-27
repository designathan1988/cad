// The walls as an envelope (docs/plano-de-escopo.md, phase 14, the quick level): each wall type's
// thermal transmittance and capacity (NBR 15220-2), against NBR 15575-4's simplified limits; the
// condensation check through its layers by Glaser's method (ISO 13788) and the inside surface's mould
// risk; and its airborne sound insulation by its mass. Estimates, with their premises. Pure.

import type { WallType } from '../elements/wall/schema';
import { type Material, materialIn } from '../elements/material/schema';
import { absorptanceOf, type MaterialPhysics, physicsOf } from './physics';
import type { SimSettings } from './settings';

/** NBR 15220-2's surface resistances for a wall (horizontal flow), m²·K/W. */
export const R_SI = 0.13;
export const R_SE = 0.04;

export interface LayerPhysics {
  readonly materialId: string;
  readonly thickness: number;
  readonly physics: MaterialPhysics | null;
}

const layersOf = (type: WallType, materials: readonly Material[]): LayerPhysics[] =>
  type.layers.map((l) => ({ materialId: l.materialId, thickness: l.thickness, physics: physicsOf(materialIn(materials, l.materialId)) }));

export interface Thermal {
  readonly typeId: string;
  /** m²·K/W, surface to surface plus the two surface resistances; null when a layer has no physics. */
  readonly resistance: number | null;
  /** W/(m²·K). */
  readonly transmittance: number | null;
  /** kJ/(m²·K), Σ e·c·ρ. */
  readonly capacity: number | null;
  /** The exterior face's solar absorptance, estimated from its colour. */
  readonly absorptance: number;
  /** h: the thermal lag (NBR 15220-2 section 7); null when a layer has no physics. */
  readonly lag: number | null;
  /** %: the opaque solar factor, 4·U·α (NBR 15220-2 section 8, Rse 0.04). */
  readonly solarFactor: number | null;
  /** Materials with no physics: the results wait for them. */
  readonly missing: readonly string[];
  /** NBR 15575-4's simplified limits for the zone (to confirm in the edition in force). */
  readonly limitU: number;
  readonly limitCT: number | null;
  readonly okU: boolean | null;
  readonly okCT: boolean | null;
}

/**
 * Thermal lag (h), NBR 15220-2 section 7: one material through, φ = 0.7284·√(Rt·CT); layered,
 * φ = 1.382·Rt·√(B1 + B2), B0 = CT − CText, B1 = 0.226·B0/Rt, B2 = 0.205·((λρc)ext/Rt)·(Rext − (Rt − Rext)/10),
 * B2 none when negative. Rt surface to surface (m²K/W); capacities kJ/(m²K); the exterior layer's
 * λ (W/mK), ρ (kg/m³), c (kJ/kgK) and resistance. Checked against the norm's example C.1 (3.3 h).
 */
export function lagOf(rt: number, ct: number, exterior: { ct: number; r: number; lrc: number } | null): number {
  if (exterior === null) return 0.7284 * Math.sqrt(rt * ct);
  const b0 = ct - exterior.ct;
  const b1 = (0.226 * b0) / rt;
  const b2 = Math.max(0, 0.205 * (exterior.lrc / rt) * (exterior.r - (rt - exterior.r) / 10));
  return 1.382 * rt * Math.sqrt(Math.max(0, b1 + b2));
}

/** NBR 15575-4 (2013), simplified procedure, external walls: U by zone and absorptance; CT ≥ 130 but in zone 8. */
export function limitsFor(zone: number, absorptance: number): { u: number; ct: number | null } {
  const u = zone <= 2 ? 2.5 : absorptance <= 0.6 ? 3.7 : 2.5;
  return { u, ct: zone === 8 ? null : 130 };
}

export function thermalOf(type: WallType, materials: readonly Material[], s: SimSettings): Thermal {
  const layers = layersOf(type, materials);
  const missing = [...new Set(layers.filter((l) => !l.physics).map((l) => l.materialId))];
  const outer = materialIn(materials, type.layers[0]?.materialId ?? '');
  const absorptance = absorptanceOf(outer.color);
  const limits = limitsFor(s.zone, absorptance);
  if (missing.length > 0) return { typeId: type.id, resistance: null, transmittance: null, capacity: null, absorptance, lag: null, solarFactor: null, missing, limitU: limits.u, limitCT: limits.ct, okU: null, okCT: null };
  const surfaces = layers.reduce((t, l) => t + l.thickness / l.physics!.conductivity, 0);
  const resistance = R_SI + R_SE + surfaces;
  const capacity = layers.reduce((t, l) => t + l.thickness * l.physics!.specificHeat * l.physics!.density, 0);
  const transmittance = 1 / resistance;
  // One material through it, or layers: the exterior one (the type's first) its own terms.
  const one = new Set(layers.map((l) => l.materialId)).size === 1;
  const ext = layers[0]!;
  const e = ext.physics!;
  const lag = lagOf(surfaces, capacity, one ? null : { ct: ext.thickness * e.specificHeat * e.density, r: ext.thickness / e.conductivity, lrc: e.conductivity * e.density * e.specificHeat });
  return {
    typeId: type.id,
    resistance,
    transmittance,
    capacity,
    absorptance,
    lag,
    solarFactor: 4 * transmittance * absorptance,
    missing,
    limitU: limits.u,
    limitCT: limits.ct,
    okU: transmittance <= limits.u + 1e-9,
    okCT: limits.ct === null ? null : capacity >= limits.ct - 1e-9,
  };
}

/** Saturation pressure of water vapour (Pa) at θ °C (ISO 13788 annex E: over water, over ice below 0). */
export function saturation(theta: number): number {
  return theta >= 0 ? 610.5 * Math.exp((17.269 * theta) / (237.3 + theta)) : 610.5 * Math.exp((21.875 * theta) / (265.5 + theta));
}

export interface GlaserPlane {
  /** Between which layers (−1: the inside surface; the layers counted from the inside). */
  readonly after: number;
  readonly temperature: number;
  readonly saturation: number;
  readonly pressure: number;
}

export interface Glaser {
  readonly typeId: string;
  /** Each plane from the inside surface to the outside one. */
  readonly planes: readonly GlaserPlane[];
  /** The planes where the vapour's pressure passes the saturation's: condensation (as the straight line goes). */
  readonly condenses: readonly number[];
  /** The inside surface's relative humidity: above 0.8, mould (ISO 13788's criterion). */
  readonly surfaceHumidity: number;
  readonly mould: boolean;
  readonly missing: readonly string[];
}

/**
 * Glaser's check: steady temperatures through the layers by their resistances, vapour pressures by
 * their equivalent air layers (sd = μ·e), straight from inside to outside; condensation where that
 * line passes the saturation pressure at a plane. A first check: where it condenses, the amount and
 * whether it dries are for a monthly (ISO 13788) or dynamic (EN 15026) calculation.
 */
export function glaserOf(type: WallType, materials: readonly Material[], s: SimSettings): Glaser {
  const layers = layersOf(type, materials).reverse();
  const missing = [...new Set(layers.filter((l) => !l.physics).map((l) => l.materialId))];
  const ti = s.inside.temperature;
  const te = s.outside.temperature;
  const pi = s.inside.humidity * saturation(ti);
  const pe = s.outside.humidity * saturation(te);
  if (missing.length > 0) return { typeId: type.id, planes: [], condenses: [], surfaceHumidity: 0, mould: false, missing };
  const total = R_SI + R_SE + layers.reduce((t, l) => t + l.thickness / l.physics!.conductivity, 0);
  const sdTotal = layers.reduce((t, l) => t + l.physics!.vapour * l.thickness, 0);
  const planes: GlaserPlane[] = [];
  let r = R_SI;
  let sd = 0;
  for (let i = -1; i < layers.length; i++) {
    if (i >= 0) {
      r += layers[i]!.thickness / layers[i]!.physics!.conductivity;
      sd += layers[i]!.physics!.vapour * layers[i]!.thickness;
    }
    const temperature = ti - ((ti - te) * r) / total;
    const pressure = sdTotal > 0 ? pi - ((pi - pe) * sd) / sdTotal : pi;
    planes.push({ after: i, temperature, saturation: saturation(temperature), pressure });
  }
  const condenses = planes.filter((p) => p.pressure > p.saturation + 1e-9).map((p) => p.after);
  const surfaceHumidity = pi / planes[0]!.saturation;
  return { typeId: type.id, planes, condenses, surfaceHumidity, mould: surfaceHumidity > 0.8, missing };
}

export interface Acoustic {
  readonly typeId: string;
  /** kg/m². */
  readonly mass: number | null;
  /** dB: the weighted sound reduction index of a heavy single leaf by its mass (EN 12354-1 annex B), for m' ≥ 150. */
  readonly rw: number | null;
  /** dB at 500 Hz by the field mass law (20·log(m'·f) − 47). */
  readonly r500: number | null;
  readonly missing: readonly string[];
}

/**
 * Sound absorption coefficients at 500 Hz by material (typical values of building acoustics tables,
 * adopted): what a surface of it takes of the sound that falls on it. One not listed: 0.05.
 */
export const ABSORPTION: Readonly<Record<string, number>> = {
  plaster: 0.02,
  brick: 0.03,
  concrete: 0.02,
  gypsum: 0.05,
  insulation: 0.8,
  wood: 0.1,
  mdfWhite: 0.1,
  metal: 0.02,
  glass: 0.18,
  tile: 0.01,
  screed: 0.02,
  fabric: 0.3,
  ceramic: 0.01,
};
const OTHER_ABSORPTION = 0.05;
const absorptionOf = (id: string | undefined, fallback: string) => ABSORPTION[id ?? fallback] ?? OTHER_ABSORPTION;

export interface Reverberation {
  readonly roomId: string;
  /** m³. */
  readonly volume: number;
  /** m² of open window equivalent: Σ S·α. */
  readonly absorption: number;
  /** s, Sabine's: 0.161·V / A, the room empty. */
  readonly time: number;
}

/**
 * Each room's reverberation time at 500 Hz, empty (Sabine): its floor, ceiling and walls by their
 * finishes (plaster for walls and ceiling, screed for the floor when none is set), its windows'
 * glass and its doors' wood taken off the walls.
 */
export function reverberationOf(
  rooms: readonly { id: string; area: number; perimeter: number; height: number; finishes?: { floor?: string; wall?: string; ceiling?: string } }[],
  openings: (roomId: string) => { windows: number; doors: number },
): Reverberation[] {
  return rooms.map((r) => {
    const { windows, doors } = openings(r.id);
    const walls = Math.max(0, r.perimeter * r.height - windows - doors);
    const absorption = r.area * absorptionOf(r.finishes?.floor, 'screed') + r.area * absorptionOf(r.finishes?.ceiling, 'plaster') + walls * absorptionOf(r.finishes?.wall, 'plaster') + windows * ABSORPTION.glass! + doors * ABSORPTION.wood!;
    const volume = r.area * r.height;
    return { roomId: r.id, volume, absorption, time: absorption > 0 ? (0.161 * volume) / absorption : 0 };
  });
}

export function acousticOf(type: WallType, materials: readonly Material[]): Acoustic {
  const layers = layersOf(type, materials);
  const missing = [...new Set(layers.filter((l) => !l.physics).map((l) => l.materialId))];
  if (missing.length > 0) return { typeId: type.id, mass: null, rw: null, r500: null, missing };
  const mass = layers.reduce((t, l) => t + l.thickness * l.physics!.density, 0);
  return { typeId: type.id, mass, rw: mass >= 150 ? 37.5 * Math.log10(mass) - 42 : null, r500: 20 * Math.log10(mass * 500) - 47, missing };
}
