// The diagnostics panel (F7): what is wrong with the model (app/diagnostics.ts), the console's errors
// (app/error-log.ts), how long the last drawing took, and the selection's raw values. A click on a
// problem selects its elements and frames them. Drawn again while open, after every render.

import type { App } from '../app/app';
import { type Diagnostic, nameOf } from '../app/diagnostics';
import { clearErrors, loggedErrors } from '../app/error-log';
import { referenceLength } from '../elements/opening/derive';
import { el } from './controls';
import { hasMessage, name, t } from './i18n';
import { icon } from './icons';

const f = (v: number) => v.toFixed(3);

export function renderDebugPanel(app: App, box: HTMLElement): void {
  const doc = app.store.get();
  const problems = app.diagnostics();
  const naming = { wall: (n: number) => t('wall.tag', { n }), opening: (k: string) => t(k === 'door' ? 'export.door' : 'export.window', { n: '' }).trim(), room: (s: string) => s };
  const kindText = (d: Diagnostic) => (hasMessage(`warn.${d.kind}`) ? t(`warn.${d.kind}` as never) : hasMessage(`debug.kind.${d.kind}`) ? t(`debug.kind.${d.kind}` as never) : d.kind);

  const close = el('button', { type: 'button', class: 'icon-btn', title: t('help.close'), 'aria-label': t('help.close') });
  close.innerHTML = icon('close', 16);
  close.addEventListener('click', () => app.toggleDebug(false));

  const frame = app.lastFrame;
  const summary = el(
    'div',
    { class: 'debug-section' },
    el('h3', {}, t('debug.summary')),
    el('p', {}, t('debug.counts', { walls: doc.walls.length, openings: doc.openings.length, rooms: doc.rooms.length, floors: doc.floors.length, levels: doc.levels.length, version: doc.version })),
    ...(frame ? [el('p', {}, t('debug.render', { ms: frame.total.toFixed(1), view: app.ui.view })), el('p', { class: 'debug-mono' }, frame.steps.map(([s, ms]) => `${s} ${ms.toFixed(1)}`).join(' · '))] : []),
  );

  const list = el('div', { class: 'debug-list' });
  if (problems.length === 0) list.append(el('p', { class: 'debug-ok' }, t('debug.none')));
  for (const d of problems) {
    const row = el('button', { type: 'button', class: `debug-row ${d.severity}` });
    row.append(
      el('span', { class: 'debug-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'debug-text' }, kindText(d)),
      el('span', { class: 'debug-ids' }, [d.ids.map((id) => nameOf(doc, id, naming)).join(', '), d.detail ?? ''].filter(Boolean).join(' · ')),
    );
    row.addEventListener('click', () => app.showElements(d.ids));
    list.append(row);
  }

  const errors = loggedErrors();
  const clear = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('debug.clear'));
  clear.addEventListener('click', () => clearErrors());
  const errorList = el(
    'div',
    { class: 'debug-list' },
    ...(errors.length === 0 ? [el('p', { class: 'debug-ok' }, t('debug.noErrors'))] : errors.slice(-10).reverse().map((e) => el('pre', { class: 'debug-error' }, `${new Date(e.at).toLocaleTimeString()}  ${e.text}`))),
  );

  // The selection's raw values: what the panel rounds, in full.
  const sel = [...app.ui.selection].slice(0, 6).map((id) => {
    const w = doc.walls.find((x) => x.id === id);
    if (w) {
      const s = app.geometry.solids.get(id);
      return `${t('wall.tag', { n: 0 }).replace(/\s*0$/, '')} ${id}\n  (${f(w.start.x)}, ${f(w.start.y)}) → (${f(w.end.x)}, ${f(w.end.y)})  ${f(referenceLength(w))} m${w.bulge ? `  bulge ${w.bulge}` : ''}\n  ${w.wallTypeId} · ${w.referenceLine} · ${s?.pieces.length ?? 0} pieces · ${s ? f(s.bottom) : '?'}–${s ? f(s.top) : '?'} m${w.joins ? `  joins ${JSON.stringify(w.joins)}` : ''}`;
    }
    const o = doc.openings.find((x) => x.id === id);
    if (o) {
      const p = app.geometry.openings.get(id);
      return `${o.kind} ${id} on ${o.wallId}\n  ${o.width}×${o.height} sill ${o.sill} · ${JSON.stringify(o.rule)}\n  jambs ${p ? `${f(p.start)}–${f(p.end)}` : '?'} · ${p?.valid ? 'valid' : 'invalid'} ${p?.warnings.join(' ') ?? ''}`;
    }
    const r = doc.rooms.find((x) => x.id === id);
    if (r) {
      const s = app.geometry.rooms.get(id);
      return `room ${id} ${r.number} · ${name(r.name)}\n  seed (${f(r.seed.x)}, ${f(r.seed.y)}) · ${s?.enclosed ? `${f(s.area)} m², ${s.outline.length} corners` : 'not enclosed'}`;
    }
    return id;
  });

  box.replaceChildren(
    el('div', { class: 'panel-head' }, el('span', { class: 'panel-title' }, t('debug.title')), el('span', { class: 'debug-hint' }, t('debug.hint')), close),
    summary,
    el('div', { class: 'debug-section' }, el('h3', {}, t('debug.problems', { n: problems.length })), list),
    el('div', { class: 'debug-section' }, el('h3', {}, t('debug.errors', { n: errors.length }), errors.length > 0 ? clear : el('span')), errorList),
    el('div', { class: 'debug-section' }, el('h3', {}, t('debug.selection')), sel.length === 0 ? el('p', { class: 'debug-ok' }, t('debug.noSelection')) : el('pre', { class: 'debug-mono' }, sel.join('\n'))),
  );
}
