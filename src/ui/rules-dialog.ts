// The norms dialog: the project's rules (rules/schema.ts) by pack (a norm's or a law's, where it holds,
// its edition), each on or off, its bounds (a lot rule's the lot's), its source and article, how grave
// it is, the room uses it holds for; a rule added or deleted; packs exported and imported as files; and
// what in the model is outside them, each one a button that selects and frames it. Every change is one
// command; the list is checked again at once.

import type { App } from '../app/app';
import { LOT_ELEMENT, lotBounds, type Finding } from '../rules/check';
import { addRule, deleteRule, importPacks, resetRules, updateRule } from '../rules/commands';
import { isRule, isRulePack, packsOf, ROOM_SUBJECTS, type Rule, RULE_SUBJECTS, type RuleSubject, rulesOf, SUBJECT_UNIT } from '../rules/schema';
import { ROOM_USES, type RoomUse } from '../elements/room/schema';
import { el, numberField, select } from './controls';
import { openProjectDialog } from './dialog';
import { num, t } from './i18n';
import { icon } from './icons';

/** A measure as the rules show it: a grade or a share in %, a step's sizes in cm, areas in m², a ratio bare, the rest in metres. */
export function ruleValue(subject: RuleSubject, v: number): string {
  const unit = SUBJECT_UNIT[subject];
  if (unit === '%') return `${num(v, 2)} %`;
  if (unit === 'm2') return `${num(v, 2)} m²`;
  if (unit === 'x') return num(v, 2);
  return v < 1 ? `${num(v * 100, 1)} cm` : `${num(v, 2)} m`;
}

