// The make of doors and windows (phase 5): how each opens, as data, after IFC's door and window types.
// A catalog of the usual Brazilian models to start from (each a style and a size), the check a file's
// style passes, and the IFC names a model's operation exports as. An opening without a style is the
// plain leaf or pane every file before styles had, drawn exactly as it was.

import { finite, isObject } from '../../core/guards';
import { DOOR_OPERATIONS, type Opening, type OpeningKind, type OpeningStyle, type Operation, WINDOW_OPERATIONS } from './schema';

export interface OpeningModel {
  readonly id: string;
  readonly kind: OpeningKind;
  readonly style: OpeningStyle;
  readonly width: number;
  readonly height: number;
  readonly sill: number;
}

const door = (id: string, operation: Operation, leaves: number, width: number, extra: Partial<OpeningStyle> = {}): OpeningModel => ({
  id,
  kind: 'door',
  style: { operation, leaves, frame: 0.05, casing: 0.05, transom: 0, threshold: false, ...extra },
  width,
  height: 2.1,
  sill: 0,
});
const win = (id: string, operation: Operation, leaves: number, width: number, height: number, sill: number, extra: Partial<OpeningStyle> = {}): OpeningModel => ({
  id,
  kind: 'window',
  style: { operation, leaves, frame: 0.05, casing: 0, transom: 0, threshold: false, ...extra },
  width,
  height,
  sill,
});

/** The models the panel and the tools offer, doors first. */
export const OPENING_MODELS: readonly OpeningModel[] = [
  door('doorSwing', 'swing', 1, 0.8),
  door('doorDouble', 'double', 2, 1.6),
  door('doorSliding', 'sliding', 2, 1.6),
  door('doorPivot', 'pivot', 1, 1.2),
  door('doorFolding', 'folding', 4, 2.4),
  door('doorTransom', 'swing', 1, 0.9, { transom: 0.4 }),
  door('doorBalcony', 'sliding', 2, 2, { threshold: true, frame: 0.04, casing: 0 }),
  door('doorGarage', 'overhead', 1, 2.5, { casing: 0 }),
  door('doorRoller', 'roller', 1, 3, { casing: 0, frame: 0.03 }),
  win('winFixed', 'fixed', 1, 1, 1, 1.1),
  win('winSliding2', 'sliding', 2, 1.2, 1.2, 1),
  win('winSliding4', 'sliding', 4, 2, 1.2, 1),
  win('winCasement', 'casement', 2, 1, 1.2, 1),
  win('winAwning', 'awning', 1, 0.6, 0.6, 1.5),
  win('winHopper', 'hopper', 1, 0.6, 0.4, 1.7),
  win('winPivot', 'pivot', 1, 1, 1, 1.1),
  win('winDoubleHung', 'doubleHung', 1, 0.8, 1.4, 0.9),
];

export const operationsOf = (kind: OpeningKind): readonly Operation[] => (kind === 'door' ? DOOR_OPERATIONS : WINDOW_OPERATIONS);

/** The model a style is, or null for one changed by hand (or none). */
export function modelOf(o: Pick<Opening, 'kind' | 'style'>): OpeningModel | null {
  const s = o.style;
  if (!s) return null;
  return OPENING_MODELS.find((m) => m.kind === o.kind && JSON.stringify(m.style) === JSON.stringify(s)) ?? null;
}

/** The fewest and most leaves an operation takes. */
export function leafRange(op: Operation): readonly [number, number] {
  if (op === 'double') return [2, 2];
  if (op === 'sliding' || op === 'folding') return [op === 'folding' ? 2 : 1, 6];
  if (op === 'fixed' || op === 'casement' || op === 'awning' || op === 'hopper') return [1, 6];
  return [1, 1];
}

/** The window operations whose panes stand side by side and one over another: their mullions and transoms placed at will. */
export const PANED: readonly Operation[] = ['fixed', 'casement', 'awning', 'hopper'];

/** A style kept to what its kind and operation allow: a door's operation on a window becomes its first one. */
export function fitStyle(kind: OpeningKind, s: OpeningStyle): OpeningStyle {
  const operation = operationsOf(kind).includes(s.operation) ? s.operation : operationsOf(kind)[0]!;
  const [lo, hi] = leafRange(operation);
  // A shutter or a grille is a window's; so are mullions and transoms where they are wanted, and only
  // for panes side by side (not sliding or hung ones), as many mullions as panes allow.
  const { screen, mullions, transoms, ...rest } = s;
  const paned = kind === 'window' && PANED.includes(operation);
  const ms = paned && mullions && mullions.length > 0 ? [...mullions].sort((x, y) => x - y).slice(0, hi - 1) : null;
  const ts = paned && transoms && transoms.length > 0 ? [...transoms].sort((x, y) => x - y).slice(0, 5) : null;
  return {
    ...rest,
    ...(kind === 'window' && screen ? { screen } : {}),
    ...(ms ? { mullions: ms } : {}),
    ...(ts ? { transoms: ts } : {}),
    operation,
    leaves: ms ? ms.length + 1 : Math.max(lo, Math.min(hi, Math.round(s.leaves))),
    threshold: kind === 'door' && s.threshold,
  };
}

