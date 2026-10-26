// The saved views as the stops of a guided tour (ref/chat.txt:169-171): each one's name and caption,
// their order, how long each stop lasts, and Play. Every change is one command (saved-views.ts).

import type { App } from '../app/app';
import { deleteView, moveView, updateView } from '../app/saved-views';
import { el, numberField } from './controls';
import { openProjectDialog } from './dialog';
import { name, t } from './i18n';
import { icon } from './icons';

export function showTourDialog(app: App): void {
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const rows = el('div', { class: 'tour-rows' });
    rows.append(el('span', { class: 'levels-head' }, '#'), el('span', { class: 'levels-head' }, t('gtour.name')), el('span', { class: 'levels-head' }, t('gtour.caption')), el('span'), el('span'), el('span'));
    doc.views.forEach((v, k) => {
      const label = name(v.name);
      const text = (value: string, what: string, commit: (s: string) => void, focus: string) => {
        const input = el('input', { type: 'text', class: 'text-field', 'aria-label': `${what}: ${label}` });
        input.value = value;
        input.dataset.focus = focus;
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
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
      const button = (ic: 'arrowUp' | 'arrowDown' | 'trash', tip: string, run: () => void, disabled: boolean, focus: string) => {
        const b = el('button', { type: 'button', class: 'icon-btn', title: tip, 'aria-label': tip });
        b.innerHTML = icon(ic, 16);
        b.disabled = disabled;
        b.dataset.focus = focus;
        b.addEventListener('click', run);
        return b;
      };
      rows.append(
        el('span', { class: 'tour-index' }, String(k + 1)),
        text(label, t('gtour.name'), (s) => app.store.dispatch(updateView(v.id, { name: s })), `name:${v.id}`),
        text(v.caption ?? '', t('gtour.caption'), (s) => app.store.dispatch(updateView(v.id, { caption: s })), `caption:${v.id}`),
        button('arrowUp', t('gtour.earlier', { name: label }), () => app.store.dispatch(moveView(v.id, -1)), k === 0, `up:${v.id}`),
        button('arrowDown', t('gtour.later', { name: label }), () => app.store.dispatch(moveView(v.id, 1)), k === doc.views.length - 1, `down:${v.id}`),
        button('trash', t('views.delete', { name: label }), () => app.store.dispatch(deleteView(v.id)), false, `del:${v.id}`),
      );
    });
    const empty = doc.views.length === 0 ? el('p', { class: 'tour-empty' }, t('gtour.none')) : null;
    const seconds = numberField(app.tourSeconds, (s) => app.setTourSeconds(s), 1, 0, 's');
    seconds.querySelector('input')!.setAttribute('aria-label', t('gtour.seconds'));
    const play = el('button', { type: 'button', class: 'btn' }, t('gtour.play'));
    play.dataset.focus = 'play';
    play.disabled = doc.views.length === 0;
    play.addEventListener('click', () => {
      close();
      app.playTour();
    });
    const closeBtn = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    closeBtn.dataset.focus = 'close';
    closeBtn.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('gtour.title') },
      el('h2', {}, t('gtour.title')),
      el('p', { class: 'tour-hint' }, t('gtour.hint')),
      ...(empty ? [empty] : [rows]),
      el('div', { class: 'actions' }, el('label', { class: 'tour-seconds' }, t('gtour.seconds'), seconds), el('span', { class: 'spacer' }), play, closeBtn),
    );
  };
  openProjectDialog(app, render);
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}