/** "≥ 2,50 m", "16,0 cm–18,0 cm": the bounds a measure was held to. */
export function rangeText(subject: RuleSubject, min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${ruleValue(subject, min)}–${ruleValue(subject, max)}`;
  if (min !== undefined) return `≥ ${ruleValue(subject, min)}`;
  if (max !== undefined) return `≤ ${ruleValue(subject, max)}`;
  return '—';
}

/** A rule's source with its article: "Lei 16.402/2016 (LPUOS), Quadro 3". */
export const citation = (rule: Rule): string => (rule.article ? `${rule.source}, ${rule.article}` : rule.source);

/** "17,5 cm (16,0 cm–18,0 cm), NBR 9050": what a finding says. */
export function findingText(f: Finding): string {
  const { rule } = f;
  return t('rules.finding', { what: t(`rules.subject.${rule.subject}`), value: ruleValue(rule.subject, f.value), range: rangeText(rule.subject, f.min, f.max), source: citation(rule) });
}

/** The side a lot parameter bounds its measure from. */
const SUBJECT_SIDE: Partial<Record<RuleSubject, 'min' | 'max'>> = {
  lotOccupancy: 'max',
  lotFloorRatio: 'max',
  lotPermeability: 'min',
  setbackFront: 'min',
  setbackSide: 'min',
  setbackBack: 'min',
  buildingHeight: 'max',
};

/** A text field that commits on Enter or on leaving it; its whole text in its tooltip, as a narrow one cuts it. */
function textCommit(value: string, label: string, commit: (v: string) => void): HTMLInputElement {
  const f = el('input', { type: 'text', class: 'text-field', 'aria-label': label, title: value });
  f.value = value;
  f.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      f.blur();
    }
  });
  f.addEventListener('blur', () => {
    if (f.value.trim() !== value) commit(f.value.trim());
  });
  return f;
}

export function showRules(app: App): void {
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void importPackFile(app, file);
  });
  let newSubject: RuleSubject = 'roomArea';
  let newPack = '';
  // Where the list of rules was scrolled to: every change draws the dialog anew, and the list went
  // back to its top, away from the rule just changed.
  let scrolled = 0;
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const rules = rulesOf(doc);
    const lotBound = lotBounds(doc);
    const packs = packsOf(doc);
    const grid = el('div', { class: 'rules' });
    const head = () =>
      grid.append(
        ...['rules.on', 'rules.what', 'rules.min', 'rules.max', 'rules.source', 'rules.article', 'rules.severity', ''].map((k) => el('span', { class: 'levels-head' }, k ? t(k as 'rules.on') : '')),
      );
    const row = (r: Rule) => {
      const what = t(`rules.subject.${r.subject}`);
      const on = el('input', { type: 'checkbox', 'aria-label': `${t('rules.on')}: ${what}` });
      on.checked = r.on;
      on.addEventListener('change', () => app.store.dispatch(updateRule(r.id, { on: on.checked })));
      const unit = SUBJECT_UNIT[r.subject];
      // A bound: its field; for a lot rule that takes the lot's, the lot's value on the side it bounds
      // (an occupancy from above, a setback from below), or a dash to add one.
      const bound = (key: 'min' | 'max') => {
        const v = r[key];
        if (r.fromLot && r.min === undefined && r.max === undefined) {
          const lot = lotBound(r.subject);
          const side = SUBJECT_SIDE[r.subject];
          if (side !== key) return el('span', { class: 'rules-none' }, '—');
          const given = lot[key];
          return el('span', { class: 'rules-none', title: t('rules.fromLotTip') }, given === undefined ? t('rules.fromLotEmpty') : t('rules.fromLotValue', { v: ruleValue(r.subject, given) }));
        }
        if (v === undefined) {
          const add = el('button', { type: 'button', class: 'icon-btn text-btn rules-add', 'aria-label': `${t(`rules.${key}`)}: ${what}` }, '+');
          add.addEventListener('click', () => app.store.dispatch(updateRule(r.id, { [key]: 0 })));
          return add;
        }
        const f = numberField(v, (x) => app.store.dispatch(updateRule(r.id, { [key]: x })), 0, unit === 'm' ? 3 : 2, unit === 'm2' ? 'm²' : unit === 'x' ? '' : unit);
        f.querySelector('input')!.setAttribute('aria-label', `${t(`rules.${key}`)}: ${what}`);
        return f;
      };
      // A room rule: the uses it holds for, under its name, chosen in a list of boxes (none: every room).
      const name = el('span', { class: r.on ? 'rules-what' : 'rules-what rules-off' }, what);
      if (ROOM_SUBJECTS.includes(r.subject)) {
        const chosen = r.uses ?? [];
        const said = chosen.length > 0 ? chosen.map((u) => t(`use.${u}`)).join(', ') : t('rules.allRooms');
        const boxes = ROOM_USES.map((u: RoomUse) => {
          const box = el('input', { type: 'checkbox' });
          box.checked = chosen.includes(u);
          box.addEventListener('change', () => {
            const next = ROOM_USES.filter((x) => (x === u ? box.checked : chosen.includes(x)));
            app.store.dispatch(updateRule(r.id, { uses: next }));
          });
          return el('label', { class: 'rules-use' }, box, t(`use.${u}`));
        });
        name.append(el('details', { class: 'rules-uses' }, el('summary', {}, said), ...boxes));
      }
      const severity = select(
        [
          { value: 'warning', label: t('rules.warning') },
          { value: 'error', label: t('rules.error') },
        ],
        r.severity ?? 'warning',
        (v) => app.store.dispatch(updateRule(r.id, { severity: v as 'error' | 'warning' })),
      );
      severity.querySelector('select')!.setAttribute('aria-label', `${t('rules.severity')}: ${what}`);
      const del = el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('rules.delete', { what }) });
      del.innerHTML = icon('trash', 14);
      del.addEventListener('click', () => app.store.dispatch(deleteRule(r.id)));
      grid.append(
        on,
        name,
        bound('min'),
        bound('max'),
        textCommit(r.source, `${t('rules.source')}: ${what}`, (v) => app.store.dispatch(updateRule(r.id, { source: v }))),
        textCommit(r.article ?? '', `${t('rules.article')}: ${what}`, (v) => app.store.dispatch(updateRule(r.id, { article: v }))),
        severity,
        del,
      );
    };
    // Pack by pack, then the project's own (in no pack, or in one it does not have).
    const groups = [...packs.map((p) => ({ pack: p, list: rules.filter((r) => r.pack === p.id) })), { pack: null, list: rules.filter((r) => !packs.some((p) => p.id === r.pack)) }];
    for (const { pack, list } of groups) {
      if (list.length === 0) continue;
      const where = pack ? [t(`rules.juris.${pack.jurisdiction}`), pack.place, pack.version].filter(Boolean).join(' · ') : '';
      grid.append(el('div', { class: 'rules-pack' }, el('strong', {}, pack ? pack.name : t('rules.ownPack')), ...(where ? [el('span', {}, where)] : [])));
      head();
      for (const r of list) row(r);
    }
    // A new rule: what it measures, in which pack.
    const subject = select(
      RULE_SUBJECTS.map((s) => ({ value: s, label: t(`rules.subject.${s}`) })),
      newSubject,
      (v) => (newSubject = v as RuleSubject),
    );
    subject.querySelector('select')!.setAttribute('aria-label', t('rules.newWhat'));
    const pack = select([{ value: '', label: t('rules.ownPack') }, ...packs.map((p) => ({ value: p.id, label: p.name }))], newPack, (v) => (newPack = v));
    pack.querySelector('select')!.setAttribute('aria-label', t('rules.newPack'));
    const add = el('button', { type: 'button', class: 'btn' }, t('rules.add'));
    add.addEventListener('click', () => app.store.dispatch(addRule(newSubject, newPack || undefined, packs.find((p) => p.id === newPack)?.name ?? '')));
    const adding = el('div', { class: 'rules-new' }, subject, pack, add);
    // What is outside the rules now: each selects and frames its element (the lot's opens the lot).
    const findings = app.normFindings();
    const list = el('div', { class: 'rules-findings', role: 'list' });
    if (findings.length === 0) list.append(el('p', { class: 'tour-empty' }, t('rules.none')));
    for (const f of findings) {
      const b = el('button', { type: 'button', class: 'rules-finding', role: 'listitem' });
      b.innerHTML = icon('warning', 14);
      const whose = app.reportTitle(f.elementId);
      b.append(el('span', {}, `${whose}: ${findingText(f)}`));
      b.addEventListener('click', () => {
        close();
        if (f.elementId === LOT_ELEMENT) return app.openLot();
        app.ui.selection = new Set([f.elementId]);
        app.showElementLevel(f.elementId);
        app.frameSelection();
      });
      list.append(b);
    }
    const btn = (label: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'icon-btn text-btn' }, label);
      b.addEventListener('click', run);
      return b;
    };
    const reset = btn(t('rules.reset'), () => app.store.dispatch(resetRules()));
    const exportBtn = btn(t('rules.export'), () => {
      const text = JSON.stringify({ cad2Rules: 1, packs, rules }, null, 2);
      app.download(`${app.fileBase()}-normas.json`, new Blob([text], { type: 'application/json' }), 'application/json');
    });
    const importBtn = btn(t('rules.import'), () => fileInput.click());
    const report = btn(t('rules.report'), () => app.downloadCompliance());
    const closeBtn = btn(t('help.close'), close);
    closeBtn.dataset.focus = 'close';
    const scroller = el('div', { class: 'rules-scroll' }, grid, adding);
    scroller.addEventListener('scroll', () => (scrolled = scroller.scrollTop));
    requestAnimationFrame(() => (scroller.scrollTop = scrolled));
    return el(
      'div',
      { class: 'dialog dialog-xl', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('rules.title') },
      el('h2', {}, t('rules.title')),
      el('p', { class: 'tour-empty' }, t('rules.intro')),
      scroller,
      el('h3', { class: 'rules-title' }, t('rules.findings', { n: findings.length })),
      list,
      el('div', { class: 'actions' }, reset, exportBtn, importBtn, fileInput, el('span', { class: 'spacer' }), report, closeBtn),
    );
  };
  openProjectDialog(app, render);
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}

/** A pack file read in: its valid packs and rules, replacing the packs of the same id; what was done, said. */
async function importPackFile(app: App, file: File): Promise<void> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch (e) {
    app.toast(t('rules.importBad', { error: e instanceof Error ? e.message : String(e) }));
    return;
  }
  const x = raw as { packs?: unknown; rules?: unknown } | null;
  if (!x || !Array.isArray(x.packs) || !Array.isArray(x.rules)) {
    app.toast(t('rules.importBad', { error: t('rules.importNoPacks') }));
    return;
  }
  const packs = x.packs.filter(isRulePack);
  const rules = x.rules.filter(isRule);
  app.store.dispatch(importPacks(packs, rules));
  app.toast(t('rules.imported', { packs: packs.length, rules: rules.length, bad: x.packs.length - packs.length + x.rules.length - rules.length }));
}

