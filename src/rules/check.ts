// The model checked against its rules (schema.ts), from the derived geometry: what each stair, ramp,
// guardrail, door and room measures, and the lot's measures (app/lot-areas.ts), and the rules each is
// outside. Live, once per geometry. A report says, rule by rule, whether it holds, fails, has no bound
// yet, or is off: the compliance report (docs/plano-de-escopo.md, "relatório de conformidade"). Pure.

import type { Doc } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { lotOf } from '../app/lot';
import { lotReport, type LotReport } from '../app/lot-areas';
import { roomsBeside } from '../app/quantities';
import { dot, normalize, perp, type Point2, sub } from '../core/vector';
import type { RailingSolid } from '../elements/kinds/railing';
import type { StairSolid } from '../elements/stair/geometry';
import { railingGap } from '../elements/railing/schema';
import type { RoomUse } from '../elements/room/schema';
import { boundsOf, type Rule, type RuleSubject } from './schema';

/** The lot's findings have no element: this id. */
export const LOT_ELEMENT = '';

export interface Finding {
  readonly rule: Rule;
  readonly elementId: string;
  /** What it measures (m, m², or % for a grade or a share). */
  readonly value: number;
  /** The bounds it was held to: the rule's, or the lot's for a lot rule. */
  readonly min?: number;
  readonly max?: number;
}

interface Measure {
  readonly id: string;
  readonly subject: RuleSubject;
  readonly value: number;
  /** A room's use, for the rules that hold for some uses only. */
  readonly use?: RoomUse;
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

/** A ring's least width: across each of its sides' directions, the narrowest its extent is (its hull's). */
export function leastWidth(ring: readonly Point2[]): number {
  let least = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (a.x === b.x && a.y === b.y) continue;
    const n = perp(normalize(sub(b, a)));
    const across = ring.map((p) => dot(sub(p, a), n));
    least = Math.min(least, Math.max(...across) - Math.min(...across));
  }
  return least === Infinity ? 0 : least;
}

/** Each element's measures, by subject; with the document, the rooms' and the lot's too. */
function measures(g: DerivedGeometry, doc?: Doc, lot?: LotReport): Measure[] {
  const out: Measure[] = [];
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
  for (const r of (g.kinds.get('railings')?.values() ?? []) as Iterable<RailingSolid>) {
    out.push({ id: r.railing.id, subject: 'railingHeight', value: r.railing.height });
    out.push({ id: r.railing.id, subject: 'railingGap', value: railingGap(r.railing) });
  }
  for (const o of g.openings.values()) if (o.opening.kind === 'door') out.push({ id: o.opening.id, subject: 'doorWidth', value: o.opening.width });
  if (!doc) return out;
  // The rooms: its height (its own, else its level's), area, least width, and its windows over its floor.
  const glazing = new Map<string, number>();
  for (const o of doc.openings) {
    const wall = doc.walls.find((w) => w.id === o.wallId);
    if (o.kind !== 'window' || !wall || !g.openings.get(o.id)?.valid) continue;
    for (const r of new Set(roomsBeside(g, o.id, wall.levelId).flatMap((x) => (x ? [x.id] : [])))) glazing.set(r, (glazing.get(r) ?? 0) + o.width * o.height);
  }
  for (const s of g.rooms.values()) {
    if (!s.enclosed) continue;
    const r = s.room;
    // A room with no use given is checked as "other".
    const use: RoomUse = r.use ?? 'other';
    const height = r.height ?? doc.levels.find((l) => l.id === r.levelId)?.height ?? 0;
    const m = (subject: RuleSubject, value: number) => out.push({ id: r.id, subject, value, use });
    m('ceilingHeight', height);
    m('roomArea', s.area);
    m('roomWidth', leastWidth(s.outline));
    if (s.area > 0) m('windowRatio', ((glazing.get(r.id) ?? 0) / s.area) * 100);
  }
  // The lot: only what can be measured (no area, no shares; no outline, no setbacks).
  if (lot) {
    const add = (subject: RuleSubject, value: number | null) => value !== null && out.push({ id: LOT_ELEMENT, subject, value });
    if (lot.levels.length > 0) {
      add('lotOccupancy', lot.occupancy);
      add('lotFloorRatio', lot.floorRatio);
      add('lotPermeability', lot.permeability);
      add('setbackFront', lot.setbacks.front);
      add('setbackSide', lot.setbacks.side);
      add('setbackBack', lot.setbacks.back);
      add('buildingHeight', lot.height);
    }
  }
  return out;
}

