// Norm rules as data (docs/plano-de-escopo.md, "Como as regras entram no sistema"): each one a quantity
// the model has, its bounds, and where they come from. The values are the project's to change (a
// municipality's code, an office's standard), and each check cites its source; the app never quotes a
// norm's text, only its number and reference. Pure.

import type { RoomUse } from '../elements/room/schema';

/** What a rule measures. */
export type RuleSubject =
  | 'stairRiser'
  | 'stairTread'
  | 'stairBlondel'
  | 'stairFlightRise'
  | 'stairWidth'
  | 'rampGrade'
  | 'railingHeight'
  | 'railingGap'
  | 'doorWidth'
  // A room's: its ceiling height, its area, its least width, its windows' area over its floor's.
  | 'ceilingHeight'
  | 'roomArea'
  | 'roomWidth'
  | 'windowRatio'
  // The lot's (app/lot-areas.ts): occupancy, floor-area ratio, permeable share, setbacks, height.
  | 'lotOccupancy'
  | 'lotFloorRatio'
  | 'lotPermeability'
  | 'setbackFront'
  | 'setbackSide'
  | 'setbackBack'
  | 'buildingHeight';

export const RULE_SUBJECTS: readonly RuleSubject[] = [
  'stairRiser',
  'stairTread',
  'stairBlondel',
  'stairFlightRise',
  'stairWidth',
  'rampGrade',
  'railingHeight',
  'railingGap',
  'doorWidth',
  'ceilingHeight',
  'roomArea',
  'roomWidth',
  'windowRatio',
  'lotOccupancy',
  'lotFloorRatio',
  'lotPermeability',
  'setbackFront',
  'setbackSide',
  'setbackBack',
  'buildingHeight',
];

/** The subjects measured on the lot: their bounds may be the lot's own parameters (Lot, lot.ts). */
export const LOT_SUBJECTS: readonly RuleSubject[] = ['lotOccupancy', 'lotFloorRatio', 'lotPermeability', 'setbackFront', 'setbackSide', 'setbackBack', 'buildingHeight'];

/** The subjects measured on rooms: a rule on them may hold for some uses only. */
export const ROOM_SUBJECTS: readonly RuleSubject[] = ['ceilingHeight', 'roomArea', 'roomWidth', 'windowRatio'];

/** How a subject's value is shown: metres as lengths, square metres, a percentage, or a plain ratio. */
export const SUBJECT_UNIT: Readonly<Record<RuleSubject, 'm' | 'm2' | '%' | 'x'>> = {
  stairRiser: 'm',
  stairTread: 'm',
  stairBlondel: 'm',
  stairFlightRise: 'm',
  stairWidth: 'm',
  rampGrade: '%',
  railingHeight: 'm',
  railingGap: 'm',
  doorWidth: 'm',
  ceilingHeight: 'm',
  roomArea: 'm2',
  roomWidth: 'm',
  windowRatio: '%',
  lotOccupancy: '%',
  lotFloorRatio: 'x',
  lotPermeability: '%',
  setbackFront: 'm',
  setbackSide: 'm',
  setbackBack: 'm',
  buildingHeight: 'm',
};

/** Where a pack of rules holds: the whole country, a state, a city. */
export type Jurisdiction = 'federal' | 'state' | 'city';
export const JURISDICTIONS: readonly Jurisdiction[] = ['federal', 'state', 'city'];

/**
 * A pack of rules (docs/plano-de-escopo.md: "pacotes de regras por jurisdição e por norma, com versão,
 * data de vigência e citação do artigo"): a norm's or a law's, where it holds, its edition and since
 * when. Its rules name it (Rule.pack).
 */
export interface RulePack {
  readonly id: string;
  readonly name: string;
  readonly jurisdiction: Jurisdiction;
  /** Where it holds, for a state's or a city's ("São Paulo/SP"). */
  readonly place?: string;
  /** Its edition, and the date it holds from (YYYY-MM-DD). */
  readonly version?: string;
  readonly since?: string;
}

