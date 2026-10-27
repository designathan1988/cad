// The budget dialog (costs/): the CUB estimate; the budget sheet, its lines tied to the model's
// quantities and priced from an imported base (SINAPI's XLSX or a CSV) with the office's own prices
// over it, the BDI and the other costs; the ABC curve; the physical-financial schedule. Each tab saved
// as CSV. Every change is one command; the figures follow the model as it changes.

import type { App } from '../app/app';
import { newId } from '../core/id';
import { materialIn } from '../elements/material/schema';
import { abcOf, budgetOf, cubEstimate, linesFromModel, scheduleOf, searchBase } from '../costs/budget';
import { addLines, deleteLine, setBase, setBdi, setCub, setExtras, setOwnPrice, setStages, updateLine } from '../costs/commands';
import { guessFromName, itemsFromRows } from '../costs/price-base';
import { type BudgetLine, costsOf, type Measure, QUANTITY_OFS, type QuantityOf } from '../costs/schema';
import { readCsv, readXlsx } from '../io/xlsx';
import { abcRows, type Cell, csvOf, scheduleRows, sheetRows } from '../costs/tables';
import { breakdownOf } from '../costs/breakdown';
import { el, numberField, segmented, select } from './controls';
import { openProjectDialog } from './dialog';
import { getLang, materialLabel, type MessageKey, num, t } from './i18n';
import { icon } from './icons';

type Tab = 'cub' | 'sheet' | 'abc' | 'elements' | 'schedule';

