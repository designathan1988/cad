// Costs (docs/plano-de-escopo.md, phase 12, "Custos"): the quick estimate by the CUB, the budget by
// quantities priced from a base (SINAPI's, imported each month by state) with the office's own prices
// over it, the BDI, other costs, and the stages of the physical-financial schedule. Data kept in the
// project; budget.ts computes from it and the model. Pure.

/** The CUB of a month: its standard project (NBR 12721), its value per m², where it comes from. */
export interface CubSettings {
  readonly standard: string;
  /** R$/m². */
  readonly value: number;
  readonly state: string;
  /** "2026-08". */
  readonly month: string;
  readonly desonerado: boolean;
  readonly source: string;
  /** The built area's equivalence factor (NBR 12721; 1 when all of it is of the standard's kind). */
  readonly equivalence: number;
}

/**
 * The CUB the app starts with: Sinduscon-SP, August 2026, R1-N (one-family house, normal standard), not
 * relieved of payroll tax, R$ 2.686,65/m² (published 3 September 2026). To be updated each month.
 */
export const DEFAULT_CUB: CubSettings = {
  standard: 'R1-N',
  value: 2686.65,
  state: 'SP',
  month: '2026-08',
  desonerado: false,
  source: 'Sinduscon-SP, CUB/m² agosto de 2026 (NBR 12721)',
  equivalence: 1,
};

/** A priced item: a composition's or an input's code, what it is, its unit and price (R$). */
export interface PriceItem {
  readonly code: string;
  readonly description: string;
  readonly unit: string;
  readonly price: number;
}

/** A base of prices: SINAPI's of a state and month (or another), its items. */
export interface PriceBase {
  readonly name: string;
  readonly state: string;
  readonly month: string;
  readonly desonerado: boolean;
  readonly items: readonly PriceItem[];
}

/** What a line's quantity is measured on (budget.ts quantityOf): the model, or a number typed. */
export type QuantityOf =
  | 'masonry'
  | 'mortar'
  | 'faceExterior'
  | 'faceInterior'
  | 'layer'
  | 'floor'
  | 'roomWall'
  | 'ceiling'
  | 'doors'
  | 'windows'
  | 'built'
  | 'fixed';

export const QUANTITY_OFS: readonly QuantityOf[] = ['masonry', 'mortar', 'faceExterior', 'faceInterior', 'layer', 'floor', 'roomWall', 'ceiling', 'doors', 'windows', 'built', 'fixed'];

export type Measure = 'area' | 'volume' | 'pieces' | 'count';

export interface QuantityRef {
  readonly of: QuantityOf;
  /** Only the layers or finishes of this material. */
  readonly material?: string;
  readonly measure: Measure;
  /** A fixed line's quantity. */
  readonly value?: number;
}

/** A line of the budget: what it is, its quantity from the model, its price, its stage. */
export interface BudgetLine {
  readonly id: string;
  /** Its composition's code in the base (empty: priced by its own price only). */
  readonly code: string;
  readonly description: string;
  readonly unit: string;
  readonly quantity: QuantityRef;
  /** Its own unit price (R$), over the base's. */
  readonly price?: number;
  readonly stage: string;
}

/** A stage of the work: the months it runs (from 1). */
export interface Stage {
  readonly id: string;
  readonly name: string;
  readonly start: number;
  readonly months: number;
}

/** A cost outside the lines (licences, transport, insurance, fees), a sum of its own. */
export interface ExtraCost {
  readonly id: string;
  readonly name: string;
  readonly value: number;
}

export interface Costs {
  readonly cub: CubSettings;
  readonly base?: PriceBase;
  /** The office's own prices, by code, over the base's. */
  readonly own: readonly PriceItem[];
  readonly lines: readonly BudgetLine[];
  /** Benefits and indirect costs, % over the direct cost. */
  readonly bdi: number;
  readonly extras: readonly ExtraCost[];
  readonly stages: readonly Stage[];
}

export const DEFAULT_STAGES: readonly Stage[] = [
  { id: 'stage_masonry', name: 'Alvenaria', start: 1, months: 2 },
  { id: 'stage_frames', name: 'Esquadrias', start: 3, months: 1 },
  { id: 'stage_finishes', name: 'Revestimentos', start: 3, months: 2 },
  { id: 'stage_floors', name: 'Pisos e forros', start: 4, months: 1 },
  { id: 'stage_general', name: 'Geral', start: 1, months: 4 },
];

export const DEFAULT_COSTS: Costs = { cub: DEFAULT_CUB, own: [], lines: [], bdi: 25, extras: [], stages: DEFAULT_STAGES };

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const text = (v: unknown): v is string => typeof v === 'string';

export const isPriceItem = (i: unknown): i is PriceItem => isObj(i) && text(i.code) && text(i.description) && text(i.unit) && finite(i.price) && i.price >= 0;

const isCub = (c: unknown): c is CubSettings =>
  isObj(c) && text(c.standard) && finite(c.value) && c.value >= 0 && text(c.state) && text(c.month) && typeof c.desonerado === 'boolean' && text(c.source) && finite(c.equivalence) && c.equivalence > 0;

const isBase = (b: unknown): b is PriceBase => isObj(b) && text(b.name) && text(b.state) && text(b.month) && typeof b.desonerado === 'boolean' && Array.isArray(b.items) && b.items.every(isPriceItem);

const isRef = (q: unknown): boolean =>
  isObj(q) && QUANTITY_OFS.includes(q.of as QuantityOf) && ['area', 'volume', 'pieces', 'count'].includes(q.measure as string) && (q.material === undefined || text(q.material)) && (q.value === undefined || finite(q.value));

const isLine = (l: unknown): l is BudgetLine =>
  isObj(l) && text(l.id) && text(l.code) && text(l.description) && text(l.unit) && isRef(l.quantity) && (l.price === undefined || (finite(l.price) && l.price >= 0)) && text(l.stage);

const isStage = (s: unknown): s is Stage => isObj(s) && text(s.id) && text(s.name) && Number.isInteger(s.start) && (s.start as number) >= 1 && Number.isInteger(s.months) && (s.months as number) >= 1;

const isExtra = (e: unknown): e is ExtraCost => isObj(e) && text(e.id) && text(e.name) && finite(e.value);

export const isCosts = (c: unknown): c is Costs =>
  isObj(c) &&
  isCub(c.cub) &&
  (c.base === undefined || isBase(c.base)) &&
  Array.isArray(c.own) &&
  c.own.every(isPriceItem) &&
  Array.isArray(c.lines) &&
  c.lines.every(isLine) &&
  finite(c.bdi) &&
  c.bdi >= 0 &&
  Array.isArray(c.extras) &&
  c.extras.every(isExtra) &&
  Array.isArray(c.stages) &&
  c.stages.every(isStage);

export const costsOf = (doc: { readonly costs?: Costs }): Costs => doc.costs ?? DEFAULT_COSTS;
