// The project's variables (phase 9): named lengths typed by name in any measure ("pd - 0,10", "3 x
// modulo"). Each a name and a length; added, renamed, changed and removed, one command each, kept in
// the project file (core/measure.ts reads them).

import type { App } from '../app/app';
import type { Doc } from '../app/document';
import { isVariableName } from '../core/measure';
import type { Command } from '../core/store';
import { el, numberField } from './controls';
import { openProjectDialog } from './dialog';
import { textField } from './fields';
import { t } from './i18n';
import { icon } from './icons';

export const setProjectVariables = (variables: Readonly<Record<string, number>>): Command<Doc> => ({
  label: 'cmd.setVariables',
  apply: (doc) => {
    const ok = Object.entries(variables).every(([k, v]) => isVariableName(k) && Number.isFinite(v));
    if (!ok || JSON.stringify(doc.variables ?? {}) === JSON.stringify(variables)) return doc;
    if (Object.keys(variables).length === 0) {
      const { variables: _gone, ...rest } = doc;
      return rest;
    }
    return { ...doc, variables };
  },
});

export function showVariables(app: App): void {
  let said = '';
  const dialog = openProjectDialog(app, (close) => {
    const vars = app.store.get().variables ?? {};
    const set = (next: Record<string, number>) => app.store.dispatch(setProjectVariables(next));
    const rows = Object.entries(vars).map(([name, value]) => {
      const nameField = textField(name, (v) => {
        const n = v.trim();
        if (n === name) return;
        if (!isVariableName(n) || Object.hasOwn(vars, n)) {
          said = t('vars.badName', { name: n });
          return dialog.redraw();
        }
        said = '';
        // Renamed in place: the order kept.
        set(Object.fromEntries(Object.entries(vars).map(([k, x]) => [k === name ? n : k, x])));
      });
      (nameField.querySelector('input') ?? nameField).setAttribute('aria-label', t('vars.name'));
      (nameField.querySelector('input') ?? nameField).setAttribute('data-focus', `name:${name}`);
      const valueField = numberField(value, (v) => set({ ...vars, [name]: v }));
      valueField.querySelector('input')?.setAttribute('aria-label', t('vars.valueOf', { name }));
      valueField.querySelector('input')?.setAttribute('data-focus', `value:${name}`);
      const del = el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('vars.remove', { name }), title: t('vars.remove', { name }) });
      del.innerHTML = icon('trash', 16);
      del.dataset.focus = `del:${name}`;
      del.addEventListener('click', () => {
        const { [name]: _gone, ...rest } = vars;
        set(rest);
      });
      return el('div', { class: 'vars-row' }, nameField, valueField, del);
    });
    const add = el('button', { type: 'button', class: 'icon-btn text-btn vars-add' });
    add.innerHTML = icon('plus', 16);
    add.append(t('vars.add'));
    add.dataset.focus = 'add';
    add.addEventListener('click', () => {
      let n = 1;
      while (`v${n}` in vars) n++;
      set({ ...vars, [`v${n}`]: 1 });
    });
    const done = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    done.dataset.focus = 'close';
    done.addEventListener('click', close);
    const head = el('div', { class: 'vars-row vars-head', 'aria-hidden': 'true' }, el('span', {}, t('vars.name')), el('span', {}, t('vars.value')), el('span', {}));
    const body = rows.length ? [head, ...rows] : [el('p', { class: 'mat-note' }, t('vars.empty'))];
    return el(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('vars.title') },
      el('h2', {}, t('vars.title')),
      el('div', { class: 'units-body' }, ...body, add, el('p', { class: 'mat-note', role: 'status' }, said || t('vars.note'))),
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), done),
    );
  });
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="add"]')?.focus();
}