/** A lot rule's bounds from the lot's parameters. */
export function lotBounds(doc: Doc): (subject: RuleSubject) => { min?: number; max?: number } {
  const lot = lotOf(doc);
  const b = (min?: number, max?: number) => ({ ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) });
  return (subject) => {
    switch (subject) {
      case 'lotOccupancy':
        return b(undefined, lot.maxOccupancy);
      case 'lotFloorRatio':
        return b(undefined, lot.maxFloorRatio);
      case 'lotPermeability':
        return b(lot.minPermeability);
      case 'setbackFront':
        return b(lot.front);
      case 'setbackSide':
        return b(lot.side);
      case 'setbackBack':
        return b(lot.back);
      case 'buildingHeight':
        return b(undefined, lot.maxHeight);
      default:
        return {};
    }
  };
}

const holdsFor = (rule: Rule, m: Measure) => rule.subject === m.subject && (!rule.uses || rule.uses.length === 0 || (m.use !== undefined && rule.uses.includes(m.use)));

/**
 * The measures outside the rules that are on: a hair (0.1 mm, 0.01 %) of rounding allowed. With the
 * document, the rooms and the lot are checked too.
 */
export function checkRules(g: DerivedGeometry, rules: readonly Rule[], doc?: Doc): Finding[] {
  const on = rules.filter((r) => r.on);
  if (on.length === 0) return [];
  const eps = 1e-4;
  const lot = doc ? lotReport(doc, g) : undefined;
  const lotBound = doc ? lotBounds(doc) : () => ({});
  const out: Finding[] = [];
  for (const m of measures(g, doc, lot))
    for (const rule of on) {
      if (!holdsFor(rule, m)) continue;
      const { min, max } = boundsOf(rule, lotBound);
      if ((min !== undefined && m.value < min - eps) || (max !== undefined && m.value > max + eps))
        out.push({ rule, elementId: m.id, value: m.value, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) });
    }
  return out;
}

/** How a rule stands in the report. */
export type RuleStatus = 'ok' | 'fails' | 'unset' | 'off' | 'nothing';

export interface RuleReport {
  readonly rule: Rule;
  readonly status: RuleStatus;
  /** How many of the model's elements it was checked on, and those outside it. */
  readonly checked: number;
  readonly findings: readonly Finding[];
  readonly min?: number;
  readonly max?: number;
}

/**
 * Rule by rule: off; on with no bound yet (to be filled in from the norm); nothing in the model it
 * holds for; it holds; or the elements outside it.
 */
export function complianceReport(g: DerivedGeometry, rules: readonly Rule[], doc: Doc): RuleReport[] {
  const lot = lotReport(doc, g);
  const all = measures(g, doc, lot);
  const findings = checkRules(g, rules, doc);
  const lotBound = lotBounds(doc);
  return rules.map((rule): RuleReport => {
    const { min, max } = boundsOf(rule, lotBound);
    const bounds = { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
    const checked = all.filter((m) => holdsFor(rule, m)).length;
    if (!rule.on) return { rule, status: 'off', checked, findings: [], ...bounds };
    if (min === undefined && max === undefined) return { rule, status: 'unset', checked, findings: [], ...bounds };
    if (checked === 0) return { rule, status: 'nothing', checked, findings: [], ...bounds };
    const mine = findings.filter((f) => f.rule === rule);
    return { rule, status: mine.length > 0 ? 'fails' : 'ok', checked, findings: mine, ...bounds };
  });
}