/** R$ 1.234,56: the thousands grouped, as money is read. */
export const money = (v: number): string => `R$ ${v.toLocaleString(getLang() === 'pt' ? 'pt-BR' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A quantity's measure when its line is made from what it is measured on. */
const MEASURE_OF: Readonly<Record<QuantityOf, Measure>> = {
  masonry: 'area',
  mortar: 'volume',
  faceExterior: 'area',
  faceInterior: 'area',
  layer: 'area',
  floor: 'area',
  roomWall: 'area',
  ceiling: 'area',
  doors: 'count',
  windows: 'area',
  built: 'area',
  fixed: 'count',
};

/** A text field committed on Enter or on leaving it. */
function textCommit(value: string, label: string, commit: (v: string) => void, cls = 'text-field'): HTMLInputElement {
  const f = el('input', { type: 'text', class: cls, 'aria-label': label, title: value });
  f.value = value;
  f.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      f.blur();
    }
  });
  f.addEventListener('blur', () => f.value.trim() !== value && commit(f.value.trim()));
  return f;
}

export function showBudget(app: App, first: Tab = 'sheet'): void {
  let tab: Tab = first;
  let query = '';
  let scrolled = 0;
  const fileInput = el('input', { type: 'file', accept: '.xlsx,.csv,.tsv,.txt', hidden: '' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void importBase(app, file);
  });
  let dialog: { redraw: () => void } | null = null;

  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const costs = costsOf(doc);
    const g = app.geometry;
    const b = budgetOf(doc, g);
    const tabs = segmented(
      (['cub', 'sheet', 'abc', 'elements', 'schedule'] as const).map((k) => ({ value: k, label: t(`budget.tab.${k}`) })),
      tab,
      (k) => {
        tab = k;
        dialog?.redraw();
      },
      true,
    );
    const btn = (label: string, run: () => void, cls = 'icon-btn text-btn') => {
      const x = el('button', { type: 'button', class: cls }, label);
      x.addEventListener('click', run);
      return x;
    };
    const say = (k: string, v?: Readonly<Record<string, string | number>>) => t(k as MessageKey, v);
    const save = (name: string, rows: Cell[][]) => {
      const file = `${app.fileBase()} - ${name}.csv`;
      app.download(file, csvOf(rows, getLang() === 'pt'), 'text/csv;charset=utf-8');
      app.toast(t('schedule.saved', { file }));
    };
    let body: HTMLElement;
    let saveBtn: HTMLElement | null = null;

    if (tab === 'cub') {
      const c = costs.cub;
      const e = cubEstimate(doc, g);
      const row = (label: MessageKey, control: HTMLElement) => el('label', { class: 'lot-row' }, el('span', {}, t(label)), control);
      const desonerado = el('input', { type: 'checkbox' });
      desonerado.checked = c.desonerado;
      desonerado.addEventListener('change', () => app.store.dispatch(setCub({ desonerado: desonerado.checked })));
      body = el(
        'div',
        { class: 'lot-body' },
        el('p', { class: 'tour-empty' }, t('budget.cubIntro')),
        el(
          'div',
          { class: 'lot-grid' },
          row('budget.cubStandard', textCommit(c.standard, t('budget.cubStandard'), (v) => app.store.dispatch(setCub({ standard: v })))),
          row('budget.cubValue', numberField(c.value, (v) => app.store.dispatch(setCub({ value: v })), 0, 2, 'R$/m²')),
          row('budget.cubState', textCommit(c.state, t('budget.cubState'), (v) => app.store.dispatch(setCub({ state: v })))),
          row('budget.cubMonth', textCommit(c.month, t('budget.cubMonth'), (v) => app.store.dispatch(setCub({ month: v })))),
          row('budget.cubEquivalence', numberField(c.equivalence, (v) => app.store.dispatch(setCub({ equivalence: v })), 0.01, 2, '×')),
          el('label', { class: 'lot-row' }, el('span', {}, t('budget.cubDesonerado')), desonerado),
        ),
        row('budget.cubSource', textCommit(c.source, t('budget.cubSource'), (v) => app.store.dispatch(setCub({ source: v })))),
        el(
          'table',
          { class: 'schedule-table budget-total' },
          el('tbody', {}, ...[
            [t('budget.cubArea'), `${num(e.area, 2)} m²`],
            [t('budget.cubValue'), money(e.value)],
            [t('budget.cubTotal'), money(e.total)],
          ].map(([k, v]) => el('tr', {}, el('th', {}, k!), el('td', { class: 'num' }, v!)))),
        ),
        el('p', { class: 'tour-empty' }, t('budget.cubNote')),
      );
    } else if (tab === 'sheet') {
      const base = costs.base;
      const baseInfo = base ? t('budget.baseInfo', { name: base.name, state: base.state, month: base.month, n: base.items.length, kind: t(base.desonerado ? 'budget.desonerado' : 'budget.naoDesonerado') }) : t('budget.noBase');
      const fromModel = btn(t('budget.fromModel'), () => {
        // Only what is not there yet, by what it is measured on.
        const key = (l: BudgetLine) => `${l.quantity.of}/${l.quantity.material ?? ''}/${l.quantity.measure}`;
        const have = new Set(costs.lines.map(key));
        const fresh = linesFromModel(doc, g, { item: (k) => t(k as MessageKey), material: (id) => materialLabel(materialIn(doc.materials, id)) }).filter((l) => !have.has(key(l)));
        if (fresh.length > 0) app.store.dispatch(addLines(fresh));
        app.toast(t('budget.added', { n: fresh.length }));
      });
      const bdi = numberField(costs.bdi, (v) => app.store.dispatch(setBdi(v)), 0, 2, '%');
      // A search in the base: each result a button that adds a line of it.
      const search = el('input', { type: 'search', class: 'text-field', placeholder: t('budget.searchPh'), 'aria-label': t('budget.search') });
      search.value = query;
      search.disabled = !base;
      const results = el('div', { class: 'budget-results' });
      const showResults = () => {
        results.replaceChildren(
          ...searchBase(base?.items ?? [], query, 12).map((i) => {
            const add = btn(`${i.code} · ${i.description} (${i.unit}) ${money(i.price)}`, () =>
              app.store.dispatch(addLines([{ id: newId('line'), code: i.code, description: i.description, unit: i.unit, quantity: { of: 'fixed', measure: 'count', value: 1 }, stage: 'stage_general' }])),
            );
            add.classList.add('budget-result');
            return add;
          }),
        );
      };
      search.addEventListener('input', () => {
        query = search.value;
        showResults();
      });
      search.addEventListener('keydown', (e) => e.stopPropagation());
      showResults();
      const table = el('table', { class: 'schedule-table budget-sheet' });
      const head = ['budget.code', 'budget.description', 'budget.measuredOn', 'budget.quantity', 'budget.unit', 'budget.price', 'budget.total', 'budget.stage', ''].map((k, i) =>
        el('th', { class: [3, 5, 6].includes(i) ? 'num' : '' }, k ? t(k as MessageKey) : ''),
      );
      table.append(el('thead', {}, el('tr', {}, ...head)));
      const tbody = el('tbody');
      for (const r of b.rows) {
        const l = r.line;
        const of = select(
          QUANTITY_OFS.map((q) => ({ value: q, label: t(`budget.of.${q}`) })),
          l.quantity.of,
          (v) => app.store.dispatch(updateLine(l.id, { quantity: { of: v as QuantityOf, measure: MEASURE_OF[v as QuantityOf], ...(v === 'fixed' ? { value: r.quantity } : l.quantity.material ? { material: l.quantity.material } : {}) } })),
        );
        const quantity =
          l.quantity.of === 'fixed'
            ? numberField(l.quantity.value ?? 0, (v) => app.store.dispatch(updateLine(l.id, { quantity: { ...l.quantity, value: v } })), 0, 2, '')
            : el('span', {}, num(r.quantity, 2));
        // The price: the one used, where it comes from; typed, it is the line's own.
        const price = numberField(r.price?.price ?? null, (v) => app.store.dispatch(updateLine(l.id, { price: v })), 0, 2, '');
        // No price yet: a dash, not the panel's "varies" of a mixed selection.
        price.querySelector('input')!.placeholder = '—';
        const from = el('small', { class: 'budget-from' }, r.price ? t(`budget.from.${r.price.from}`) : t('budget.from.none'));
        const own = r.price?.from === 'line' ? btn(t('budget.toBase'), () => app.store.dispatch(updateLine(l.id, { price: undefined })), 'icon-btn text-btn budget-small') : null;
        const keepOwn =
          l.code && r.price && r.price.from !== 'own'
            ? btn(t('budget.keepOwn'), () => app.store.dispatch(setOwnPrice(l.code, { code: l.code, description: l.description, unit: l.unit, price: r.price!.price })), 'icon-btn text-btn budget-small')
            : l.code && r.price?.from === 'own'
              ? btn(t('budget.dropOwn'), () => app.store.dispatch(setOwnPrice(l.code, null)), 'icon-btn text-btn budget-small')
              : null;
        const stage = select(
          costs.stages.map((s) => ({ value: s.id, label: s.name })),
          l.stage,
          (v) => app.store.dispatch(updateLine(l.id, { stage: v })),
        );
        const del = el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('budget.deleteLine', { what: l.description }) });
        del.innerHTML = icon('trash', 14);
        del.addEventListener('click', () => app.store.dispatch(deleteLine(l.id)));
        tbody.append(
          el(
            'tr',
            {},
            el('td', {}, textCommit(l.code, t('budget.code'), (v) => app.store.dispatch(updateLine(l.id, { code: v })), 'text-field budget-code')),
            el('td', {}, textCommit(l.description, t('budget.description'), (v) => app.store.dispatch(updateLine(l.id, { description: v })), 'text-field budget-desc')),
            el('td', {}, of),
            el('td', { class: 'num' }, quantity),
            el('td', {}, textCommit(l.unit, t('budget.unit'), (v) => app.store.dispatch(updateLine(l.id, { unit: v })), 'text-field budget-unit')),
            el('td', { class: 'num' }, price, from, ...(own ? [own] : []), ...(keepOwn ? [keepOwn] : [])),
            el('td', { class: 'num budget-money' }, r.total === null ? '—' : money(r.total)),
            el('td', { class: 'budget-stage' }, stage),
            el('td', {}, del),
          ),
        );
      }
      if (b.rows.length === 0) tbody.append(el('tr', {}, el('td', { colspan: '9' }, t('budget.noLines'))));
      table.append(tbody);
      // The other costs: a name and a sum each.
      const extras = el(
        'div',
        { class: 'budget-extras' },
        ...costs.extras.map((x) => {
          const del = el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('budget.deleteLine', { what: x.name }) });
          del.innerHTML = icon('trash', 14);
          del.addEventListener('click', () => app.store.dispatch(setExtras(costs.extras.filter((y) => y.id !== x.id))));
          return el(
            'div',
            { class: 'budget-extra' },
            textCommit(x.name, t('budget.extraName'), (v) => app.store.dispatch(setExtras(costs.extras.map((y) => (y.id === x.id ? { ...y, name: v } : y))))),
            numberField(x.value, (v) => app.store.dispatch(setExtras(costs.extras.map((y) => (y.id === x.id ? { ...y, value: v } : y)))), 0, 2, 'R$'),
            del,
          );
        }),
        btn(t('budget.addExtra'), () => app.store.dispatch(setExtras([...costs.extras, { id: newId('extra'), name: t('budget.extraDefault'), value: 0 }]))),
      );
      const totals = el(
        'table',
        { class: 'schedule-table budget-total' },
        el('tbody', {}, ...[
          [t('budget.direct'), money(b.direct)],
          [t('budget.bdiValue', { p: num(costs.bdi, 2) }), money(b.bdi)],
          [t('budget.extras'), money(b.extras)],
          [t('budget.grand'), money(b.total)],
        ].map(([k, v]) => el('tr', {}, el('th', {}, k!), el('td', { class: 'num' }, v!)))),
      );
      const scroller = el('div', { class: 'budget-scroll' }, table);
      scroller.addEventListener('scroll', () => (scrolled = scroller.scrollTop));
      requestAnimationFrame(() => (scroller.scrollTop = scrolled));
      body = el(
        'div',
        { class: 'budget-body' },
        el('div', { class: 'budget-bar' }, el('span', { class: 'budget-base' }, baseInfo), btn(t('budget.importBase'), () => fileInput.click()), ...(base ? [btn(t('budget.dropBase'), () => app.store.dispatch(setBase(null)))] : []), fileInput),
        el('div', { class: 'budget-bar' }, fromModel, el('label', { class: 'budget-bdi' }, el('span', {}, t('budget.bdi')), bdi), search),
        results,
        scroller,
        ...(b.unpriced > 0 ? [el('p', { class: 'tour-empty' }, t('budget.unpriced', { n: b.unpriced }))] : []),
        el('h3', {}, t('budget.extras')),
        extras,
        totals,
      );
      saveBtn = btn(t('schedule.csv'), () => save(t('budget.tab.sheet'), sheetRows(doc, b, say)));
    } else if (tab === 'elements') {
      // The cost of each room and each element: its share of the lines it makes (costs/breakdown.ts).
      const d = breakdownOf(doc, g, b);
      const factor = 1 + costs.bdi / 100;
      const rooms = doc.rooms.filter((r) => d.byElement.has(r.id)).map((r) => ({ id: r.id, cost: d.byElement.get(r.id)! * factor }));
      const others = [...d.byElement.entries()].filter(([id]) => !doc.rooms.some((r) => r.id === id)).map(([id, cost]) => ({ id, cost: cost * factor })).sort((x, y) => y.cost - x.cost);
      const list = (rows: { id: string; cost: number }[], head: MessageKey) =>
        el(
          'table',
          { class: 'schedule-table' },
          el('thead', {}, el('tr', {}, el('th', {}, t(head)), el('th', { class: 'num' }, t('budget.withBdi')))),
          el('tbody', {}, ...rows.map((r) => el('tr', {}, el('td', {}, app.reportTitle(r.id)), el('td', { class: 'num' }, money(r.cost))))),
        );
      body = el(
        'div',
        { class: 'budget-scroll' },
        el('h3', {}, t('budget.byRoom')),
        rooms.length > 0 ? list(rooms, 'memo.room') : el('p', { class: 'tour-empty' }, t('budget.noRoomCosts')),
        el('h3', {}, t('budget.byElement')),
        others.length > 0 ? list(others, 'budget.element') : el('p', { class: 'tour-empty' }, t('budget.noPriced')),
        el('p', { class: 'tour-empty' }, t('budget.unshared', { v: money(d.unshared * factor) })),
      );
      saveBtn = btn(t('schedule.csv'), () =>
        save(t('budget.tab.elements'), [[t('budget.element'), t('budget.withBdi')], ...[...rooms, ...others].map((r) => [app.reportTitle(r.id), r.cost]), [t('budget.unsharedRow'), d.unshared * factor]]),
      );
    } else if (tab === 'abc') {
      const abc = abcOf(b);
      body = el(
        'div',
        { class: 'budget-scroll' },
        el(
          'table',
          { class: 'schedule-table' },
          el('thead', {}, el('tr', {}, ...['budget.rank', 'budget.code', 'budget.description', 'budget.total', 'budget.share', 'budget.cumulative', 'budget.class'].map((k, i) => el('th', { class: i >= 3 && i <= 5 ? 'num' : '' }, t(k as MessageKey))))),
          el(
            'tbody',
            {},
            ...abc.map((a, i) =>
              el(
                'tr',
                {},
                el('td', {}, String(i + 1)),
                el('td', {}, a.row.line.code),
                el('td', {}, a.row.line.description),
                el('td', { class: 'num' }, money(a.row.total!)),
                el('td', { class: 'num' }, `${num(a.share, 2)} %`),
                el('td', { class: 'num' }, `${num(a.cumulative, 2)} %`),
                el('td', {}, a.cls),
              ),
            ),
          ),
        ),
        ...(abc.length === 0 ? [el('p', { class: 'tour-empty' }, t('budget.noPriced'))] : []),
      );
      saveBtn = btn(t('schedule.csv'), () => save(t('budget.tab.abc'), abcRows(b, say)));
    } else {
      const s = scheduleOf(doc, b);
      const monthHeads = s.months.map((_, i) => el('th', { class: 'num' }, t('budget.month', { n: i + 1 })));
      const stageRows = s.rows.map((r) => {
        const set = (patch: { name?: string; start?: number; months?: number }) => app.store.dispatch(setStages(costs.stages.map((x) => (x.id === r.stage.id ? { ...x, ...patch } : x))));
        return el(
          'tr',
          {},
          el('td', {}, textCommit(r.stage.name, t('budget.stage'), (v) => set({ name: v }))),
          el('td', {}, numberField(r.stage.start, (v) => set({ start: Math.max(1, Math.round(v)) }), 1, 0, '')),
          el('td', {}, numberField(r.stage.months, (v) => set({ months: Math.max(1, Math.round(v)) }), 1, 0, '')),
          el('td', { class: 'num' }, money(r.cost)),
          ...r.months.map((v) => el('td', { class: 'num' }, v > 0 ? money(v) : '')),
        );
      });
      const foot = (label: string, values: number[]) => el('tr', { class: 'total' }, el('td', {}, label), el('td'), el('td'), el('td'), ...values.map((v) => el('td', { class: 'num' }, money(v))));
      body = el(
        'div',
        { class: 'budget-scroll' },
        el(
          'table',
          { class: 'schedule-table' },
          el('thead', {}, el('tr', {}, ...['budget.stage', 'budget.start', 'budget.months', 'budget.total'].map((k) => el('th', {}, t(k as MessageKey))), ...monthHeads)),
          el('tbody', {}, ...stageRows),
          el('tfoot', {}, foot(t('budget.perMonth'), s.months), foot(t('budget.cumulativeMonth'), s.cumulative)),
        ),
        btn(t('budget.addStage'), () => app.store.dispatch(setStages([...costs.stages, { id: newId('stage'), name: t('budget.stageDefault'), start: 1, months: 1 }]))),
        el('p', { class: 'tour-empty' }, t('budget.scheduleNote')),
      );
      saveBtn = btn(t('schedule.csv'), () => save(t('budget.tab.schedule'), scheduleRows(doc, b, say)));
    }
    const closeBtn = btn(t('help.close'), close);
    closeBtn.dataset.focus = 'close';
    return el(
      'div',
      { class: 'dialog dialog-xl budget-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('budget.title') },
      el('h2', {}, t('budget.title')),
      el('div', { class: 'schedule-tabs' }, tabs),
      body,
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), ...(saveBtn ? [saveBtn] : []), closeBtn),
    );
  };
  dialog = openProjectDialog(app, render);
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}

/** A price base read from a file (XLSX or CSV) and set as the project's, its state and month from its name; said. */
async function importBase(app: App, file: File): Promise<void> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const rows = /\.xlsx$/i.test(file.name) ? await readXlsx(bytes) : readCsv(new TextDecoder().decode(bytes));
    const r = itemsFromRows(rows);
    if (!r || r.items.length === 0) {
      app.toast(t('budget.baseBad', { error: t('budget.baseNoTable') }));
      return;
    }
    const guess = guessFromName(file.name);
    app.store.dispatch(setBase({ name: file.name.replace(/\.[^.]+$/, ''), state: guess.state ?? '', month: guess.month ?? '', desonerado: guess.desonerado ?? false, items: r.items }));
    app.toast(t('budget.baseRead', { n: r.items.length, skipped: r.skipped }));
  } catch (e) {
    console.warn('The price base could not be read.', e);
    app.toast(t('budget.baseBad', { error: e instanceof Error ? e.message : String(e) }));
  }
}
