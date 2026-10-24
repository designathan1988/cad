// The optional first-use tour (ref/chat.txt:240): four stops, the tool bar, the properties panel,
// the footer and the command palette. A non-modal card beside each part (callout.ts), the part
// ringed, the rest of the page still visible (docs/adr/0002-ui-patterns.md): the focus moves into
// the card at each stop and Tab stays in it, Esc skips, each stop says in words where the part is.

import type { App } from '../app/app';
import { loadPrefs, savePrefs } from '../app/persist';
import { placeCallout } from './callout';
import { el } from './controls';
import { t, type MessageKey } from './i18n';

interface Stop {
  readonly target: (app: App) => HTMLElement;
  readonly title: MessageKey;
  readonly text: MessageKey;
}

export const TOUR: readonly Stop[] = [
  { target: (app) => app.shell.tools, title: 'tour.tools.title', text: 'tour.tools.text' },
  { target: (app) => app.shell.panel, title: 'tour.panel.title', text: 'tour.panel.text' },
  { target: (app) => app.shell.foot, title: 'tour.foot.title', text: 'tour.foot.text' },
  { target: (app) => app.shell.commands, title: 'tour.palette.title', text: 'tour.palette.text' },
];

let end: (() => void) | null = null;

export function startTour(app: App): void {
  end?.();
  offerCard?.remove();
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // The panel is one of the stops: shown for the tour, as it was afterwards.
  const panelWas = app.ui.panelOpen;
  if (!panelWas) app.togglePanel(true);
  const ring = el('div', { class: 'tour-ring', 'aria-hidden': 'true' });
  const title = el('h2', { id: 'tour-title' });
  const text = el('p', { id: 'tour-text' });
  const count = el('div', { class: 'tour-count', 'aria-live': 'polite' });
  const skip = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('tour.skip'));
  const prev = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('tour.prev'));
  const next = el('button', { type: 'button', class: 'icon-btn text-btn primary' });
  const card = el(
    'div',
    { class: 'tour-card', role: 'dialog', 'aria-labelledby': 'tour-title', 'aria-describedby': 'tour-text' },
    count,
    title,
    text,
    el('div', { class: 'actions' }, skip, el('span', { class: 'spacer' }), prev, next),
  );
  let at = 0;
  const show = () => {
    const stop = TOUR[at]!;
    title.textContent = t(stop.title);
    text.textContent = t(stop.text);
    count.textContent = t('tour.count', { i: at + 1, n: TOUR.length });
    prev.disabled = at === 0;
    next.textContent = at === TOUR.length - 1 ? t('tour.done') : t('tour.next');
    const r = stop.target(app).getBoundingClientRect();
    const target = { x: r.left, y: r.top, w: r.width, h: r.height };
    ring.hidden = r.width === 0 || r.height === 0;
    Object.assign(ring.style, { left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
    const p = placeCallout(target, { w: card.offsetWidth, h: card.offsetHeight }, { w: window.innerWidth, h: window.innerHeight });
    card.style.left = `${p.x}px`;
    card.style.top = `${p.y}px`;
    next.focus();
  };
  const finish = () => {
    ring.remove();
    card.remove();
    window.removeEventListener('resize', show);
    end = null;
    savePrefs({ tourSeen: true });
    if (!panelWas) app.togglePanel(false);
    back?.focus();
  };
  skip.addEventListener('click', finish);
  prev.addEventListener('click', () => {
    at = Math.max(0, at - 1);
    show();
  });
  next.addEventListener('click', () => {
    if (at === TOUR.length - 1) return finish();
    at++;
    show();
  });
  card.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') return finish();
    if (e.key !== 'Tab') return;
    // Tab goes round the card's buttons only.
    const buttons = [skip, prev, next].filter((b) => !b.disabled);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    e.preventDefault();
    buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]!.focus();
  });
  document.body.append(ring, card);
  window.addEventListener('resize', show);
  end = finish;
  show();
}

let offerCard: HTMLElement | null = null;

/** On the first visit only: a small card offering the tour; either answer is remembered. */
export function offerTour(app: App): void {
  if (loadPrefs().tourSeen) return;
  const go = el('button', { type: 'button', class: 'icon-btn text-btn primary' }, t('tour.start'));
  const later = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('tour.later'));
  const card = el(
    'div',
    { class: 'tour-offer', role: 'region', 'aria-label': t('tour.offerLabel') },
    el('p', {}, t('tour.offer')),
    el('div', { class: 'actions' }, later, go),
  );
  later.addEventListener('click', () => {
    savePrefs({ tourSeen: true });
    card.remove();
    offerCard = null;
  });
  go.addEventListener('click', () => startTour(app));
  app.shell.viewport.append(card);
  offerCard = card;
}
