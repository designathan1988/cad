// The points of interest (app/points.ts): each one's title and text, and deleting it. Every change is one
// command; the one opened from its card is first.

import type { App } from '../app/app';
import { deletePoint, updatePoint } from '../app/points';
import { el } from './controls';
import { openProjectDialog } from './dialog';
import { name, t } from './i18n';
import { icon } from './icons';

export function showPointsDialog(app: App): void {
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const rows = el('div', { class: 'points-rows' });
    rows.append(el('span', { class: 'levels-head' }, '#'), el('span', { class: 'levels-head' }, t('poi.title')), el('span', { class: 'levels-head' }, t('poi.text')), el('span', { class: 'levels-head' }, t('poi.level')), el('span'));
    doc.points.forEach((p, k) => {
      const field = (value: string, what: string, commit: (s: string) => void, focus: string, area = false) => {
        const input = area ? el('textarea', { class: 'text-field', rows: '2', 'aria-label': `${what}: ${p.title}` }) : el('input', { type: 'text', class: 'text-field', 'aria-label': `${what}: ${p.title}` });
        input.value = value;
        input.dataset.focus = focus;
        input.addEventListener('keydown', (e: Event) => {
          if (!(e instanceof KeyboardEvent)) return;
          if (e.key === 'Enter' && !area) {
            e.stopPropagation();
            input.blur();
          }
          if (e.key === 'Escape') input.value = value;
        });
        input.addEventListener('blur', () => {
          if (input.value !== value) commit(input.value);
        });
        return input;
      };
      const del = el('button', { type: 'button', class: 'icon-btn', title: t('poi.delete', { name: p.title }), 'aria-label': t('poi.delete', { name: p.title }) });
      del.innerHTML = icon('trash', 16);
      del.dataset.focus = `del:${p.id}`;
      del.addEventListener('click', () => {
        if (app.openPointId === p.id) app.showPoint(null);
        app.store.dispatch(deletePoint(p.id));
      });
      const level = doc.levels.find((l) => l.id === p.levelId);
      rows.append(
        el('span', { class: 'tour-index' }, String(k + 1)),
        field(p.title, t('poi.title'), (s) => app.store.dispatch(updatePoint(p.id, { title: s })), `title:${p.id}`),
        field(p.text ?? '', t('poi.text'), (s) => app.store.dispatch(updatePoint(p.id, { text: s })), `text:${p.id}`, true),
        el('span', { class: 'tour-index' }, level ? name(level.name) : ''),
        del,
      );
    });
    const empty = doc.points.length === 0 ? el('p', { class: 'tour-empty' }, t('poi.none')) : null;
    const closeBtn = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    closeBtn.dataset.focus = 'close';
    closeBtn.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('poi.dialog') },
      el('h2', {}, t('poi.dialog')),
      ...(empty ? [empty] : [rows]),
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), closeBtn),
    );
  };
  openProjectDialog(app, render);
  // The one just made or opened from its card: its title ready to type.
  const id = app.openPointId;
  const first = id ? app.shell.helpBack.querySelector<HTMLInputElement>(`[data-focus="title:${id}"]`) : null;
  if (first) {
    first.focus();
    first.select();
  } else app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}
