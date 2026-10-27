// The project's units (docs/plano-de-escopo.md, phases 2 and 9): lengths shown and typed in metres,
// centimetres, millimetres or feet and inches (12' 6"), with the decimals chosen; angles' decimals;
// slopes in percent, degrees or as a ratio (1:n). Inside, everything stays in metres and slopes in
// percent; only what is written and read changes. Areas in m² and volumes in m³, as Brazilian drawings
// write them; in ft² and ft³ in a project in feet.

import { setBareUnit } from '../core/measure';
import { getLang, num } from './i18n';

export type LengthUnit = 'm' | 'cm' | 'mm' | 'ft';
export const LENGTH_UNITS: readonly LengthUnit[] = ['m', 'cm', 'mm', 'ft'];

/** How a slope is written: 30 %, 16,7°, or 1:3,3 (one up for n along). */
export type SlopeFormat = 'percent' | 'degrees' | 'ratio';
export const SLOPE_FORMATS: readonly SlopeFormat[] = ['percent', 'degrees', 'ratio'];

export interface Units {
  readonly length: LengthUnit;
  /** Decimals of a length as shown, in its unit (of the inches, in feet and inches). */
  readonly decimals: number;
  /** Decimals of an angle as shown (1 when not set). */
  readonly angleDecimals?: number;
  /** How slopes are shown and typed (percent when not set). */
  readonly slope?: SlopeFormat;
}

export const DEFAULT_UNITS: Units = { length: 'm', decimals: 2 };

/** The decimals a unit is usually written with: metres to the centimetre, the others whole or to the millimetre; whole inches. */
export const USUAL_DECIMALS: Readonly<Record<LengthUnit, number>> = { m: 2, cm: 0, mm: 0, ft: 0 };
export const MAX_DECIMALS = 4;
export const MAX_ANGLE_DECIMALS = 3;

const SCALE: Readonly<Record<LengthUnit, number>> = { m: 1, cm: 0.01, mm: 0.001, ft: 0.3048 };
const INCH = 0.0254;
/** Square and cubic feet in a square and a cubic metre. */
const FT2 = 1 / (0.3048 * 0.3048);
const FT3 = FT2 / 0.3048;

export const isUnits = (u: unknown): u is Units => {
  const x = u as Partial<Units> | null;
  return (
    !!x &&
    typeof x === 'object' &&
    LENGTH_UNITS.includes(x.length as LengthUnit) &&
    Number.isInteger(x.decimals) &&
    x.decimals! >= 0 &&
    x.decimals! <= MAX_DECIMALS &&
    (x.angleDecimals === undefined || (Number.isInteger(x.angleDecimals) && x.angleDecimals >= 0 && x.angleDecimals <= MAX_ANGLE_DECIMALS)) &&
    (x.slope === undefined || SLOPE_FORMATS.includes(x.slope))
  );
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

/** Feet and inches: 12' 6", the inches to `decimals` places; a whole number of feet as 12' 0". */
export function feetInches(metres: number, decimals: number): string {
  const sign = metres < 0 ? '-' : '';
  const step = 10 ** decimals;
  let inches = Math.round((Math.abs(metres) / INCH) * step) / step;
  let feet = Math.floor(inches / 12 + 1e-9);
  inches = Math.round((inches - feet * 12) * step) / step;
  if (inches >= 12) {
    feet += 1;
    inches -= 12;
  }
  return `${sign}${feet}' ${num(inches, decimals)}"`;
}

/** A length (metres inside) as a number in the project's unit, without the unit: a dimension's text. */
export const lengthNum = (metres: number, metreDigits?: number): string =>
  current.length === 'ft' ? feetInches(metres, current.decimals) : num(metres / SCALE[current.length], decimalsFor(metreDigits));

/** A length with its unit: "3,45 m", "345 cm", "3450 mm", "12' 6\"" (feet and inches carry their own marks). */
export const lengthText = (metres: number, metreDigits?: number): string => (current.length === 'ft' ? lengthNum(metres) : `${lengthNum(metres, metreDigits)} ${current.length}`);

/** An area: m², or ft² in a project in feet. */
export const areaText = (m2: number): string => (current.length === 'ft' ? `${num(m2 * FT2, 2)} ft²` : `${num(m2, 2)} m²`);

/** A volume: m³, or ft³ in a project in feet. */
export const volumeText = (m3: number): string => (current.length === 'ft' ? `${num(m3 * FT3, 2)} ft³` : `${num(m3, 2)} m³`);

/** An angle in degrees, to the project's decimals (without the °). */
export const angleNum = (deg: number): string => num(deg, current.angleDecimals ?? 1);

/** How slopes are written in the project. */
export const slopeFormat = (): SlopeFormat => current.slope ?? 'percent';

/** A slope's unit after its value: %, ° or the "1:" before it. */
export const slopeUnit = (): string => (slopeFormat() === 'degrees' ? '°' : slopeFormat() === 'ratio' ? '1:' : '%');

/** A slope (percent inside) as the project writes it: 30 %, 16,7°, or n of 1:n (0 for level). */
export function slopeShown(percent: number): number {
  const f = slopeFormat();
  if (f === 'degrees') return (Math.atan(percent / 100) * 180) / Math.PI;
  if (f === 'ratio') return percent > 0 ? 100 / percent : 0;
  return percent;
}

/** A slope typed as the project writes it, back in percent. */
export function slopeTyped(v: number): number {
  const f = slopeFormat();
  if (f === 'degrees') return Math.tan((Math.min(89.9, Math.max(0, v)) * Math.PI) / 180) * 100;
  if (f === 'ratio') return v > 0 ? 100 / v : 0;
  return v;
}

/** A length field's value (metres) in the unit it is shown in, and back. */
export const toUnit = (metres: number): number => metres / SCALE[current.length];

/** Metres in one of the project's length unit. */
export const unitScale = (): number => SCALE[current.length];

/** A length as one types it in the project's unit: no trailing zeros ("4,5", "450", "4500", "14'9\""). */
const typed = (metres: number): string =>
  current.length === 'ft'
    ? feetInches(metres, 0).replace(' ', '')
    : (metres / SCALE[current.length]).toLocaleString(getLang() === 'pt' ? 'pt-BR' : 'en-US', { maximumFractionDigits: 3, useGrouping: false });

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
