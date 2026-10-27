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

/**
 * NBR 15220-3 (2005) annex C, as given in LabEEE/UFSC's course notes: the external wall each zone asks for
 * (table C.2) and that wall's limits (table C.1): U ≤ (W/m²K), φ at most or at least (h), FSo ≤ (%).
 * Recommendations, not requirements; the 2024 edition of part 3 changed the zoning, to confirm.
 */
export type WallClass = 'light' | 'lightReflective' | 'heavy';
export const WALL_CLASSES: Readonly<Record<WallClass, { readonly u: number; readonly lagMax: number | null; readonly lagMin: number | null; readonly fso: number }>> = {
  light: { u: 3.0, lagMax: 4.3, lagMin: null, fso: 5.0 },
  lightReflective: { u: 3.6, lagMax: 4.3, lagMin: null, fso: 4.0 },
  heavy: { u: 2.2, lagMax: null, lagMin: 6.5, fso: 3.5 },
};
const ZONE_WALLS: readonly WallClass[] = ['light', 'light', 'lightReflective', 'heavy', 'lightReflective', 'heavy', 'heavy', 'lightReflective'];
export const zoneWall = (zone: number): WallClass => ZONE_WALLS[Math.min(8, Math.max(1, Math.round(zone))) - 1]!;

/**
 * NBR 15220-3 (2005; its 2003 project text, at LabEEE/UFSC), tables 1 to 22 and C.1: the openings for
 * ventilation each zone asks for (medium in 1 to 6, small in 7, large in 8), as the effective area in % of
 * the floor of a long-stay room (kitchen, bedroom, living room; note 2): small 10 to 15 %, medium 15 to
 * 25 %, large over 40 %. And their shading: the sun let in in the cold season (1 to 3), shaded (4 to 8).
 */
