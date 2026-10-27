// A price base read from a spreadsheet's rows (io/xlsx.ts): SINAPI's monthly files, or any table with
// a code, a description, a unit and a cost. The header row is found by its names, wherever the table
// starts below the file's own title lines, so a change of layout from one month to the next does not
// stop it; the rows under it with a code and a cost are the items. Pure.

import type { PriceItem } from './schema';

/** Upper case, no accents, single spaces: "Descrição  da Composição" → "DESCRICAO DA COMPOSICAO". */
const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

/** A number as a Brazilian sheet writes it ("1.234,56") or as a file keeps it ("1234.56"); null if none. */
export function readNumber(s: string): number | null {
  const t = s.replace(/[R$\s]/g, '');
  if (t === '') return null;
  const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface BaseColumns {
  readonly header: number;
  readonly code: number;
  readonly description: number;
  readonly unit: number;
  readonly price: number;
}

/** The header row and its columns: a code's, a description's, a unit's, and a cost's (its total when there are several). */
export function findColumns(rows: readonly (readonly string[])[]): BaseColumns | null {
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const cells = rows[r]!.map(norm);
    const code = cells.findIndex((c) => c.startsWith('CODIGO') || c === 'COD' || c === 'COD.');
    const description = cells.findIndex((c) => c.startsWith('DESCRI'));
    const unit = cells.findIndex((c) => c.startsWith('UNID') || c === 'UN' || c === 'UND');
    const costs = cells.map((c, i) => ({ c, i })).filter(({ c }) => (c.includes('CUSTO') || c.includes('PRECO') || c.includes('VALOR')) && !c.includes('%'));
    if (code < 0 || description < 0 || unit < 0 || costs.length === 0) continue;
    const price = (costs.find(({ c }) => c.includes('TOTAL')) ?? costs[costs.length - 1]!).i;
    return { header: r, code, description, unit, price };
  }
  return null;
}

/** The items under the header: a code and a cost each; the rest (blank lines, group titles) skipped. */
export function itemsFromRows(rows: readonly (readonly string[])[]): { items: PriceItem[]; skipped: number } | null {
  const cols = findColumns(rows);
  if (!cols) return null;
  const items: PriceItem[] = [];
  let skipped = 0;
  for (const row of rows.slice(cols.header + 1)) {
    const code = (row[cols.code] ?? '').trim();
    const price = readNumber(row[cols.price] ?? '');
    if (!code && !row.some((c) => c.trim())) continue;
    if (!code || price === null || price < 0) {
      skipped++;
      continue;
    }
    items.push({ code, description: (row[cols.description] ?? '').trim(), unit: (row[cols.unit] ?? '').trim(), price });
  }
  return { items, skipped };
}

/** "SINAPI_Custo_Ref_Composicoes_Sintetico_SP_202608_NaoDesonerado": the state, the month, relieved or not. */
export function guessFromName(file: string): { state?: string; month?: string; desonerado?: boolean } {
  const n = norm(file).replace(/[^A-Z0-9]+/g, '_');
  const month = /_(20\d{2})(0[1-9]|1[0-2])(?:_|$)/.exec(n);
  const state = /_(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?:_|$)/.exec(n);
  const desonerado = n.includes('NAO_DESONERADO') || n.includes('NAODESONERADO') ? false : n.includes('DESONERADO') ? true : undefined;
  return { ...(state ? { state: state[1]! } : {}), ...(month ? { month: `${month[1]}-${month[2]}` } : {}), ...(desonerado !== undefined ? { desonerado } : {}) };
}