/**
 * A window's panes across its clear opening (from `a`, `clear` wide), as [from, to] along it: split at
 * its mullions (those inside it, 5 cm clear of the jambs and of each other), or into `leaves` equal ones.
 */
export function paneSpans(s: OpeningStyle, a: number, clear: number): [number, number][] {
  const cuts = splitsIn(s.mullions, clear);
  if (cuts) return [0, ...cuts].map((t, i, all) => [a + t, a + (all[i + 1] ?? clear)]);
  const n = s.leaves;
  return Array.from({ length: n }, (_, i) => [a + (i * clear) / n, a + ((i + 1) * clear) / n]);
}

/** A window's rows of panes from `bottom` to `top`, split at its transoms (each above `bottom`); one without. */
export function paneRows(s: OpeningStyle, bottom: number, top: number): [number, number][] {
  const cuts = splitsIn(s.transoms, top - bottom) ?? [];
  return [0, ...cuts].map((z, i, all) => [bottom + z, bottom + (all[i + 1] ?? top - bottom)]);
}

/** Splits kept inside 0…length, 5 cm clear of its ends and of each other; null for none. */
function splitsIn(at: readonly number[] | undefined, length: number): number[] | null {
  if (!at || at.length === 0) return null;
  const kept: number[] = [];
  for (const x of [...at].sort((p, q) => p - q)) if (x >= 0.05 && x <= length - 0.05 && x - (kept.at(-1) ?? 0) >= 0.05) kept.push(x);
  return kept.length > 0 ? kept : null;
}

export const isOpeningStyle = (s: unknown): s is OpeningStyle =>
  isObject(s) &&
  typeof s.operation === 'string' &&
  ([...DOOR_OPERATIONS, ...WINDOW_OPERATIONS] as readonly string[]).includes(s.operation) &&
  finite(s.leaves) &&
  s.leaves >= 1 &&
  s.leaves <= 6 &&
  finite(s.frame) &&
  s.frame >= 0 &&
  s.frame <= 0.3 &&
  finite(s.casing) &&
  s.casing >= 0 &&
  s.casing <= 0.3 &&
  finite(s.transom) &&
  s.transom >= 0 &&
  typeof s.threshold === 'boolean' &&
  (s.screen === undefined || s.screen === 'shutter' || s.screen === 'grille') &&
  [s.mullions, s.transoms].every((xs) => xs === undefined || (Array.isArray(xs) && xs.length <= 6 && xs.every((x) => finite(x) && x >= 0)));

/** The IFC name of how it opens: IfcDoorTypeOperationEnum for a door, IfcWindowPanelOperationEnum for a window's panes. */
export function ifcOperation(o: Pick<Opening, 'kind' | 'style' | 'hinge'>): string {
  const op = o.style?.operation;
  const hand = o.hinge === 'start' ? 'LEFT' : 'RIGHT';
  if (o.kind === 'door') {
    switch (op) {
      case undefined:
      case 'swing':
        return `SINGLE_SWING_${hand}`;
      case 'double':
        return 'DOUBLE_DOOR_SINGLE_SWING';
      case 'sliding':
        return (o.style?.leaves ?? 1) > 1 ? 'DOUBLE_DOOR_SLIDING' : `SLIDING_TO_${hand}`;
      case 'folding':
        return `FOLDING_TO_${hand}`;
      case 'overhead':
        return 'LIFTING_HORIZONTAL';
      case 'roller':
        return 'ROLLINGUP';
      default:
        return 'USERDEFINED';
    }
  }
  switch (op) {
    case 'sliding':
      return 'SLIDINGHORIZONTAL';
    case 'doubleHung':
      return 'SLIDINGVERTICAL';
    case 'casement':
      return o.hinge === 'start' ? 'SIDEHUNGLEFTHAND' : 'SIDEHUNGRIGHTHAND';
    case 'awning':
      return 'TOPHUNG';
    case 'hopper':
      return 'BOTTOMHUNG';
    case 'pivot':
      return 'PIVOTHORIZONTAL';
    case 'fixed':
      return 'FIXEDCASEMENT';
    default:
      return 'NOTDEFINED';
  }
}
