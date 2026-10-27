// The budget's tables as rows of cells (the budget sheet, the ABC curve, the schedule), for the
// dialog's CSV and the project's folder alike, and a CSV of them as a spreadsheet in the interface's
// language reads it (as the schedules' CSV, app/schedules.ts). Pure.

import type { Doc } from '../app/document';
import { abcOf, type Budget, scheduleOf } from './budget';
import { costsOf } from './schema';

export type Cell = string | number;

/** The words the tables are written in (ui/i18n.ts t). */
export type Say = (key: string, vars?: Readonly<Record<string, string | number>>) => string;

export function sheetRows(doc: Doc, b: Budget, say: Say): Cell[][] {
  const costs = costsOf(doc);
  return [
    [say('budget.code'), say('budget.description'), say('budget.unit'), say('budget.quantity'), say('budget.price'), say('budget.total')],
    ...b.rows.map((r) => [r.line.code, r.line.description, r.line.unit, r.quantity, r.price?.price ?? '', r.total ?? '']),
    ['', say('budget.direct'), '', '', '', b.direct],
    ['', say('budget.bdiValue', { p: costs.bdi }), '', '', '', b.bdi],
    ...costs.extras.map((x) => ['', x.name, '', '', '', x.value]),
    ['', say('budget.grand'), '', '', '', b.total],
  ];
}

export function abcRows(b: Budget, say: Say): Cell[][] {
  return [
    [say('budget.rank'), say('budget.code'), say('budget.description'), say('budget.total'), say('budget.share'), say('budget.cumulative'), say('budget.class')],
    ...abcOf(b).map((a, i) => [String(i + 1), a.row.line.code, a.row.line.description, a.row.total!, a.share, a.cumulative, a.cls]),
  ];
}

export function scheduleRows(doc: Doc, b: Budget, say: Say): Cell[][] {
  const s = scheduleOf(doc, b);
  return [
    [say('budget.stage'), say('budget.start'), say('budget.months'), say('budget.total'), ...s.months.map((_, i) => say('budget.month', { n: i + 1 }))],
    ...s.rows.map((r) => [r.stage.name, String(r.stage.start), String(r.stage.months), r.cost, ...r.months]),
    [say('budget.perMonth'), '', '', '', ...s.months],
    [say('budget.cumulativeMonth'), '', '', '', ...s.cumulative],
  ];
}

/** Rows as CSV: Portuguese with ";" and a decimal comma, English with "," and a point; a UTF-8 mark first. */
export function csvOf(rows: readonly (readonly Cell[])[], pt: boolean): string {
  const sep = pt ? ';' : ',';
  const cell = (v: Cell) => {
    if (typeof v === 'number') return pt ? v.toFixed(2).replace('.', ',') : v.toFixed(2);
    return /[";,\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return `﻿${rows.map((r) => r.map(cell).join(sep)).join('\r\n')}\r\n`;
}
