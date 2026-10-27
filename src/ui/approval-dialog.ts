// The approval dialog (approval/schema.ts): the journey from the land to the registry, step by step its
// documents, who issues each, its state and note, and the office's estimate of its time and cost; what
// cad2 makes, made with a click; steps and documents added or taken off; the journey as a page, and
// the project's folder as a ZIP (app/project-folder.ts). Every change is one command.

import type { App } from '../app/app';
import { downloadFolder, generateDocument } from '../app/project-folder';
import { addDoc, addStep, deleteDoc, deleteStep, setCity, updateDoc, updateStep } from '../approval/commands';
import { approvalOf, DOC_STATES, type DocState, progressOf } from '../approval/schema';
import { approvalHtml } from '../app/documents';
import { el, numberField, select } from './controls';
import { openProjectDialog } from './dialog';
import { getLang, num, t } from './i18n';
import { icon } from './icons';

/** A text field committed on Enter or on leaving it. */
function textCommit(value: string, label: string, commit: (v: string) => void, placeholder = ''): HTMLInputElement {
  const f = el('input', { type: 'text', class: 'text-field', 'aria-label': label, title: value, placeholder });
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

export function showApproval(app: App): void {
  let scrolled = 0;
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const a = approvalOf(doc);
    const p = progressOf(a);
    const btn = (label: string, run: () => void, cls = 'icon-btn text-btn') => {
      const b = el('button', { type: 'button', class: cls }, label);
      b.addEventListener('click', run);
      return b;
    };
    const trash = (label: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'icon-btn', 'aria-label': label });
      b.innerHTML = icon('trash', 14);
      b.addEventListener('click', run);
      return b;
    };
    const steps = a.steps.map((s, i) => {
      const head = el(
        'div',
        { class: 'approval-step-head' },
        el('strong', {}, `${i + 1}.`),
        textCommit(s.name, t('approval.step'), (v) => app.store.dispatch(updateStep(s.id, { name: v }))),
        el('label', { class: 'approval-est' }, el('span', {}, t('approval.daysLabel')), numberField(s.days ?? null, (v) => app.store.dispatch(updateStep(s.id, { days: v })), 0, 0, '')),
        el('label', { class: 'approval-est' }, el('span', {}, t('approval.costLabel')), numberField(s.cost ?? null, (v) => app.store.dispatch(updateStep(s.id, { cost: v })), 0, 2, 'R$')),
        trash(t('approval.deleteStep', { name: s.name }), () => app.store.dispatch(deleteStep(s.id))),
      );
      // An empty estimate shows a dash, not the panel's "varies".
      head.querySelectorAll<HTMLInputElement>('.num-field input').forEach((x) => (x.placeholder = '—'));
      const rows = s.docs.map((d) => {
        const state = select(
          DOC_STATES.map((x) => ({ value: x, label: t(`approval.state.${x}`) })),
          d.state,
          (v) => app.store.dispatch(updateDoc(s.id, d.id, { state: v as DocState })),
        );
        state.querySelector('select')!.setAttribute('aria-label', `${t('approval.state')}: ${d.name}`);
        return el(
          'tr',
          { class: `approval-${d.state}` },
          el('td', {}, textCommit(d.name, t('approval.doc'), (v) => app.store.dispatch(updateDoc(s.id, d.id, { name: v })))),
          el('td', {}, textCommit(d.issuer, t('approval.issuer'), (v) => app.store.dispatch(updateDoc(s.id, d.id, { issuer: v })))),
          el('td', {}, state),
          el('td', {}, textCommit(d.note ?? '', t('approval.note'), (v) => app.store.dispatch(updateDoc(s.id, d.id, { note: v || undefined })), t('approval.notePh'))),
          el('td', {}, ...(d.generated ? [btn(t('approval.make'), () => void generateDocument(app, d.generated!), 'btn approval-make')] : [])),
          el('td', {}, trash(t('approval.deleteDoc', { name: d.name }), () => app.store.dispatch(deleteDoc(s.id, d.id)))),
        );
      });
      const table = el(
        'table',
        { class: 'schedule-table approval-docs' },
        el('thead', {}, el('tr', {}, ...['approval.doc', 'approval.issuer', 'approval.state', 'approval.note', '', ''].map((k) => el('th', {}, k ? t(k as 'approval.doc') : '')))),
        el('tbody', {}, ...rows),
      );
      return el('section', { class: 'approval-step' }, head, table, btn(t('approval.addDoc'), () => app.store.dispatch(addDoc(s.id, t('approval.newDoc')))));
    });
    const scroller = el('div', { class: 'approval-scroll' }, ...steps, btn(t('approval.addStep'), () => app.store.dispatch(addStep(t('approval.newStep')))));
    scroller.addEventListener('scroll', () => (scrolled = scroller.scrollTop));
    requestAnimationFrame(() => (scroller.scrollTop = scrolled));
    const summary = el(
      'div',
      { class: 'approval-summary' },
      el('label', { class: 'approval-est' }, el('span', {}, t('approval.city')), textCommit(a.city, t('approval.city'), (v) => app.store.dispatch(setCity(v)))),
      el('span', {}, t('approval.progress', { done: p.done, all: p.all })),
      ...(p.days || p.cost ? [el('span', {}, t('approval.estimates', { days: p.days, cost: num(p.cost, 2) }))] : []),
    );
    const page = btn(t('approval.page'), () => {
      const today = new Date().toLocaleDateString(getLang() === 'pt' ? 'pt-BR' : 'en-GB');
      const file = `${app.fileBase()} - ${t('approval.title')}.html`;
      app.download(file, new Blob([approvalHtml(doc, today)], { type: 'text/html' }), 'text/html');
      app.toast(t('schedule.saved', { file }));
    });
    const folder = btn(t('approval.folderMake'), () => void downloadFolder(app), 'btn');
    const closeBtn = btn(t('help.close'), close);
    closeBtn.dataset.focus = 'close';
    return el(
      'div',
      { class: 'dialog dialog-xl budget-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('approval.title') },
      el('h2', {}, t('approval.title')),
      el('p', { class: 'tour-empty' }, t('approval.intro')),
      summary,
      scroller,
      el('div', { class: 'actions' }, page, el('span', { class: 'spacer' }), folder, closeBtn),
    );
  };
  openProjectDialog(app, render);
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}
