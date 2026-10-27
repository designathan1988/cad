// Norm rules as data (docs/plano-de-escopo.md, "Como as regras entram no sistema"): each one a quantity
// the model has, its bounds, and where they come from. The values are the project's to change (a
// municipality's code, an office's standard), and each check cites its source; the app never quotes a
// norm's text, only its number and reference. Pure.

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
  | 'doorWidth';

export const RULE_SUBJECTS: readonly RuleSubject[] = ['stairRiser', 'stairTread', 'stairBlondel', 'stairFlightRise', 'stairWidth', 'rampGrade', 'railingHeight', 'railingGap', 'doorWidth'];

/** How a subject's value is shown: metres as lengths, or a percentage. */
export const SUBJECT_UNIT: Readonly<Record<RuleSubject, 'm' | '%'>> = {
  stairRiser: 'm',
  stairTread: 'm',
  stairBlondel: 'm',
  stairFlightRise: 'm',
  stairWidth: 'm',
  rampGrade: '%',
  railingHeight: 'm',
  railingGap: 'm',
  doorWidth: 'm',
};

export interface Rule {
  readonly id: string;
  readonly subject: RuleSubject;
  readonly min?: number;
  readonly max?: number;
  /** Where the bounds come from: the norm or law, and its item when known. */
  readonly source: string;
  readonly on: boolean;
}

/**
 * The rules a new project checks: NBR 9050 for stairs, ramps and doors, NBR 14718 for guardrails. The
 * items are to be confirmed against the edition in force (the plan says so of every number); a stair's
 * width on an accessible route is off at first, as a house's inner stair need not be one.
 */
export const DEFAULT_RULES: readonly Rule[] = [
  { id: 'rule_riser', subject: 'stairRiser', min: 0.16, max: 0.18, source: 'NBR 9050', on: true },
  { id: 'rule_tread', subject: 'stairTread', min: 0.28, max: 0.32, source: 'NBR 9050', on: true },
  { id: 'rule_blondel', subject: 'stairBlondel', min: 0.63, max: 0.65, source: 'NBR 9050', on: true },
  { id: 'rule_flight', subject: 'stairFlightRise', max: 3.2, source: 'NBR 9050', on: true },
  { id: 'rule_stairWidth', subject: 'stairWidth', min: 1.2, source: 'NBR 9050', on: false },
  { id: 'rule_ramp', subject: 'rampGrade', max: 8.33, source: 'NBR 9050', on: true },
  { id: 'rule_railing', subject: 'railingHeight', min: 1.1, source: 'NBR 14718', on: true },
  { id: 'rule_railingGap', subject: 'railingGap', max: 0.11, source: 'NBR 14718', on: true },
  { id: 'rule_door', subject: 'doorWidth', min: 0.8, source: 'NBR 9050', on: true },
];

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
    typeof x.on === 'boolean'
  );
};

/** The project's rules: its own, else the defaults. */
export const rulesOf = (doc: { readonly rules?: readonly Rule[] }): readonly Rule[] => doc.rules ?? DEFAULT_RULES;
