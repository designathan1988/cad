// The model checked against its rules (schema.ts), from the derived geometry: what each stair, ramp,
// guardrail and door measures, and the rules it is outside. Live, once per geometry. Pure.

import type { DerivedGeometry } from '../app/geometry';
import type { RailingSolid } from '../elements/kinds/railing';
import type { StairSolid } from '../elements/stair/geometry';
import { type Rule, type RuleSubject } from './schema';

export interface Finding {
  readonly rule: Rule;
  readonly elementId: string;
  /** What it measures (m, or % for a grade). */
  readonly value: number;
}

/** The rise climbed with no landing: the most steps one after another, times the riser. */
export function flightRise(s: StairSolid): number {
  let most = 0;
  let run = 0;
  for (const p of s.parts) {
    run = p.landing ? 0 : run + 1;
    most = Math.max(most, run);
  }
  return most * s.riser;
}

/** Each element's measures, by subject. */
function measures(g: DerivedGeometry): { id: string; subject: RuleSubject; value: number }[] {
  const out: { id: string; subject: RuleSubject; value: number }[] = [];
  for (const s of (g.kinds.get('stairs')?.values() ?? []) as Iterable<StairSolid>) {
    const id = s.stair.id;
    if (s.stair.kind === 'ramp') {
      out.push({ id, subject: 'rampGrade', value: s.stair.grade ?? 8.33 });
      out.push({ id, subject: 'stairWidth', value: s.stair.width });
      continue;
    }
    out.push({ id, subject: 'stairRiser', value: s.riser });
    out.push({ id, subject: 'stairTread', value: s.stair.tread });
    out.push({ id, subject: 'stairBlondel', value: 2 * s.riser + s.stair.tread });
    out.push({ id, subject: 'stairFlightRise', value: flightRise(s) });
    out.push({ id, subject: 'stairWidth', value: s.stair.width });
  }
  for (const r of (g.kinds.get('railings')?.values() ?? []) as Iterable<RailingSolid>) out.push({ id: r.railing.id, subject: 'railingHeight', value: r.railing.height });
  for (const o of g.openings.values()) if (o.opening.kind === 'door') out.push({ id: o.opening.id, subject: 'doorWidth', value: o.opening.width });
  return out;
}

/** The measures outside the rules that are on: a hair (0.1 mm) of rounding allowed. */
export function checkRules(g: DerivedGeometry, rules: readonly Rule[]): Finding[] {
  const on = rules.filter((r) => r.on);
  if (on.length === 0) return [];
  const eps = 1e-4;
  const out: Finding[] = [];
  for (const m of measures(g))
    for (const rule of on) {
      if (rule.subject !== m.subject) continue;
      if ((rule.min !== undefined && m.value < rule.min - eps) || (rule.max !== undefined && m.value > rule.max + eps)) out.push({ rule, elementId: m.id, value: m.value });
    }
  return out;
}
