// The budget computed (schema.ts): each line's quantity measured on the model (app/quantities.ts: the
// wall layers, the rooms' finishes; the doors and windows; the built area), its unit price (the
// office's own over the line's over the base's), its total; the direct cost, the BDI, the other costs
// and the whole; the ABC curve; the physical-financial schedule by stage and month; the CUB estimate.
// Live: the model changed, the budget follows. Pure.

import { newId } from '../core/id';
import type { Doc } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { lotReport } from '../app/lot-areas';
import { finishQuantities, layerQuantities } from '../app/quantities';
import { type BudgetLine, type Costs, costsOf, type Measure, type PriceItem, type QuantityRef, type Stage } from './schema';

interface Measured {
  readonly layers: ReturnType<typeof layerQuantities>;
  readonly finishes: ReturnType<typeof finishQuantities>;
  readonly built: number;
}

const measured = (doc: Doc, g: DerivedGeometry): Measured => ({ layers: layerQuantities(doc, g), finishes: finishQuantities(doc, g), built: lotReport(doc, g).built });

/** A line's quantity on the model (its unit: m² for area, m³ for volume, pieces, a count). */
function quantity(doc: Doc, m: Measured, ref: QuantityRef): number {
  const mine = (id: string) => ref.material === undefined || ref.material === id;
  const sum = <T>(list: readonly T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);
  const of = (measure: Measure, x: { area: number; volume?: number; pieces: number | null }) =>
    measure === 'volume' ? (x.volume ?? 0) : measure === 'pieces' || measure === 'count' ? (x.pieces ?? 0) : x.area;
  switch (ref.of) {
    case 'fixed':
      return ref.value ?? 0;
    case 'built':
      return m.built;
    case 'masonry':
      return sum(
        m.layers.filter((l) => l.mortar !== null && mine(l.materialId)),
        (l) => of(ref.measure, l),
      );
    case 'mortar':
      return sum(
        m.layers.filter((l) => l.mortar !== null && mine(l.materialId)),
        (l) => l.mortar ?? 0,
      );
    case 'faceExterior':
    case 'faceInterior': {
      const place = ref.of === 'faceExterior' ? 'exterior' : 'interior';
      return sum(
        m.layers.filter((l) => l.place === place && l.mortar === null && mine(l.materialId)),
        (l) => of(ref.measure, l),
      );
    }
    case 'layer':
      return sum(
        m.layers.filter((l) => l.place === 'inner' && l.mortar === null && mine(l.materialId)),
        (l) => of(ref.measure, l),
      );
    case 'floor':
    case 'ceiling':
    case 'roomWall': {
      const surface = ref.of === 'roomWall' ? 'wall' : ref.of;
      return sum(
        m.finishes.filter((f) => f.surface === surface && mine(f.materialId)),
        (f) => of(ref.measure, f),
      );
    }
    case 'doors':
    case 'windows': {
      const kind = ref.of === 'doors' ? 'door' : 'window';
      const list = doc.openings.filter((o) => o.kind === kind);
      return ref.measure === 'count' ? list.length : sum(list, (o) => o.width * o.height);
    }
  }
}

/** The unit price of a code or a line: the office's own, then the line's, then the base's; null when none. */
export function unitPrice(costs: Costs, line: BudgetLine): { price: number; from: 'own' | 'line' | 'base' } | null {
  const own = line.code ? costs.own.find((i) => i.code === line.code) : undefined;
  if (own) return { price: own.price, from: 'own' };
  if (line.price !== undefined) return { price: line.price, from: 'line' };
  const base = line.code ? costs.base?.items.find((i) => i.code === line.code) : undefined;
  return base ? { price: base.price, from: 'base' } : null;
}

export interface BudgetRow {
  readonly line: BudgetLine;
  readonly quantity: number;
  readonly price: { readonly price: number; readonly from: 'own' | 'line' | 'base' } | null;
  readonly total: number | null;
}

export interface Budget {
  readonly rows: readonly BudgetRow[];
  /** The lines with a price, summed. */
  readonly direct: number;
  readonly bdi: number;
  readonly extras: number;
  readonly total: number;
  /** Lines with no price yet: not in the totals. */
  readonly unpriced: number;
}

export function budgetOf(doc: Doc, g: DerivedGeometry): Budget {
  const costs = costsOf(doc);
  const m = measured(doc, g);
  const rows = costs.lines.map((line): BudgetRow => {
    const q = quantity(doc, m, line.quantity);
    const price = unitPrice(costs, line);
    return { line, quantity: q, price, total: price ? q * price.price : null };
  });
  const direct = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const bdi = (direct * costs.bdi) / 100;
  const extras = costs.extras.reduce((s, e) => s + e.value, 0);
  return { rows, direct, bdi, extras, total: direct + bdi + extras, unpriced: rows.filter((r) => r.total === null).length };
}

