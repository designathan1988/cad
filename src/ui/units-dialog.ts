// The project's units (docs/plano-de-escopo.md, phase 2): the length unit lengths are shown and typed in,
// and how many decimals they show. One command, undone as any other; nothing drawn moves, only what is
// written changes. A sample under the choices shows a few lengths as they will read.

import type { App } from '../app/app';
import type { Doc } from '../project/doc';
import type { Command } from '../core/store';
import { el, segmented, select } from './controls';
import { openProjectDialog } from './dialog';
import { t } from './i18n';
import { angleNum, LENGTH_UNITS, type LengthUnit, lengthText, MAX_ANGLE_DECIMALS, MAX_DECIMALS, setUnits, SLOPE_FORMATS, type SlopeFormat, type Units, USUAL_DECIMALS } from './units';

export const setProjectUnits = (units: Units): Command<Doc> => ({
  label: 'cmd.setUnits',
  apply: (doc) => (JSON.stringify(doc.units) === JSON.stringify(units) ? doc : { ...doc, units }),
});

export function showUnits(app: App): void {
  const render = (close: () => void): HTMLElement => {
    const u = app.store.get().units;
    const change = (next: Units) => app.store.dispatch(setProjectUnits(next));
    const unit = segmented(
      LENGTH_UNITS.map((x) => ({ value: x, label: t(`units.${x}`), short: x === 'ft' ? 'ft-in' : x })),
      u.length,
      // A new unit comes with its usual decimals (280 cm, not 280,00 cm); they can be changed after.
      (v: LengthUnit) => change({ ...u, length: v, decimals: USUAL_DECIMALS[v] }),
      true,
    );
    unit.setAttribute('aria-label', t('units.length'));
    for (const b of unit.querySelectorAll('button')) b.dataset.focus = `unit:${b.getAttribute('aria-label')}`;
    const decimals = select(
      Array.from({ length: MAX_DECIMALS + 1 }, (_, i) => ({ value: String(i), label: String(i) })),
      String(u.decimals),
      (v) => change({ ...u, decimals: Number(v) }),
    );
    const sel = decimals.querySelector('select')!;
    sel.setAttribute('aria-label', t('units.decimals'));
    sel.dataset.focus = 'decimals';
    // Angles' decimals, and how slopes are written.
    const angles = select(
      Array.from({ length: MAX_ANGLE_DECIMALS + 1 }, (_, i) => ({ value: String(i), label: String(i) })),
      String(u.angleDecimals ?? 1),
      (v) => change({ ...u, angleDecimals: Number(v) }),
    );
    const angleSel = angles.querySelector('select')!;
    angleSel.setAttribute('aria-label', t('units.angleDecimals'));
    angleSel.dataset.focus = 'angleDecimals';
    const slope = segmented(
      SLOPE_FORMATS.map((f) => ({ value: f, label: t(`units.slope.${f}`), short: f === 'percent' ? '%' : f === 'degrees' ? '°' : '1:n' })),
      u.slope ?? 'percent',
      (v: SlopeFormat) => change({ ...u, slope: v }),
      true,
    );
    slope.setAttribute('aria-label', t('units.slope'));
    for (const b of slope.querySelectorAll('button')) b.dataset.focus = `slope:${b.getAttribute('aria-label')}`;
    // The sample in the units just chosen (the app's own follow on its next drawing).
    setUnits(u);
    const sample = el('p', { class: 'mat-note', role: 'status' }, t('units.sample', { a: lengthText(2.8), b: lengthText(0.15), c: lengthText(12.345) }), ` · ${angleNum(33.6901)}°`);
    const row = (label: string, control: HTMLElement) => el('div', { class: 'mat-row' }, el('span', { class: 'mat-cap' }, label), control);
    const done = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    done.dataset.focus = 'close';
    done.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('units.title') },
      el('h2', {}, t('units.title')),
      el('div', { class: 'units-body' }, row(t('units.length'), unit), row(t('units.decimals'), decimals), row(t('units.angleDecimals'), angles), row(t('units.slope'), slope), sample, el('p', { class: 'mat-note' }, t('units.note'))),
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), done),
    );
  };
  openProjectDialog(app, render);
  app.shell.helpBack.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
}
