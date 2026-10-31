// One tooltip for the whole interface (ref/chat.txt:247): any element with a title shows it in a
// small card near it, after a short pause on hover or at once on keyboard focus, in the design's
// colours, inside the window. The title moves to data-tip the first time, so the browser's own
// tooltip never shows as well; elements keep their accessible name (aria-label) as set, and the text
// moved stays theirs for assistive technology (aria-description). The card can be hovered: the pointer
// moved onto it keeps it (WCAG 1.4.13), a moment given to cross the gap.

const DELAY_MS = 450;
/** How long a card waits after the pointer leaves its element or itself, for the pointer to reach the other. */
const GRACE_MS = 200;

export function installTooltips(root: HTMLElement = document.body): void {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);
  let timer = 0;
  let leaving = 0;
  let current: HTMLElement | null = null;

  const textOf = (el: HTMLElement): string | null => {
    if (el.title) {
      el.dataset.tip = el.title;
      el.removeAttribute('title');
      // Taken off the title, it was gone for screen readers (the reason a button cannot act, a full name cut
      // short): kept as the element's description, unless it has its own, or the text is its name already.
      if (!el.hasAttribute('aria-describedby') && el.getAttribute('aria-label') !== el.dataset.tip) el.setAttribute('aria-description', el.dataset.tip);
    }
    return el.dataset.tip ?? null;
  };
  const show = (el: HTMLElement) => {
    const text = textOf(el);
    if (!text || !el.isConnected) return;
    current = el;
    tip.textContent = text;
    tip.hidden = false;
    // Measured at the window's corner: where it last was (near an edge) it would wrap to fit there.
    tip.style.left = '0px';
    tip.style.top = '0px';
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    // Beside a tall narrow thing (the tool bar), under the rest; always inside the window.
    const beside = r.height > r.width * 0.8 && r.left < 80;
    // The drawing's corner panel, a column at the right: its tips to its left, not over the icon below.
    const leftOf = el.closest('.view-corner') !== null;
    let x = leftOf ? r.left - w - 8 : beside ? r.right + 8 : r.left + r.width / 2 - w / 2;
    let y = beside || leftOf ? r.top + r.height / 2 - h / 2 : r.bottom + 6;
    if (y + h > window.innerHeight - 4) y = r.top - h - 6;
    x = Math.max(4, Math.min(x, window.innerWidth - w - 4));
    y = Math.max(4, y);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };
  const hide = () => {
    clearTimeout(timer);
    clearTimeout(leaving);
    tip.hidden = true;
    current = null;
  };
  const hideSoon = () => {
    clearTimeout(leaving);
    leaving = window.setTimeout(hide, GRACE_MS);
  };
  tip.addEventListener('pointerenter', () => clearTimeout(leaving));
  // Over another control under the card (a tool bar's card lies over the next tools): the card gives way,
  // so that control is reached and clicked, not the card.
  tip.addEventListener('pointermove', (e) => {
    const under = document.elementsFromPoint(e.clientX, e.clientY).find((x) => !tip.contains(x)) ?? null;
    const other = owner(under);
    if (other && other !== current) hide();
  });
  tip.addEventListener('pointerleave', (e) => {
    if (current && e.relatedTarget instanceof Node && current.contains(e.relatedTarget)) return;
    hideSoon();
  });
  const owner = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? (target.closest('[title], [data-tip]') as HTMLElement | null) : null;

  root.addEventListener('pointerover', (e) => {
    // Over the card itself: it stays (its own pointerenter keeps it).
    if (e.target instanceof Node && tip.contains(e.target)) return;
    const el = owner(e.target);
    if (el === current) {
      clearTimeout(leaving);
      return;
    }
    hide();
    if (!el) return;
    textOf(el);
    timer = window.setTimeout(() => show(el), DELAY_MS);
  });
  root.addEventListener('pointerout', (e) => {
    if (e.target instanceof Node && tip.contains(e.target)) return;
    if (current && e.relatedTarget instanceof Node && (current.contains(e.relatedTarget) || tip.contains(e.relatedTarget))) return;
    // A moment to reach the card; leaving for anything else hides it then.
    if (current) hideSoon();
    else hide();
  });
  root.addEventListener('pointerdown', hide);
  root.addEventListener('focusin', (e) => {
    const el = owner(e.target);
    // Only for keyboard focus: a click already shows what it does.
    if (el && (e.target as HTMLElement).matches(':focus-visible')) show(el);
  });
  root.addEventListener('focusout', hide);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) hide();
  });
  window.addEventListener('scroll', hide, true);
}
