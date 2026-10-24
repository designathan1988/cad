// The levels dialog: create, rename, elevation and floor-to-floor height. Every change is one command.

import type { App } from '../app/app';
import { newId } from '../core/id';
import { addLevel, canDeleteLevel, deleteLevel, updateLevel } from '../elements/level/commands';
import { el, numberField } from './controls';
import { name, t } from './i18n';
import { icon } from './icons';

export function showLevels(app: App): void {
  const back = app.shell.helpBack;
  const render = () => {
    const doc = app.store.get();
    const rows = el('div', { class: 'levels' });
    rows.append(
      el('span', { class: 'levels-head' }, t('levels.name')),
      el('span', { class: 'levels-head' }, t('levels.elevation')),
      el('span', { class: 'levels-head' }, t('levels.height')),
      el('span'),
    );
    for (const l of [...doc.levels].sort((a, b) => b.elevation - a.elevation)) {
      const input = el('input', { type: 'text', class: 'text-field', 'aria-label': t('levels.name') });
      input.value = name(l.name);
      const commitName = () => {
        if (input.value.trim() !== name(l.name)) app.store.dispatch(updateLevel(l.id, { name: input.value }));
        else input.value = name(l.name);
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') {
          input.value = name(l.name);
          input.blur();
        }
      });
      input.addEventListener('blur', commitName);
      const del = el('button', { type: 'button', class: 'icon-btn' });
      del.innerHTML = icon('trash', 16);
      const ok = canDeleteLevel(doc, l.id);
      del.disabled = !ok;
      del.title = ok ? t('levels.delete') : t('levels.cantDelete');
      del.setAttribute('aria-label', del.title);
      del.addEventListener('click', () => {
        app.store.dispatch(deleteLevel(l.id));
        if (app.ui.levelId === l.id) app.ui.levelId = app.store.get().levels[0]!.id;
        app.refresh();
      });
      rows.append(
        input,
        numberField(l.elevation, (v) => app.store.dispatch(updateLevel(l.id, { elevation: v }))),
        numberField(l.height, (v) => app.store.dispatch(updateLevel(l.id, { height: v })), 0.01),
        del,
      );
    }
    const add = el('button', { type: 'button', class: 'icon-btn text-btn' }, `+ ${t('levels.add')}`);
    add.addEventListener('click', () => {
      const id = newId('lvl');
      app.store.dispatch(addLevel(id, t('levels.new', { n: app.store.get().levels.length })));
      app.ui.levelId = id;
      app.refresh();
    });
    const close = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    close.addEventListener('click', hide);
    const dialog = el(
      'div',
      { class: 'dialog dialog-wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('levels.title') },
      el('h2', {}, t('levels.title')),
      rows,
      el('div', { class: 'actions' }, add, el('span', { class: 'spacer' }), close),
    );
    back.replaceChildren(dialog);
  };
  const unsubscribe = app.store.subscribe(() => {
    // Rebuild only when focus is not in a field of the dialog, so typing is never interrupted.
    if (!back.contains(document.activeElement) || document.activeElement === document.body) render();
  });
  const hide = () => {
    unsubscribe();
    back.hidden = true;
    back.onkeydown = null;
    app.shell.planCanvas.focus();
  };
  back.onclick = (e) => {
    if (e.target === back) hide();
  };
  back.onkeydown = (e) => {
    if (e.key === 'Escape') hide();
  };
  render();
  back.hidden = false;
  back.querySelector('input')?.focus();
}