export type Severity = 'error' | 'warning';

export interface Rule {
  readonly id: string;
  readonly subject: RuleSubject;
  readonly min?: number;
  readonly max?: number;
  /** Where the bounds come from: the norm or law, and its article or item when known. */
  readonly source: string;
  readonly article?: string;
  readonly on: boolean;
  /** Its pack (RulePack.id); none: the project's own. */
  readonly pack?: string;
  /** An error stops an approval; a warning is to look at (the default). */
  readonly severity?: Severity;
  /** For a room rule: the uses it holds for (all when not set). */
  readonly uses?: readonly RoomUse[];
  /** For a lot rule with no bounds of its own: the lot's parameter is the bound (Lot, lot.ts). */
  readonly fromLot?: boolean;
}

/** The packs a new project has. */
export const DEFAULT_PACKS: readonly RulePack[] = [
  { id: 'pack_abnt', name: 'Normas técnicas (ABNT)', jurisdiction: 'federal' },
  { id: 'pack_sp', name: 'São Paulo: Código de Obras e Edificações e LPUOS', jurisdiction: 'city', place: 'São Paulo/SP', version: 'Lei 16.642/2017; Lei 16.402/2016' },
];

/**
 * The rules a new project checks: NBR 9050 for stairs, ramps and doors, NBR 14718 for guardrails,
 * NBR 15575-1 for ceiling heights; São Paulo's lot parameters, their bounds the lot's (taken from the
 * zone's line in the law's table, entered in the lot), and its rule on windows, there to be filled in.
 * The items are to be confirmed against the edition in force (the plan says so of every number); a
 * stair's width on an accessible route is off at first, as a house's inner stair need not be one.
 */
export const DEFAULT_RULES: readonly Rule[] = [
  { id: 'rule_riser', subject: 'stairRiser', min: 0.16, max: 0.18, source: 'NBR 9050', on: true, pack: 'pack_abnt' },
  { id: 'rule_tread', subject: 'stairTread', min: 0.28, max: 0.32, source: 'NBR 9050', on: true, pack: 'pack_abnt' },
  { id: 'rule_blondel', subject: 'stairBlondel', min: 0.63, max: 0.65, source: 'NBR 9050', on: true, pack: 'pack_abnt' },
  { id: 'rule_flight', subject: 'stairFlightRise', max: 3.2, source: 'NBR 9050', on: true, pack: 'pack_abnt' },
  { id: 'rule_stairWidth', subject: 'stairWidth', min: 1.2, source: 'NBR 9050', on: false, pack: 'pack_abnt' },
  { id: 'rule_ramp', subject: 'rampGrade', max: 8.33, source: 'NBR 9050', on: true, pack: 'pack_abnt' },
  { id: 'rule_railing', subject: 'railingHeight', min: 1.1, source: 'NBR 14718', on: true, pack: 'pack_abnt' },
  { id: 'rule_railingGap', subject: 'railingGap', max: 0.11, source: 'NBR 14718', on: true, pack: 'pack_abnt' },
  { id: 'rule_door', subject: 'doorWidth', min: 0.8, source: 'NBR 9050', on: true, pack: 'pack_abnt' },
  {
    id: 'rule_ceiling',
    subject: 'ceilingHeight',
    min: 2.5,
    source: 'NBR 15575-1',
    on: true,
    pack: 'pack_abnt',
    uses: ['living', 'bedroom', 'kitchen', 'office', 'other'],
  },
  { id: 'rule_ceilingLow', subject: 'ceilingHeight', min: 2.3, source: 'NBR 15575-1', on: true, pack: 'pack_abnt', uses: ['bathroom', 'circulation', 'storage', 'service'] },
  { id: 'rule_lotOccupancy', subject: 'lotOccupancy', source: 'Lei 16.402/2016 (LPUOS)', article: 'Quadro 3', on: true, pack: 'pack_sp', fromLot: true, severity: 'error' },
  { id: 'rule_lotFloorRatio', subject: 'lotFloorRatio', source: 'Lei 16.402/2016 (LPUOS)', article: 'Quadro 3', on: true, pack: 'pack_sp', fromLot: true, severity: 'error' },
  { id: 'rule_lotPermeability', subject: 'lotPermeability', source: 'Lei 16.402/2016 (LPUOS)', article: 'Quadro 3', on: true, pack: 'pack_sp', fromLot: true, severity: 'error' },
  { id: 'rule_setbackFront', subject: 'setbackFront', source: 'Lei 16.402/2016 (LPUOS)', article: 'Quadro 3', on: true, pack: 'pack_sp', fromLot: true, severity: 'error' },
  { id: 'rule_setbackSide', subject: 'setbackSide', source: 'Lei 16.402/2016 (LPUOS)', article: 'Quadro 3', on: true, pack: 'pack_sp', fromLot: true, severity: 'error' },
  { id: 'rule_setbackBack', subject: 'setbackBack', source: 'Lei 16.402/2016 (LPUOS)', article: 'Quadro 3', on: true, pack: 'pack_sp', fromLot: true, severity: 'error' },
  { id: 'rule_height', subject: 'buildingHeight', source: 'Lei 16.402/2016 (LPUOS)', article: 'Quadro 3', on: true, pack: 'pack_sp', fromLot: true, severity: 'error' },
  // Its numbers are in the code's annex, not confirmed here: the rule is there, its bound to be filled in.
  { id: 'rule_windows', subject: 'windowRatio', source: 'Lei 16.642/2017 (COE)', article: 'Anexo I, item 5', on: true, pack: 'pack_sp', uses: ['living', 'bedroom', 'office'] },
];

