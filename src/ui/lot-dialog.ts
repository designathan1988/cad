// The lot dialog (app/lot.ts): where the lot is, its registry, its zone and the law its parameters come
// from, the parameters (occupancy, floor-area ratio, permeable share, setbacks, height) as the zone's
// line in the law gives them, which side of the terrain is the street, and the table of areas measured
// on the model against them (app/lot-areas.ts). Each change is one command.

import type { App } from '../app/app';
import { areasTable } from '../app/documents';
import { isLogo, type Lot, lotOf, OFFICE_FIELDS } from '../app/lot';
import { shrinkLogo } from '../app/logo-image';
import { lotReport } from '../app/lot-areas';
import type { Command } from '../core/store';
import type { Doc } from '../app/document';
import { distance } from '../core/vector';
import { el, select } from './controls';
import { openProjectDialog } from './dialog';
import { type MessageKey, num, t } from './i18n';

/** The lot changed: the project takes its own lot the first time. */
export const setLot = (patch: { readonly [K in keyof Lot]?: Lot[K] | undefined }): Command<Doc> => ({
  label: 'cmd.setLot',
  apply: (doc) => {
    const lot = lotOf(doc);
    const next = Object.fromEntries(Object.entries({ ...lot, ...patch }).filter(([, v]) => v !== undefined)) as unknown as Lot;
    return JSON.stringify(next) === JSON.stringify(doc.lot) ? doc : { ...doc, lot: next };
  },
});

/** A row: its label, its control. */
const row = (label: string, control: HTMLElement) => el('label', { class: 'lot-row' }, el('span', {}, label), control);

function textField(value: string, commit: (v: string) => void): HTMLInputElement {
  const f = el('input', { type: 'text', class: 'text-field' });
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

/** A number that may be left empty (no limit): a comma or a point for the decimals. */
function optionalNumber(value: number | undefined, unit: string, commit: (v: number | undefined) => void): HTMLElement {
  const f = el('input', { type: 'text', class: 'text-field', inputmode: 'decimal', placeholder: '—' });
  f.value = value === undefined ? '' : num(value, 2);
  f.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      f.blur();
    }
  });
  f.addEventListener('blur', () => {
    const text = f.value.trim().replace(',', '.');
    if (text === '') return value !== undefined && commit(undefined);
    const v = Number(text);
    // Not a number, or below zero: what was there comes back, and nothing changes.
    if (!Number.isFinite(v) || v < 0) {
      f.value = value === undefined ? '' : num(value, 2);
      return;
    }
    if (v !== value) commit(v);
  });
  return el('span', { class: 'lot-num' }, f, el('span', { class: 'unit' }, unit));
}

export function showLot(app: App): void {
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const lot = lotOf(doc);
    // An emptied field is no field: the title block leaves it out.
    const set = (patch: Partial<Lot>) => app.store.dispatch(setLot(Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === '' && (OFFICE_FIELDS as readonly string[]).includes(k) ? undefined : v])) as Partial<Lot>));
    const text = (key: keyof Lot, label: MessageKey) => row(t(label), textField((lot[key] as string) ?? '', (v) => set({ [key]: v })));
    const numeric = (key: keyof Lot, label: MessageKey, unit: string) => row(t(label), optionalNumber(lot[key] as number | undefined, unit, (v) => set({ [key]: v })));
    const outline = doc.terrains[0]?.outline;
    // Which side is the street: the terrain's sides by number and length.
    const front = outline
      ? (() => {
          const s = select(
            outline.map((p, i) => ({ value: String(i), label: t('lot.side', { n: i + 1, m: num(distance(p, outline[(i + 1) % outline.length]!), 2) }) })),
            String(Math.min(lot.frontEdge, outline.length - 1)),
            (v) => set({ frontEdge: Number(v) }),
          );
          return row(t('lot.front'), s);
        })()
      : el('p', { class: 'tour-empty' }, t('lot.noTerrain'));
    const where = el('div', { class: 'lot-grid' }, text('address', 'lot.address'), text('city', 'lot.city'), text('state', 'lot.state'), text('registry', 'lot.registry'), text('taxNumber', 'lot.taxNumber'));
    const zone = el(
      'div',
      { class: 'lot-grid' },
      text('zone', 'lot.zone'),
      text('law', 'lot.law'),
      ...(outline ? [] : [numeric('area', 'lot.area', 'm²')]),
      numeric('maxOccupancy', 'lot.maxOccupancy', '%'),
      numeric('maxFloorRatio', 'lot.maxFloorRatio', ''),
      numeric('minPermeability', 'lot.minPermeability', '%'),
      numeric('front', 'lot.setFront', 'm'),
      numeric('side', 'lot.setSide', 'm'),
      numeric('back', 'lot.setBack', 'm'),
      numeric('maxHeight', 'lot.maxHeight', 'm'),
    );
    // Who it is for and who answers for it: the sheets' title block (app/sheets.ts).
    const office = el(
      'div',
      { class: 'lot-grid' },
      text('owner', 'lot.owner'),
      text('firm', 'lot.firm'),
      text('responsible', 'lot.responsible'),
      text('license', 'lot.license'),
      text('record', 'lot.record'),
    );
    // The office's logo for the title block: a picture chosen, reduced to fit; shown small; taken out.
    const pick = el('input', { type: 'file', accept: 'image/png,image/jpeg', hidden: '' });
    pick.addEventListener('change', () => {
      const file = pick.files?.[0];
      pick.value = '';
      if (!file) return;
      void shrinkLogo(file).then(
        (url) => (isLogo(url) ? app.store.dispatch(setLot({ logo: url })) : app.toast(t('lot.logoBig'))),
        () => app.toast(t('lot.logoBad')),
      );
    });
    const chooseLogo = el('button', { type: 'button', class: 'icon-btn text-btn' }, t(lot.logo ? 'lot.logoChange' : 'lot.logoChoose'));
    chooseLogo.dataset.focus = 'logo';
    chooseLogo.addEventListener('click', () => pick.click());
    const dropLogo = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('lot.logoRemove'));
    dropLogo.dataset.focus = 'logoRemove';
    dropLogo.addEventListener('click', () => app.store.dispatch(setLot({ logo: undefined })));
    const logo = el(
      'div',
      { class: 'lot-row' },
      el('span', {}, t('lot.logo')),
      el('div', { class: 'lot-logo' }, ...(lot.logo ? [el('img', { src: lot.logo, alt: t('lot.logo') }), chooseLogo, dropLogo] : [chooseLogo]), pick),
    );
    const table = el('div', { class: 'lot-areas' });
    table.innerHTML = areasTable(doc, lotReport(doc, app.geometry));
    const closeBtn = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    closeBtn.dataset.focus = 'close';
    closeBtn.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('lot.title') },
      el('h2', {}, t('lot.title')),
      el('div', { class: 'lot-body' }, el('h3', {}, t('lot.where')), where, el('h3', {}, t('lot.office')), el('p', { class: 'tour-empty' }, t('lot.officeNote')), office, logo, el('h3', {}, t('lot.params')), el('p', { class: 'tour-empty' }, t('lot.paramsNote')), zone, front, el('h3', {}, t('areas.title')), table),
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), closeBtn),
    );
  };
  openProjectDialog(app, render);
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}
