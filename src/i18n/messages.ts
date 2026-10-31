// Every text on screen, in English and Portuguese. Code and keys are English.

import { BUILT_IN_MATERIALS } from '../elements/material/schema';
import * as ribbon from './messages/ribbon';
import * as hints from './messages/hints';
import * as commands from './messages/commands';
import * as shell from './messages/shell';
import * as panel from './messages/panel';
import * as editor from './messages/editor';
import * as materials from './messages/materials';
import * as elements from './messages/elements';
import * as views from './messages/views';

export type Lang = 'en' | 'pt';

// The texts live by domain in ./messages/; the two tables are their union.
const en = {
  ...ribbon.en,
  ...hints.en,
  ...commands.en,
  ...shell.en,
  ...panel.en,
  ...editor.en,
  ...materials.en,
  ...elements.en,
  ...views.en,
} as const;

export type MessageKey = keyof typeof en;

const pt: Record<MessageKey, string> = {
  ...ribbon.pt,
  ...hints.pt,
  ...commands.pt,
  ...shell.pt,
  ...panel.pt,
  ...editor.pt,
  ...materials.pt,
  ...elements.pt,
  ...views.pt,
};

/** Names of the built-in levels and types, which live in the document in English. */
const ptNames: Readonly<Record<string, string>> = {
  'Ground floor': 'Térreo',
  'Masonry 15 cm': 'Alvenaria 15 cm',
  'Masonry 20 cm': 'Alvenaria 20 cm',
  'Concrete 20 cm': 'Concreto 20 cm',
  'Drywall 10 cm': 'Drywall 10 cm',
  // The other built-in wall types (wall/library-types.ts).
  'Ceramic block 9 cm': 'Bloco cerâmico 9 cm',
  'Ceramic block 14 cm': 'Bloco cerâmico 14 cm',
  'Concrete block 14 cm': 'Bloco de concreto 14 cm',
  'Concrete block 19 cm (structural)': 'Bloco de concreto 19 cm (estrutural)',
  'Exposed brick 11 cm': 'Tijolo aparente 11 cm',
  'Masonry 15 cm, tiled one side': 'Alvenaria 15 cm, azulejada de um lado',
  'Fair-faced concrete 15 cm': 'Concreto aparente 15 cm',
  'Drywall 10 cm, moisture-resistant': 'Drywall 10 cm, resistente à umidade',
  'Drywall 15 cm, acoustic double': 'Drywall 15 cm, acústico duplo',
  'Steel frame 16 cm, external': 'Steel frame 16 cm, externo',
  'Masonry 20 cm, external insulation': 'Alvenaria 20 cm, isolamento externo',
  'Stone 30 cm': 'Pedra 30 cm',
  'Masonry 15 cm, stone cladding': 'Alvenaria 15 cm, revestida de pedra',
  'Drywall 10 cm, wood slats': 'Drywall 10 cm, ripado de madeira',
  'Boundary wall 15 cm': 'Muro de divisa 15 cm',
};


/** The language's one owner: held in an object, written only by setLang. */
const language = { current: 'en' as Lang };

export const getLang = (): Lang => language.current;
export const setLang = (l: Lang): void => {
  language.current = l;
};
/** The page's lang attribute for the language (set by the app, which owns the page). */
export const htmlLang = (l: Lang): string => (l === 'pt' ? 'pt-BR' : 'en');

/** The message in both languages, for finding it by either name (the command palette). */
export const tBoth = (key: MessageKey, vars: Readonly<Record<string, string | number>> = {}): string =>
  [en[key], pt[key]].map((text) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))).join(' ');

/** A message in every language: to recognise a name the app gave in whichever language was on then. */
export const inEveryLanguage = (key: MessageKey): readonly string[] => [en[key], pt[key]];

/** Whether a key is a message (a warning kind read from the engine, say). */
export const hasMessage = (key: string): key is MessageKey => key in en;

export function t(key: MessageKey, vars: Readonly<Record<string, string | number>> = {}): string {
  const text = language.current === 'pt' ? pt[key] : en[key];
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** Default names the app gives, stored in one form so they read in the language of the moment. */
export const defaultName = {
  level: (n: number): string => `Level ${n}`,
  room: (n: number): string => `Room ${n}`,
  wallType: (n: number): string => `Wall type ${n}`,
  /** A copy's name: the original's, numbered, so a built-in name is still translated. */
  copy: (of: string, n: number): string => `${of} (${n})`,
};

/**
 * The number of the next copy of a name among `names`: of the original's name (a copy's " (n)" left off),
 * the first number from 2 no name has. Counting the copies of the one copied, a copy of a copy was
 * named "Brick (2) (2)" and a third copy repeated a number.
 */
export function nextCopy(of: string, names: readonly string[]): { readonly base: string; readonly n: number } {
  const base = of.replace(/ \(\d+\)$/, '');
  const taken = new Set(names);
  let n = 2;
  while (taken.has(defaultName.copy(base, n))) n++;
  return { base, n };
}
const ptPatterns: readonly [RegExp, string][] = [
  [/^Level (\d+)$/, 'Pavimento $1'],
  [/^Room (\d+)$/, 'Cômodo $1'],
  [/^Wall type (\d+)$/, 'Tipo de parede $1'],
];

/** A user-facing name stored in the document: built-in names are translated, the user's are not. */
export const name = (stored: string): string => {
  if (language.current !== 'pt') return stored;
  const known = ptNames[stored];
  if (known) return known;
  const p = ptPatterns.find(([re]) => re.test(stored));
  if (p) return stored.replace(p[0], p[1]);
  const copy = /^(.*) \((\d+)\)$/.exec(stored);
  return copy ? `${name(copy[1]!)} (${copy[2]})` : stored;
};

// The built-in materials' ids, from their list: one list, so a material added there is named here too.
const BUILT_IN_IDS = new Set<string>(BUILT_IN_MATERIALS.map((m) => m.id));

/** A layer's material: a built-in one in the language of the moment, the user's own as typed. */
/** The type marks' prefixes (marks.ts): P and J in Portuguese, D and W in English. */
export const markPrefix = (): { door: string; window: string } => ({ door: t('mark.door'), window: t('mark.window') });

export const materialName = (id: string): string => (BUILT_IN_IDS.has(id) ? t(`mat.${id}` as MessageKey) : id);

/** A material as shown: its own name, or a built-in one's in the interface's language. */
export const materialLabel = (m: { readonly id: string; readonly name: string }): string => m.name || materialName(m.id);

/** Numbers as the language writes them: 4,50 in Portuguese, 4.50 in English. */
export const num = (value: number, digits = 2): string =>
  // A value that rounds to zero is written 0, never -0.
  (Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value).toLocaleString(language.current === 'pt' ? 'pt-BR' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
