// Commands on the project's costs (schema.ts). Each returns a new document; the store makes each one
// undo step. The project takes its own costs the first time one changes.

import type { Doc } from '../app/document';
import type { Command } from '../core/store';
import { type BudgetLine, type Costs, costsOf, type CubSettings, type ExtraCost, type PriceBase, type PriceItem, type Stage } from './schema';

const change = (label: string, f: (c: Costs) => Costs): Command<Doc> => ({
  label,
  apply: (doc) => {
    const before = costsOf(doc);
    const after = f(before);
    return after === before || JSON.stringify(after) === JSON.stringify(before) ? doc : { ...doc, costs: after };
  },
});

export const setCub = (patch: Partial<CubSettings>): Command<Doc> => change('cmd.setCub', (c) => ({ ...c, cub: { ...c.cub, ...patch } }));

export const setBdi = (bdi: number): Command<Doc> => change('cmd.setBdi', (c) => (Number.isFinite(bdi) && bdi >= 0 ? { ...c, bdi } : c));

/** A price base brought in (a month's SINAPI), in place of the one there was. */
export const setBase = (base: PriceBase | null): Command<Doc> =>
  change('cmd.setBase', (c) => {
    if (base) return { ...c, base };
    const { base: _b, ...rest } = c;
    return rest;
  });

export const addLines = (lines: readonly BudgetLine[]): Command<Doc> => change('cmd.addLines', (c) => ({ ...c, lines: [...c.lines, ...lines] }));

/** A line changed; a price set to undefined goes back to the base's. */
export const updateLine = (id: string, patch: { readonly [K in keyof Omit<BudgetLine, 'id'>]?: BudgetLine[K] | undefined }): Command<Doc> =>
  change('cmd.updateLine', (c) => ({
    ...c,
    lines: c.lines.map((l) => (l.id === id ? (Object.fromEntries(Object.entries({ ...l, ...patch }).filter(([, v]) => v !== undefined)) as unknown as BudgetLine) : l)),
  }));

export const deleteLine = (id: string): Command<Doc> => change('cmd.deleteLine', (c) => ({ ...c, lines: c.lines.filter((l) => l.id !== id) }));

/** The office's own price for a code, over the base's; null takes it off. */
export const setOwnPrice = (code: string, item: PriceItem | null): Command<Doc> =>
  change('cmd.setOwnPrice', (c) => ({ ...c, own: [...c.own.filter((i) => i.code !== code), ...(item ? [item] : [])] }));

export const setExtras = (extras: readonly ExtraCost[]): Command<Doc> => change('cmd.setExtras', (c) => ({ ...c, extras }));

export const setStages = (stages: readonly Stage[]): Command<Doc> => change('cmd.setStages', (c) => ({ ...c, stages }));
