// The site and its sun (phase 11; app/sun.ts): where the project is, where north is in plan, the date and
// hour the 3D shows the sun at, and whether it casts shadows; the sun's place said as it is then. Each
// change one command; the hour also by a slider, applied when it is let go.

import type { App } from '../app/app';
import type { Doc } from '../app/document';
import { DEFAULT_SITE, isSite, type Site, siteInstant, sunPosition } from '../app/sun';
import type { Command } from '../core/store';
import { el, numberField } from './controls';
import { openProjectDialog } from './dialog';
import { num, t } from './i18n';

export const setSite = (site: Site): Command<Doc> => ({
  label: 'cmd.setSite',
  apply: (doc) => (!isSite(site) || JSON.stringify(doc.site) === JSON.stringify(site) ? doc : { ...doc, site }),
});

const row = (label: string, control: HTMLElement, focus: string) => {
  const target = control.querySelector('input, select') ?? control;
  (target as HTMLElement).dataset.focus = focus;
  target.setAttribute('aria-label', label);
  return el('div', { class: 'mat-row' }, el('span', { class: 'mat-cap' }, label), control);
};

export function showSite(app: App): void {
  openProjectDialog(app, (close) => {
    const site = app.store.get().site ?? DEFAULT_SITE;
    const set = (p: Partial<Site>) => app.store.dispatch(setSite({ ...site, ...p }));
    const lat = numberField(site.latitude, (v) => set({ latitude: v }), -90, 4, '°', 90);
    const lon = numberField(site.longitude, (v) => set({ longitude: v }), -180, 4, '°', 180);
    const north = numberField(site.north, (v) => set({ north: v }), -360, 1, '°', 360);
    const offset = numberField(site.utcOffset, (v) => set({ utcOffset: v }), -14, 1, 'h', 14);
    const date = el('input', { type: 'date', value: site.date });
    date.addEventListener('change', () => set({ date: date.value }));
    const time = el('input', { type: 'time', value: site.time });
    time.addEventListener('change', () => set({ time: time.value }));
    // The hour by a slider: 5:00 to 19:00, a quarter hour a step.
    const [hh, mm] = site.time.split(':').map(Number);
    const slider = el('input', { type: 'range', min: '300', max: '1140', step: '15', value: String((hh ?? 10) * 60 + (mm ?? 0)) });
    const shown = el('span', { class: 'mat-note' }, site.time);
    const asTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    slider.addEventListener('input', () => (shown.textContent = asTime(Number(slider.value))));
    slider.addEventListener('change', () => set({ time: asTime(Number(slider.value)) }));
    const shadows = el('input', { type: 'checkbox' });
    shadows.checked = site.shadows;
    shadows.addEventListener('change', () => set({ shadows: shadows.checked }));
    const at = siteInstant(site);
    const p = Number.isFinite(at) ? sunPosition(site.latitude, site.longitude, at) : null;
    const said = p
      ? p.altitude > 0
        ? t('site.sunAt', { az: num(p.azimuth, 0), alt: num(p.altitude, 0) })
        : t('site.night')
      : '';
    const done = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    done.dataset.focus = 'close';
    done.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('site.title') },
      el('h2', {}, t('site.title')),
      el(
        'div',
        { class: 'units-body' },
        row(t('site.latitude'), lat, 'lat'),
        row(t('site.longitude'), lon, 'lon'),
        row(t('site.north'), north, 'north'),
        row(t('site.date'), date, 'date'),
        row(t('site.time'), time, 'time'),
        row(t('site.hour'), el('div', { class: 'site-hour' }, slider, shown), 'hour'),
        row(t('site.utc'), offset, 'utc'),
        row(t('site.shadows'), shadows, 'shadows'),
        el('p', { class: 'mat-note', role: 'status' }, said),
        el('p', { class: 'mat-note' }, t('site.note')),
      ),
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), done),
    );
  });
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="hour"]')?.focus();
}