const isText = (v: unknown) => v === undefined || typeof v === 'string';

export const isRule = (r: unknown): r is Rule => {
  if (typeof r !== 'object' || r === null) return false;
  const x = r as Record<string, unknown>;
  const num = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v));
  return (
    typeof x.id === 'string' &&
    RULE_SUBJECTS.includes(x.subject as RuleSubject) &&
    num(x.min) &&
    num(x.max) &&
    typeof x.source === 'string' &&
    typeof x.on === 'boolean' &&
    isText(x.article) &&
    isText(x.pack) &&
    (x.severity === undefined || x.severity === 'error' || x.severity === 'warning') &&
    (x.uses === undefined || (Array.isArray(x.uses) && x.uses.every((u) => typeof u === 'string'))) &&
    (x.fromLot === undefined || typeof x.fromLot === 'boolean')
  );
};

export const isRulePack = (p: unknown): p is RulePack => {
  if (typeof p !== 'object' || p === null) return false;
  const x = p as Record<string, unknown>;
  return typeof x.id === 'string' && x.id !== '' && typeof x.name === 'string' && JURISDICTIONS.includes(x.jurisdiction as Jurisdiction) && isText(x.place) && isText(x.version) && isText(x.since);
};

/** The project's rules: its own, else the defaults. */
export const rulesOf = (doc: { readonly rules?: readonly Rule[] }): readonly Rule[] => doc.rules ?? DEFAULT_RULES;

/** The project's packs: its own, else the defaults. */
export const packsOf = (doc: { readonly rulePacks?: readonly RulePack[] }): readonly RulePack[] => doc.rulePacks ?? DEFAULT_PACKS;

/** A rule's bounds: its own, or for a lot rule from the lot, the lot's. */
export function boundsOf(rule: Rule, lotBound: (subject: RuleSubject) => { min?: number; max?: number }): { min?: number; max?: number } {
  if (!rule.fromLot || rule.min !== undefined || rule.max !== undefined) return { ...(rule.min !== undefined ? { min: rule.min } : {}), ...(rule.max !== undefined ? { max: rule.max } : {}) };
  return lotBound(rule.subject);
}
