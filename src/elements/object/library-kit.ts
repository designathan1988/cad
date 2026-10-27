// What the library's families are written with (library-*.ts): parameters by kind, in their groups, and
// the handles of an object centred on its origin. Lengths in metres; x along the width and y along the
// depth from the centre, z up from the floor; the front faces −y.

import type { HandleDef, ParamDef, Words } from './schema';

type Group = readonly [string, string];

export const DIMENSIONS: Group = ['Dimensões', 'Dimensions'];
export const BUILD: Group = ['Construção', 'Construction'];
export const MATERIALS: Group = ['Materiais', 'Materials'];
export const LIGHT: Group = ['Luz', 'Light'];

const group = (g: Group): Words => ({ pt: g[0], en: g[1] });

/** A length: its usual range, on 5 mm steps. */
export const len = (name: string, pt: string, en: string, value: number, min: number, max: number, g: Group = DIMENSIONS): ParamDef => ({
  name,
  label: { pt, en },
  kind: 'length',
  default: value,
  min,
  max,
  step: 0.005,
  group: group(g),
});

/** A number (an angle, a count of degrees, inches): its usual range and step. */
export const num = (name: string, pt: string, en: string, value: number, min: number, max: number, step: number, g: Group = BUILD): ParamDef => ({
  name,
  label: { pt, en },
  kind: 'number',
  default: value,
  min,
  max,
  step,
  group: group(g),
});

/** A whole number chosen (drawers, shelves, leaves). */
export const int = (name: string, pt: string, en: string, value: number, min: number, max: number, g: Group = BUILD): ParamDef => ({ name, label: { pt, en }, kind: 'integer', default: value, min, max, group: group(g) });

/** A whole number calculated from the others (seats from the width), shown and not edited. */
export const counted = (name: string, pt: string, en: string, formula: string, g: Group = BUILD): ParamDef => ({ name, label: { pt, en }, kind: 'integer', default: 1, formula, group: group(g) });

/** A length calculated from the others, shown and not edited. */
export const derived = (name: string, pt: string, en: string, formula: string, g: Group = DIMENSIONS): ParamDef => ({ name, label: { pt, en }, kind: 'length', default: 0, formula, group: group(g) });

/** Yes or no. */
export const yes = (name: string, pt: string, en: string, value: 0 | 1, g: Group = BUILD): ParamDef => ({ name, label: { pt, en }, kind: 'bool', default: value, group: group(g) });

/** One of a list (its value the index). */
export const choice = (name: string, pt: string, en: string, options: readonly (readonly [string, string])[], value = 0, g: Group = BUILD): ParamDef => ({
  name,
  label: { pt, en },
  kind: 'choice',
  default: value,
  options: options.map(([p, e]) => ({ pt: p, en: e })),
  group: group(g),
});

/** A material, by a material's id. */
export const mat = (name: string, pt: string, en: string, value: string): ParamDef => ({ name, label: { pt, en }, kind: 'material', default: value, group: group(MATERIALS) });

/** The handles of an object centred on its origin: both sides in width, the front in depth, the height at its top. */
export const boxHandles = (top: string, front = '-profundidade/2'): HandleDef[] => [
  { param: 'largura', axis: 'x', at: ['largura/2', 0, top], shift: 0.5 },
  { param: 'largura', axis: 'x', at: ['-largura/2', 0, top], shift: 0.5, sign: -1 },
  { param: 'profundidade', axis: 'y', at: [0, front, top], shift: 0.5, sign: -1 },
  { param: 'altura', axis: 'z', at: [0, 0, top] },
];

/** Words in both languages. */
export const w = (pt: string, en: string): Words => ({ pt, en });
