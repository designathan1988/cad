// The project's units (docs/plano-de-escopo.md, phase 2): lengths shown and typed in metres,
// centimetres or millimetres, with the decimals chosen. Inside, everything stays in metres; only what
// is written and read changes. Areas stay in m² and volumes in m³, as Brazilian drawings write them.

import { setBareUnit } from '../core/measure';
import { getLang, num } from './i18n';

export type LengthUnit = 'm' | 'cm' | 'mm';
export const LENGTH_UNITS: readonly LengthUnit[] = ['m', 'cm', 'mm'];

export interface Units {
  readonly length: LengthUnit;
  /** Decimals of a length as shown, in its unit. */
  readonly decimals: number;
}

export const DEFAULT_UNITS: Units = { length: 'm', decimals: 2 };

/** The decimals a unit is usually written with: metres to the centimetre, the others whole or to the millimetre. */
export const USUAL_DECIMALS: Readonly<Record<LengthUnit, number>> = { m: 2, cm: 0, mm: 0 };
export const MAX_DECIMALS = 4;

const SCALE: Readonly<Record<LengthUnit, number>> = { m: 1, cm: 0.01, mm: 0.001 };

export const isUnits = (u: unknown): u is Units => {
  const x = u as Partial<Units> | null;
  return !!x && typeof x === 'object' && LENGTH_UNITS.includes(x.length as LengthUnit) && Number.isInteger(x.decimals) && x.decimals! >= 0 && x.decimals! <= MAX_DECIMALS;
};

let current: Units = DEFAULT_UNITS;

/** The units in use: the open project's, set whenever it changes (app/chrome.ts). */
export function setUnits(u: Units): void {
  if (u === current) return;
  current = u;
  setBareUnit(SCALE[u.length]);
}

export const units = (): Units => current;
export const lengthUnit = (): LengthUnit => current.length;

/**
 * Decimals for a length: the project's, or more when the caller needs a finer step in metres (a layer's
 * thickness to the millimetre: 3 decimals in metres is 1 in centimetres, 0 in millimetres).
 */
function decimalsFor(metreDigits?: number): number {
  const shift = Math.round(-Math.log10(SCALE[current.length]));
  return Math.max(current.decimals, metreDigits === undefined ? 0 : Math.max(0, metreDigits - shift));
}

/** A length (metres inside) as a number in the project's unit, without the unit: a dimension's text. */
export const lengthNum = (metres: number, metreDigits?: number): string => num(metres / SCALE[current.length], decimalsFor(metreDigits));

/** A length with its unit: "3,45 m", "345 cm", "3450 mm". */
export const lengthText = (metres: number, metreDigits?: number): string => `${lengthNum(metres, metreDigits)} ${current.length}`;

/** An area, always in m². */
export const areaText = (m2: number): string => `${num(m2, 2)} m²`;

/** A volume, always in m³. */
export const volumeText = (m3: number): string => `${num(m3, 2)} m³`;

/** A length field's value (metres) in the unit it is shown in, and back. */
export const toUnit = (metres: number): number => metres / SCALE[current.length];

/** Metres in one of the project's length unit. */
export const unitScale = (): number => SCALE[current.length];

/** A length as one types it in the project's unit: no trailing zeros ("4,5", "450", "4500"). */
const typed = (metres: number): string =>
  (metres / SCALE[current.length]).toLocaleString(getLang() === 'pt' ? 'pt-BR' : 'en-US', { maximumFractionDigits: 3, useGrouping: false });

/** The other way to type it, with its unit written: "450cm" in a project in metres, else "4,5m". */
const typedAlt = (metres: number): string =>
  current.length === 'm' ? `${Math.round(metres * 100)}cm` : `${(metres).toLocaleString(getLang() === 'pt' ? 'pt-BR' : 'en-US', { maximumFractionDigits: 3, useGrouping: false })}m`;

/** The examples the measure field and its error messages give, in the project's unit. */
export const typingExamples = (): Record<string, string> => ({
  a: typed(4.5),
  b: typed(3),
  alt: typedAlt(4.5),
  x: typed(2),
  y: typed(3.5),
  d: typed(0.6),
  dalt: typedAlt(0.6),
});
