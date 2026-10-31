// The limits an object's parameters are held to (lengths, the size parameters a handle stretches) and a
// light's colour from its temperature.

import type { ObjectDefinition, ParamDef } from './schema';

/** The least and greatest length any object takes (m): a millimetre, a building's length. */
export const LENGTH_LIMITS = { min: 0.001, max: 500 } as const;

/** The names an object's overall size goes by: its width, depth, length and height. */
export const SIZE_NAMES = new Set(['largura', 'profundidade', 'comprimento', 'altura']);

/**
 * The lengths that are the object's own size, not one of its parts': its width, depth, length and height,
 * and any length a handle drags. Below its least the object would fold up (a house bed lower than its
 * posts, a cabinet narrower than its doors), so that least is a floor for these, not a suggestion.
 */
export function sizeParams(def: ObjectDefinition): ReadonlySet<string> {
  const dragged = new Set(def.handles.map((h) => h.param));
  return new Set(def.params.filter((p) => p.kind === 'length' && p.formula === undefined && p.min !== undefined && (SIZE_NAMES.has(p.name) || dragged.has(p.name))).map((p) => p.name));
}

/**
 * A value as the object takes it, on its step; whole for an integer, 0 or 1 for a yes/no. A length's or a
 * number's range is its usual one, not a lock above (a sofa of 5 m is the user's to make): it is held only
 * to what makes sense (a length from 1 mm to 500 m, and never below its least when it is the object's own
 * size, given its definition; a number not below 0 when its range starts there), and one outside its range
 * is said (outsideRange). A count (integer, choice) keeps its range: formulas rely on it.
 */
export function held(p: ParamDef, v: number, def?: ObjectDefinition): number {
  let x = v;
  if (p.kind === 'bool') return x !== 0 ? 1 : 0;
  if (p.kind === 'length') {
    x = Math.min(LENGTH_LIMITS.max, Math.max(LENGTH_LIMITS.min, x));
    if (def && p.min !== undefined && sizeParams(def).has(p.name)) x = Math.max(p.min, x);
  }
  else if (p.kind === 'number') x = p.min !== undefined && p.min >= 0 ? Math.max(0, x) : x;
  else {
    if (p.min !== undefined) x = Math.max(p.min, x);
    if (p.max !== undefined) x = Math.min(p.max, x);
  }
  if (p.step !== undefined && p.step > 0) x = Math.round(x / p.step) * p.step;
  if (p.kind === 'integer' || p.kind === 'choice') x = Math.round(x);
  return x;
}

/** A light's colour from its temperature (K), as a #rrggbb (Tanner Helland's fit, 1000 K to 12000 K). */
export function kelvinColour(k: number): string {
  const t = Math.min(12000, Math.max(1000, k)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const hex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