export interface AbcRow {
  readonly row: BudgetRow;
  /** Its share of the direct cost and the running share down the list, %. */
  readonly share: number;
  readonly cumulative: number;
  readonly cls: 'A' | 'B' | 'C';
}

/** The ABC curve: the priced lines from the costliest, A up to 80 % of the cost, B up to 95 %, C the rest. */
export function abcOf(b: Budget): AbcRow[] {
  const priced = b.rows.filter((r) => r.total !== null && r.total > 0).sort((x, y) => y.total! - x.total!);
  let run = 0;
  return priced.map((row) => {
    const share = b.direct > 0 ? (row.total! / b.direct) * 100 : 0;
    const before = run;
    run += share;
    // A line is in the class its cost starts in: the first is always A.
    const cls = before < 80 ? 'A' : before < 95 ? 'B' : 'C';
    return { row, share, cumulative: run, cls };
  });
}

export interface ScheduleRow {
  readonly stage: Stage;
  readonly cost: number;
  /** Its cost in each month, the stage's spread evenly over its months. */
  readonly months: readonly number[];
}

/** The physical-financial schedule: each stage's priced lines (with the BDI) spread over its months; the months' totals and running totals. */
export function scheduleOf(doc: Doc, b: Budget): { rows: ScheduleRow[]; months: number[]; cumulative: number[] } {
  const costs = costsOf(doc);
  const factor = 1 + costs.bdi / 100;
  const n = Math.max(1, ...costs.stages.map((s) => s.start + s.months - 1));
  const rows = costs.stages.map((stage) => {
    const cost = b.rows.filter((r) => r.line.stage === stage.id).reduce((s, r) => s + (r.total ?? 0), 0) * factor;
    const months = Array.from({ length: n }, (_, i) => (i + 1 >= stage.start && i + 1 < stage.start + stage.months ? cost / stage.months : 0));
    return { stage, cost, months };
  });
  const months = Array.from({ length: n }, (_, i) => rows.reduce((s, r) => s + r.months[i]!, 0));
  let run = 0;
  const cumulative = months.map((v) => (run += v));
  return { rows, months, cumulative };
}

/** The CUB estimate: the built area, times its equivalence, times the CUB. */
export function cubEstimate(doc: Doc, g: DerivedGeometry): { area: number; value: number; total: number } {
  const { cub } = costsOf(doc);
  const area = lotReport(doc, g).built * cub.equivalence;
  return { area, value: cub.value, total: area * cub.value };
}

/** What the model has to price, as lines with their quantity tied to it: one per item and material, the doors and windows, by stage. */
export function linesFromModel(doc: Doc, g: DerivedGeometry, say: { item: (key: string) => string; material: (id: string) => string }): BudgetLine[] {
  const m = measured(doc, g);
  const out: BudgetLine[] = [];
  const seen = new Set<string>();
  const add = (of: QuantityRef['of'], material: string | undefined, measure: Measure, unit: string, stage: string, label: string) => {
    const key = `${of}/${material ?? ''}/${measure}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id: newId('line'), code: '', description: material ? `${label}: ${say.material(material)}` : label, unit, quantity: { of, measure, ...(material ? { material } : {}) }, stage });
  };
  for (const l of m.layers) {
    if (l.mortar !== null) {
      add('masonry', l.materialId, 'area', 'm²', 'stage_masonry', say.item('qty.masonry'));
      add('mortar', l.materialId, 'volume', 'm³', 'stage_masonry', say.item('qty.mortar'));
    } else if (l.place === 'exterior') add('faceExterior', l.materialId, 'area', 'm²', 'stage_finishes', say.item('qty.faceExterior'));
    else if (l.place === 'interior') add('faceInterior', l.materialId, 'area', 'm²', 'stage_finishes', say.item('qty.faceInterior'));
    else add('layer', l.materialId, 'area', 'm²', 'stage_masonry', say.item('budget.layer'));
  }
  for (const f of m.finishes) add(f.surface === 'wall' ? 'roomWall' : f.surface, f.materialId, 'area', 'm²', f.surface === 'wall' ? 'stage_finishes' : 'stage_floors', say.item(`qty.room.${f.surface}`));
  if (doc.openings.some((o) => o.kind === 'door')) add('doors', undefined, 'count', 'un', 'stage_frames', say.item('budget.doors'));
  if (doc.openings.some((o) => o.kind === 'window')) add('windows', undefined, 'area', 'm²', 'stage_frames', say.item('budget.windows'));
  return out;
}

/** The base's items that match a search: by code, or by every word in the description. */
export function searchBase(items: readonly PriceItem[], query: string, most = 30): PriceItem[] {
  const words = query
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  const out: PriceItem[] = [];
  for (const i of items) {
    const text = `${i.code} ${i.description}`
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase();
    if (words.every((w) => text.includes(w))) out.push(i);
    if (out.length >= most) break;
  }
  return out;
}
