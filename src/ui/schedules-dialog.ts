// Quantity schedules (app/schedules.ts): doors, windows, rooms and walls as tables, with their totals,
// each saved as CSV for a spreadsheet. Read from the model: nothing here changes it.

import type { App } from '../app/app';
import { type Cell, schedule, SCHEDULE_KINDS, type ScheduleColumn, type ScheduleKind, toCsv } from '../app/schedules';
import { el, segmented } from './controls';
import { openProjectDialog } from './dialog';
import { getLang, type MessageKey, name, num, t } from './i18n';

export function showSchedulesDialog(app: App, first: ScheduleKind = 'rooms'): void {
  let kind = first;
  const naming = { name, wallTag: (n: number) => t('wall.tag', { n }), outside: t('schedule.outside') };
  const shown = (v: Cell, c: ScheduleColumn): string => {
    if (v === null) return '—';
    if (typeof v === 'string') return v;
    return c.unit === 'text' || c.unit === 'count' ? String(v) : num(v);
  };
  let dialog: { redraw: () => void } | null = null;
  const render = (close: () => void): HTMLElement => {
    const s = schedule(app.store.get(), app.geometry, kind, naming);
    const headers = s.columns.map((c) => t(c.key as MessageKey));
    const tabs = segmented(
      SCHEDULE_KINDS.map((k) => ({ value: k, label: t(`schedule.kind.${k}`) })),
      kind,
      (k) => {
        kind = k;
        dialog?.redraw();
      },
      true,
    );
    tabs.setAttribute('aria-label', t('schedule.title'));
    tabs.querySelectorAll('button').forEach((b, i) => (b.dataset.focus = `tab:${SCHEDULE_KINDS[i]}`));
    const numeric = (c: ScheduleColumn) => c.unit !== 'text';
    const table = el('table', { class: 'schedule-table' });
    const head = el('tr', {}, ...s.columns.map((c, i) => el('th', { scope: 'col', class: numeric(c) ? 'num' : '' }, headers[i]!)));
    const body = s.rows.map((r) => el('tr', {}, ...r.map((v, i) => el('td', { class: numeric(s.columns[i]!) ? 'num' : '' }, shown(v, s.columns[i]!)))));
    const total = el(
      'tr',
      { class: 'total' },
      ...s.totals.map((v, i) => el('td', { class: numeric(s.columns[i]!) && i > 0 ? 'num' : '' }, i === 0 ? t('schedule.count', { n: v ?? 0 }) : v === null ? '' : shown(v, s.columns[i]!))),
    );
    table.append(el('thead', {}, head), el('tbody', {}, ...body), el('tfoot', {}, total));
    const content = s.rows.length === 0 ? el('p', { class: 'tour-empty' }, t('schedule.empty')) : el('div', { class: 'schedule-scroll' }, table);
    const csv = el('button', { type: 'button', class: 'btn' }, t('schedule.csv'));
    csv.dataset.focus = 'csv';
    csv.disabled = s.rows.length === 0;
    csv.addEventListener('click', () => {
      const file = `${app.fileBase()} - ${t(`schedule.kind.${kind}`)}.csv`;
      app.download(file, toCsv(s, headers, t('schedule.total'), getLang()), 'text/csv;charset=utf-8');
      app.toast(t('schedule.saved', { file }));
    });
    const closeBtn = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    closeBtn.dataset.focus = 'close';
    closeBtn.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-xl', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('schedule.title') },
      el('h2', {}, t('schedule.title')),
      el('div', { class: 'schedule-tabs' }, tabs),
      content,
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), csv, closeBtn),
    );
  };
  dialog = openProjectDialog(app, render, () => `tab:${kind}`);
  app.shell.helpBack.querySelector<HTMLElement>(`[data-focus="tab:${kind}"]`)?.focus();
}
