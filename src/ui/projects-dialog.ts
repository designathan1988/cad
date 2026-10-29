// The projects kept in the browser (app/projects.ts): each one's name (renamed in place), when it was
// changed and how big it is, opening, duplicating and deleting it (asked first: it cannot be undone),
// and a new one. The open one is marked and first.

import type { App } from '../app/app';
import { deleteStoredProject, duplicateProject, newStoredProject, openStoredProject, projectsList, renameStoredProject } from '../app/projects';
import type { ProjectInfo } from '../io/project-db';
import { el } from './controls';
import { getLang, t } from './i18n';
import { icon } from './icons';

export function showProjectsDialog(app: App): void {
  const back = app.shell.helpBack;
  const db = app.db;
  let list: ProjectInfo[] = [];
  let asking: ProjectInfo | null = null;
  const close = () => {
    back.hidden = true;
    back.replaceChildren();
    window.removeEventListener('keydown', onKey, true);
    app.shell.sidebar.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (asking) {
      asking = null;
      draw();
    } else close();
  };
  const when = (ms: number) => new Date(ms).toLocaleString(getLang() === 'pt' ? 'pt-BR' : 'en', { dateStyle: 'short', timeStyle: 'short' });
  const refresh = async () => {
    if (db) list = await projectsList(db);
    draw();
  };
  const button = (text: string, focus: string, run: () => void, cls = 'icon-btn text-btn') => {
    const b = el('button', { type: 'button', class: cls }, text);
    b.dataset.focus = focus;
    b.addEventListener('click', run);
    return b;
  };
  const draw = () => {
    const a = document.activeElement;
    const key = a instanceof HTMLElement && back.contains(a) ? a.dataset.focus : undefined;
    const body: HTMLElement[] = [];
    if (!db) body.push(el('p', { class: 'dialog-empty' }, t('projects.unavailable')));
    else if (asking) {
      const p = asking;
      body.push(
        el('p', { class: 'dialog-ask' }, t('projects.confirmDelete', { name: p.name || t('app.untitled') })),
        el(
          'div',
          { class: 'actions' },
          el('span', { class: 'spacer' }),
          button(t('projects.cancel'), 'cancel', () => {
            asking = null;
            draw();
          }),
          button(
            t('projects.yesDelete'),
            'yes',
            () => {
              asking = null;
              void deleteStoredProject(app, db, p.id).then(refresh);
            },
            'icon-btn text-btn danger',
          ),
        ),
      );
    } else if (list.length === 0) body.push(el('p', { class: 'dialog-empty' }, t('projects.none')));
    else {
      const rows = el('div', { class: 'projects-rows' });
      // The open one first, then the last changed.
      const sorted = [...list].sort((x, y) => Number(y.id === app.projectId) - Number(x.id === app.projectId));
      for (const p of sorted) {
        const label = p.name || t('app.untitled');
        const open = p.id === app.projectId;
        const name = el('input', { type: 'text', class: 'text-field', 'aria-label': t('projects.name', { name: label }) });
        name.value = p.name;
        name.placeholder = t('app.untitled');
        name.dataset.focus = `name:${p.id}`;
        name.addEventListener('keydown', (e: Event) => {
          if (!(e instanceof KeyboardEvent)) return;
          if (e.key === 'Enter') {
            e.stopPropagation();
            name.blur();
          }
        });
        name.addEventListener('blur', () => {
          if (name.value.trim() !== p.name) void renameStoredProject(app, db, p.id, name.value).then(refresh);
        });
        const info = el('span', { class: 'projects-info' }, `${t('projects.changed', { when: when(p.updatedAt) })} · ${t('projects.elements', { n: p.count })}`);
        const openBtn = open
          ? el('span', { class: 'projects-open' }, t('projects.openNow'))
          : button(t('projects.open'), `open:${p.id}`, () => void openStoredProject(app, db, p.id).then((ok) => (ok ? close() : refresh())));
        const dup = el('button', { type: 'button', class: 'icon-btn', title: t('projects.duplicate', { name: label }), 'aria-label': t('projects.duplicate', { name: label }) });
        dup.innerHTML = icon('copy', 16);
        dup.dataset.focus = `dup:${p.id}`;
        dup.addEventListener('click', () => void duplicateProject(app, db, p.id).then(refresh));
        const del = el('button', { type: 'button', class: 'icon-btn', title: t('projects.delete', { name: label }), 'aria-label': t('projects.delete', { name: label }) });
        del.innerHTML = icon('trash', 16);
        del.dataset.focus = `del:${p.id}`;
        del.addEventListener('click', () => {
          asking = p;
          draw();
        });
        rows.append(el('div', { class: `projects-row${open ? ' current' : ''}` }, name, info, openBtn, dup, del));
      }
      body.push(rows);
    }
    const actions = asking
      ? []
      : [
          el(
            'div',
            { class: 'actions' },
            ...(db ? [button(t('projects.new'), 'new', () => void newStoredProject(app, db).then(close))] : []),
            el('span', { class: 'spacer' }),
            button(t('help.close'), 'close', close),
          ),
        ];
    back.replaceChildren(el('div', { class: 'dialog dialog-wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('projects.title') }, el('h2', {}, t('projects.title')), ...body, ...actions));
    back.hidden = false;
    const target = (key && back.querySelector<HTMLElement>(`[data-focus="${key}"]`)) || back.querySelector<HTMLElement>(asking ? '[data-focus="cancel"]' : '[data-focus="close"]');
    target?.focus();
  };
  window.addEventListener('keydown', onKey, true);
  draw();
  void refresh();
}