export type VentSize = 'small' | 'medium' | 'large';
export const VENT_SIZES: Readonly<Record<VentSize, { readonly min: number; readonly max: number | null }>> = {
  small: { min: 10, max: 15 },
  medium: { min: 15, max: 25 },
  large: { min: 40, max: null },
};
const ZONE_VENTS: readonly VentSize[] = ['medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'small', 'large'];
const zoneIndex = (zone: number): number => Math.min(8, Math.max(1, Math.round(zone))) - 1;
export const zoneVents = (zone: number): VentSize => ZONE_VENTS[zoneIndex(zone)]!;
export const zoneShading = (zone: number): 'winterSun' | 'shade' => (zoneIndex(zone) < 3 ? 'winterSun' : 'shade');

/** A share of the floor (%) against a size of table C.1: under it, in it, or over it. */
export function ventVerdict(share: number, size: VentSize): 'under' | 'in' | 'over' {
  const { min, max } = VENT_SIZES[size];
  return share < min - 1e-9 ? 'under' : max !== null && share > max + 1e-9 ? 'over' : 'in';
}

/**
 * The share of a window that opens, by how it opens: none for a fixed one, half for a sliding or a
 * double-hung one (its leaves pass each other), the whole for one whose leaves turn (casement, awning,
 * hopper, pivot) and for a plain one with no make. The frame's area, not the open air an awning's angle leaves.
 */
export function openableShare(operation: string | undefined): number {
  if (operation === 'fixed') return 0;
  if (operation === 'sliding' || operation === 'doubleHung') return 0.5;
  return 1;
}

export interface Guideline {
  readonly wall: WallClass;
  readonly u: boolean;
  readonly lag: boolean;
  readonly fso: boolean;
  readonly ok: boolean;
}

/** A wall type's results against its zone's guideline; null while a layer has no physics. */
export function guidelineOf(r: Thermal, zone: number): Guideline | null {
  if (r.transmittance === null || r.lag === null || r.solarFactor === null) return null;
  const wall = zoneWall(zone);
  const c = WALL_CLASSES[wall];
  const u = r.transmittance <= c.u + 1e-9;
  const lag = (c.lagMax === null || r.lag <= c.lagMax + 1e-9) && (c.lagMin === null || r.lag >= c.lagMin - 1e-9);
  const fso = r.solarFactor <= c.fso + 1e-9;
  return { wall, u, lag, fso, ok: u && lag && fso };
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

/**
 * NBR 15220-2's surface resistances for a roof: heat flowing down (NBR 15220-3 table C.2 note 3: a roof,
 * "telhado mais ático mais forro", is checked for the downward flow), m²·K/W (Tabela 7).
 */
export const R_SI_DOWN = 0.17;
/** An attic, the air between the roof and a ceiling, flow down (NBR 15220-3 table D.4's roofs are figured with it). */
export const R_ATTIC = 0.21;

/** NBR 15220-3 (2005) table C.2: the roof each zone asks for (zones 1 to 6 light insulated, 7 heavy, 8 light reflective). */
export type RoofClass = 'lightInsulated' | 'lightReflective' | 'heavy';
export const ROOF_CLASSES: Readonly<Record<RoofClass, { readonly u: number; readonly lagMax: number | null; readonly lagMin: number | null; readonly fso: number }>> = {
  lightInsulated: { u: 2.0, lagMax: 3.3, lagMin: null, fso: 6.5 },
  // U ≤ 2,30·FT: FT is 1 without a ceiling or with an attic not ventilated (its note), as taken here.
  lightReflective: { u: 2.3, lagMax: 3.3, lagMin: null, fso: 6.5 },
  heavy: { u: 2.0, lagMax: null, lagMin: 6.5, fso: 6.5 },
};
export const zoneRoof = (zone: number): RoofClass => (zoneIndex(zone) === 6 ? 'heavy' : zoneIndex(zone) === 7 ? 'lightReflective' : 'lightInsulated');

export interface RoofThermal {
  /** W/(m²·K), flow down; null when a layer has no physics. */
  readonly transmittance: number | null;
  readonly capacity: number | null;
  readonly lag: number | null;
  readonly absorptance: number;
  readonly solarFactor: number | null;
  readonly missing: readonly string[];
  /** Against the zone's class: each criterion, null while a layer has no physics. */
  readonly u: boolean | null;
  readonly lagOk: boolean | null;
  readonly fso: boolean | null;
}

/**
 * A roof's thermal behaviour (NBR 15220-2, flow down): its covering, and under it, when the level has a
 * ceiling, the attic and the ceiling's layers. Its solar factor from the covering's colour.
 */
export function roofThermalOf(covering: { readonly materialId: string; readonly thickness: number }, ceiling: readonly { readonly materialId: string; readonly thickness: number }[] | null, materials: readonly Material[], zone: number): RoofThermal {
  const layers = [covering, ...(ceiling ?? [])].map((l) => ({ materialId: l.materialId, thickness: l.thickness, physics: physicsOf(materialIn(materials, l.materialId)) }));
  const missing = [...new Set(layers.filter((l) => !l.physics).map((l) => l.materialId))];
  const absorptance = absorptanceOf(materialIn(materials, covering.materialId).color);
  if (missing.length > 0) return { transmittance: null, capacity: null, lag: null, absorptance, solarFactor: null, missing, u: null, lagOk: null, fso: null };
  const solids = layers.reduce((t, l) => t + l.thickness / l.physics!.conductivity, 0);
  const air = ceiling ? R_ATTIC : 0;
  const transmittance = 1 / (R_SI_DOWN + solids + air + R_SE);
  const capacity = layers.reduce((t, l) => t + l.thickness * l.physics!.specificHeat * l.physics!.density, 0);
  const one = new Set(layers.map((l) => l.materialId)).size === 1 && !ceiling;
  const ext = layers[0]!;
  const e = ext.physics!;
  const lag = lagOf(solids + air, capacity, one ? null : { ct: ext.thickness * e.specificHeat * e.density, r: ext.thickness / e.conductivity, lrc: e.conductivity * e.density * e.specificHeat });
  const solarFactor = 4 * transmittance * absorptance;
  const c = ROOF_CLASSES[zoneRoof(zone)];
  return {
    transmittance,
    capacity,
    lag,
    absorptance,
    solarFactor,
    missing,
    u: transmittance <= c.u + 1e-9,
    lagOk: (c.lagMax === null || lag <= c.lagMax + 1e-9) && (c.lagMin === null || lag >= c.lagMin - 1e-9),
    fso: solarFactor <= c.fso + 1e-9,
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

/**
 * A floor's impact sound (EN ISO 12354-2's simplified expression for a bare concrete floor, as given in
 * the literature, e.g. IST Lisbon's thesis on dwellings' sound insulation): Ln,w = 164 − 35·log m″ (dB),
 * m″ its mass per area (kg/m²), for 100 to 600 kg/m²; outside it, null. Against NBR 15575-3's levels for a
 * floor between dwellings (L'nT,w: superior ≤ 55, intermediate ≤ 65, minimum ≤ 80 dB).
 */
export function impactOf(layers: readonly { readonly materialId: string; readonly thickness: number }[], materials: readonly Material[]): { mass: number | null; lnw: number | null; level: 'superior' | 'intermediate' | 'minimum' | 'fails' | null; missing: string[] } {
  const ls = layers.map((l) => ({ ...l, physics: physicsOf(materialIn(materials, l.materialId)) }));
  const missing = [...new Set(ls.filter((l) => !l.physics).map((l) => l.materialId))];
  if (missing.length > 0) return { mass: null, lnw: null, level: null, missing };
  const mass = ls.reduce((t, l) => t + l.thickness * l.physics!.density, 0);
  if (mass < 100 || mass > 600) return { mass, lnw: null, level: null, missing };
  const lnw = 164 - 35 * Math.log10(mass);
  const level = lnw <= 55 ? 'superior' : lnw <= 65 ? 'intermediate' : lnw <= 80 ? 'minimum' : 'fails';
  return { mass, lnw, level, missing };
}

export function acousticOf(type: WallType, materials: readonly Material[]): Acoustic {
  const layers = layersOf(type, materials);
  const missing = [...new Set(layers.filter((l) => !l.physics).map((l) => l.materialId))];
  if (missing.length > 0) return { typeId: type.id, mass: null, rw: null, r500: null, missing };
  const mass = layers.reduce((t, l) => t + l.thickness * l.physics!.density, 0);
  return { typeId: type.id, mass, rw: mass >= 150 ? 37.5 * Math.log10(mass) - 42 : null, r500: 20 * Math.log10(mass * 500) - 47, missing };
}
