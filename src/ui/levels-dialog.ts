// The levels dialog: create, rename, elevation and floor-to-floor height. Every change is one command.

import type { App } from '../app/app';
import { newId } from '../core/id';
import { addLevel, deleteBlocker, deleteLevel, levelOverlaps, updateLevel } from '../elements/level/commands';
import { el, numberField } from './controls';
import { defaultName, name, num, t } from './i18n';
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
    const overlaps = levelOverlaps(doc);
    for (const l of [...doc.levels].sort((a, b) => b.elevation - a.elevation)) {
      const label = name(l.name);
      const input = el('input', { type: 'text', class: 'text-field', 'aria-label': `${t('levels.name')}: ${label}` });
      input.value = name(l.name);
      const commitName = () => {
        if (input.value.trim() !== name(l.name)) app.store.dispatch(updateLevel(l.id, { name: input.value }));
        else input.value = name(l.name);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          input.blur();
        }
        // Esc puts the name back and closes the dialog, as anywhere else in it: one press, not two.
        if (e.key === 'Escape') input.value = name(l.name);
      });
      input.addEventListener('blur', commitName);
      const del = el('button', { type: 'button', class: 'icon-btn' });
      del.innerHTML = icon('trash', 16);
      const blocker = deleteBlocker(doc, l.id);
      del.disabled = blocker !== null;
      del.title = blocker === 'last' ? t('levels.cantDeleteLast') : blocker === 'walls' ? t('levels.cantDeleteWalls') : t('levels.delete');
      del.dataset.focus = `del:${l.id}`;
      del.setAttribute('aria-label', del.title);
      del.addEventListener('click', () => {
        app.store.dispatch(deleteLevel(l.id));
        if (app.ui.levelId === l.id) app.ui.levelId = app.store.get().levels[0]!.id;
        app.refresh();
      });
      const named = (field: HTMLElement, what: string) => {
        field.querySelector('input')!.setAttribute('aria-label', `${what}: ${label}`);
        return field;
      };
      rows.append(
        input,
        named(numberField(l.elevation, (v) => app.store.dispatch(updateLevel(l.id, { elevation: v }))), t('levels.elevation')),
        named(numberField(l.height, (v) => app.store.dispatch(updateLevel(l.id, { height: v })), 0.01), t('levels.height')),
        del,
      );
      const over = overlaps.find((o) => o.levelId === l.id);
      if (over) {
        const above = doc.levels.find((x) => x.id === over.aboveId)!;
        const warn = el('div', { class: 'levels-warn', role: 'status' }, t('levels.overlap', { d: num(over.by), above: name(above.name) }));
        warn.insertAdjacentHTML('afterbegin', icon('warning', 14));
        rows.append(warn);
      }
    }
    const add = el('button', { type: 'button', class: 'icon-btn text-btn' }, `+ ${t('levels.add')}`);
    add.dataset.focus = 'add';
    add.addEventListener('click', () => {
      const id = newId('lvl');
      app.store.dispatch(addLevel(id, defaultName.level(app.store.get().levels.length)));
      app.ui.levelId = id;
      app.refresh();
    });
    const close = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    close.dataset.focus = 'close';
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
    // Rebuild unless a field of the dialog is being typed in. A button keeps the focus across the
    // rebuild (the same button, or Close when its row went away).
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && back.contains(active)) return;
    const key = active instanceof HTMLElement && back.contains(active) ? active.dataset.focus : undefined;
    render();
    if (key) (back.querySelector<HTMLElement>(`[data-focus="${key}"]`) ?? back.querySelector<HTMLElement>('[data-focus="close"]'))?.focus();
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
  // Focus on Close, not in a field: Esc closes at once, and nothing is half-edited by accident.
  back.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}
