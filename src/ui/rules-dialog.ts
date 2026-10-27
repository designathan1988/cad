// The norms dialog: the project's rules (rules/schema.ts), each on or off, its bounds and its source,
// and what in the model is outside them, each one a button that selects and frames it. Every change is
// one command; the list is checked again at once.

import type { App } from '../app/app';
import { resetRules, updateRule } from '../rules/commands';
import type { Finding } from '../rules/check';
import { type RuleSubject, rulesOf, SUBJECT_UNIT } from '../rules/schema';
import { el, numberField } from './controls';
import { openProjectDialog } from './dialog';
import { num, t } from './i18n';
import { icon } from './icons';

/** A measure as the rules show it: a grade in %, a step's sizes in cm, the rest in metres. */
export function ruleValue(subject: RuleSubject, v: number): string {
  if (SUBJECT_UNIT[subject] === '%') return `${num(v, 2)} %`;
  return v < 1 ? `${num(v * 100, 1)} cm` : `${num(v, 2)} m`;
}

/** "17,5 cm (16,0 cm–18,0 cm), NBR 9050": what a finding says. */
export function findingText(f: Finding): string {
  const { rule } = f;
  const range =
    rule.min !== undefined && rule.max !== undefined
      ? `${ruleValue(rule.subject, rule.min)}–${ruleValue(rule.subject, rule.max)}`
      : rule.min !== undefined
        ? `≥ ${ruleValue(rule.subject, rule.min)}`
        : `≤ ${ruleValue(rule.subject, rule.max!)}`;
  return t('rules.finding', { what: t(`rules.subject.${rule.subject}`), value: ruleValue(rule.subject, f.value), range, source: rule.source });
}

export function showRules(app: App): void {
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const grid = el('div', { class: 'rules' });
    grid.append(
      el('span', { class: 'levels-head' }, t('rules.on')),
      el('span', { class: 'levels-head' }, t('rules.what')),
      el('span', { class: 'levels-head' }, t('rules.min')),
      el('span', { class: 'levels-head' }, t('rules.max')),
      el('span', { class: 'levels-head' }, t('rules.source')),
    );
    for (const r of rulesOf(doc)) {
      const what = t(`rules.subject.${r.subject}`);
      const on = el('input', { type: 'checkbox', 'aria-label': `${t('rules.on')}: ${what}` });
      on.checked = r.on;
      on.addEventListener('change', () => app.store.dispatch(updateRule(r.id, { on: on.checked })));
      const unit = SUBJECT_UNIT[r.subject];
      const bound = (v: number | undefined, key: 'min' | 'max') => {
        if (v === undefined) return el('span', { class: 'rules-none' }, '—');
        const f = numberField(v, (x) => app.store.dispatch(updateRule(r.id, { [key]: x })), 0, unit === '%' ? 2 : 3, unit);
        f.querySelector('input')!.setAttribute('aria-label', `${t(`rules.${key}`)}: ${what}`);
        return f;
      };
      const source = el('input', { type: 'text', class: 'text-field', 'aria-label': `${t('rules.source')}: ${what}` });
      source.value = r.source;
      source.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          source.blur();
        }
      });
      source.addEventListener('blur', () => {
        if (source.value.trim() !== r.source) app.store.dispatch(updateRule(r.id, { source: source.value.trim() }));
      });
      grid.append(on, el('span', { class: r.on ? '' : 'rules-off' }, what), bound(r.min, 'min'), bound(r.max, 'max'), source);
    }
    // What is outside the rules now: each selects and frames its element.
    const findings = app.normFindings();
    const list = el('div', { class: 'rules-findings', role: 'list' });
    if (findings.length === 0) list.append(el('p', { class: 'tour-empty' }, t('rules.none')));
    for (const f of findings) {
      const b = el('button', { type: 'button', class: 'rules-finding', role: 'listitem' });
      b.innerHTML = icon('warning', 14);
      b.append(el('span', {}, `${app.elementTitle(f.elementId)}: ${findingText(f)}`));
      b.addEventListener('click', () => {
        close();
        app.ui.selection = new Set([f.elementId]);
        app.showElementLevel(f.elementId);
        app.frameSelection();
      });
      list.append(b);
    }
    const reset = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('rules.reset'));
    reset.addEventListener('click', () => app.store.dispatch(resetRules()));
    const closeBtn = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    closeBtn.dataset.focus = 'close';
    closeBtn.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('rules.title') },
      el('h2', {}, t('rules.title')),
      el('p', { class: 'tour-empty' }, t('rules.intro')),
      grid,
      el('h3', { class: 'rules-title' }, t('rules.findings', { n: findings.length })),
      list,
      el('div', { class: 'actions' }, reset, el('span', { class: 'spacer' }), closeBtn),
    );
  };
  openProjectDialog(app, render);
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}
