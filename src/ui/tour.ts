// The optional first-use tour (ref/chat.txt:240): five stops, the tool bar, the edit tools, the
// properties panel, the footer and the command palette. A non-modal card beside each part (callout.ts), the part
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
  { target: (app) => app.shell.editTools, title: 'tour.edit.title', text: 'tour.edit.text' },
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
  // The rest of the page dimmed by four bands around the part shown (a huge shadow on the ring left
  // the footer bright in Chrome).
  const bands = [0, 1, 2, 3].map(() => el('div', { class: 'tour-scrim', 'aria-hidden': 'true' }));
  const title = el('h2', { id: 'tour-title' });
  const text = el('p', { id: 'tour-text' });
  const count = el('div', { class: 'tour-count', 'aria-live': 'polite' });
  const skip = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('tour.skip'));
  const prev = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('tour.prev'));
  const next = el('button', { type: 'button', class: 'icon-btn text-btn primary' });
  const card = el(
    'div',
    // Named directly (and per stop in show()): some readers missed the name by reference.
    { class: 'tour-card', role: 'dialog', 'aria-label': t('tour.offerLabel'), 'aria-describedby': 'tour-text' },
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
    const W = window.innerWidth;
    const H = window.innerHeight;
    // Inside the window: around a part at its edge (the tool bar, the panel, the footer) the ring went
    // past it and showed on one side only.
    const x0 = Math.max(0, r.left - 3);
    const y0 = Math.max(0, r.top - 3);
    const x1 = Math.min(W, r.right + 3);
    const y1 = Math.min(H, r.bottom + 3);
    Object.assign(ring.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    // Above, below, left and right of the ring; with no target, one band over everything.
    const rects = ring.hidden
      ? [[0, 0, W, H], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
      : [[0, 0, W, y0], [0, y1, W, H - y1], [0, y0, x0, y1 - y0], [x1, y0, W - x1, y1 - y0]];
    bands.forEach((b, i) => {
      const [x, y, w, h] = rects[i]!;
      Object.assign(b.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, w!)}px`, height: `${Math.max(0, h!)}px` });
    });
    card.setAttribute('aria-label', `${t(stop.title)} · ${t('tour.count', { i: at + 1, n: TOUR.length })}`);
    const p = placeCallout(target, { w: card.offsetWidth, h: card.offsetHeight }, { w: window.innerWidth, h: window.innerHeight });
    card.style.left = `${p.x}px`;
    card.style.top = `${p.y}px`;
    next.focus();
  };
  const finish = () => {
    ring.remove();
    bands.forEach((b) => b.remove());
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
  document.body.append(...bands, ring, card);
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
