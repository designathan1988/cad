// The levels dialog: create, rename, elevation, floor-to-floor height and the plan's cut height. Every
// change is one command.

import { lengthText } from '../i18n/units';
import type { App } from '../session/app';
import { setLevel } from '../session/app-edit';
import { cutHeightOf } from '../project/doc';
import { addLevel, deleteBlocker, deleteLevel, levelOverlaps, updateLevel } from '../elements/level/commands';
import { elementsOnLevel } from '../elements/registry';
import { blockedBy, el, numberField } from './controls';
import { openProjectDialog } from './dialog';
import { defaultName, name, t } from '../i18n/messages';
import { icon } from '../i18n/icons';
import { newLevelId } from '../project/doc';

export function showLevels(app: App): void {
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const rows = el('div', { class: 'levels' });
    rows.append(
      el('span', { class: 'levels-head' }, t('levels.name')),
      el('span', { class: 'levels-head' }, t('levels.elevation')),
      el('span', { class: 'levels-head' }, t('levels.height')),
      el('span', { class: 'levels-head', title: t('levels.cutHint') }, t('levels.cut')),
      el('span'),
    );
    const overlaps = levelOverlaps(doc);
    for (const l of [...doc.levels].sort((a, b) => b.elevation - a.elevation)) {
      const label = name(l.name);
      const input = el('input', { type: 'text', class: 'text-field', 'aria-label': `${t('levels.name')}: ${label}` });
      input.value = name(l.name);
      // An empty name is refused (updateLevel keeps the old one): put back and said, or the field stayed
      // blank while the level kept its name.
      const commitName = () => {
        if (input.value.trim() === '') {
          input.value = name(l.name);
          app.toast(t('field.nameNeeded'));
        } else if (input.value.trim() !== name(l.name)) app.store.dispatch(updateLevel(l.id, { name: input.value }));
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
      const on = blocker === 'elements' ? elementsOnLevel(doc, l.id) : 0;
      const why =
        blocker === 'last' ? t('levels.cantDeleteLast')
        : blocker === 'walls' ? t('levels.cantDeleteWalls')
        : blocker === 'elements' ? (on === 1 ? t('levels.cantDeleteElementsOne') : t('levels.cantDeleteElements', { n: on }))
        : null;
      // Dimmed, not disabled, with its reason (controls.ts: blockedBy).
      const whyNode = blockedBy(del, t('levels.deleteNamed', { name: label }), why, `why-${l.id}`);
      if (whyNode) rows.append(whyNode);
      del.dataset.focus = `del:${l.id}`;
      del.addEventListener('click', () => {
        if (blocker !== null) return;
        app.store.dispatch(deleteLevel(l.id));
      });
      const named = (field: HTMLElement, what: string) => {
        field.querySelector('input')!.setAttribute('aria-label', `${what}: ${label}`);
        return field;
      };
      rows.append(
        input,
        named(numberField(l.elevation, (v) => app.store.dispatch(updateLevel(l.id, { elevation: v }))), t('levels.elevation')),
        named(numberField(l.height, (v) => app.store.dispatch(updateLevel(l.id, { height: v })), 0.01), t('levels.height')),
        named(numberField(cutHeightOf(l), (v) => app.store.dispatch(updateLevel(l.id, { cutHeight: v })), 0.01), t('levels.cut')),
        del,
      );
      const over = overlaps.find((o) => o.levelId === l.id);
      if (over) {
        const above = doc.levels.find((x) => x.id === over.aboveId)!;
        const warn = el('div', { class: 'levels-warn', role: 'status' }, t('levels.overlap', { d: lengthText(over.by), above: name(above.name) }));
        warn.insertAdjacentHTML('afterbegin', icon('warning', 14));
        rows.append(warn);
      }
    }
    const add = el('button', { type: 'button', class: 'icon-btn text-btn' }, `+ ${t('levels.add')}`);
    add.dataset.focus = 'add';
    add.addEventListener('click', () => {
      const id = newLevelId();
      app.store.dispatch(addLevel(id, defaultName.level(app.store.get().levels.length)));
      setLevel(app, id);
    });
    const closeBtn = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    closeBtn.dataset.focus = 'close';
    closeBtn.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('levels.title') },
      el('h2', {}, t('levels.title')),
      rows,
      el('div', { class: 'actions' }, add, el('span', { class: 'spacer' }), closeBtn),
    );
  };
  // Redrawn on every change (dialog.ts); a button whose row went away gives the focus to Close.
  openProjectDialog(app, render);
  // Focus on Close, not in a field: Esc closes at once, and nothing is half-edited by accident.
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}
