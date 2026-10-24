// One tooltip for the whole interface (ref/chat.txt:247): any element with a title shows it in a
// small card near it, after a short pause on hover or at once on keyboard focus, in the design's
// colours, inside the window. The title moves to data-tip the first time, so the browser's own
// tooltip never shows as well; elements keep their accessible name (aria-label) as set.

const DELAY_MS = 450;

export function installTooltips(root: HTMLElement = document.body): void {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);
  let timer = 0;
  let current: HTMLElement | null = null;

  const textOf = (el: HTMLElement): string | null => {
    if (el.title) {
      el.dataset.tip = el.title;
      el.removeAttribute('title');
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
    let x = beside ? r.right + 8 : r.left + r.width / 2 - w / 2;
    let y = beside ? r.top + r.height / 2 - h / 2 : r.bottom + 6;
    if (y + h > window.innerHeight - 4) y = r.top - h - 6;
    x = Math.max(4, Math.min(x, window.innerWidth - w - 4));
    y = Math.max(4, y);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };
  const hide = () => {
    clearTimeout(timer);
    tip.hidden = true;
    current = null;
  };
  const owner = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? (target.closest('[title], [data-tip]') as HTMLElement | null) : null;

  root.addEventListener('pointerover', (e) => {
    const el = owner(e.target);
    if (el === current) return;
    hide();
    if (!el) return;
    textOf(el);
    timer = window.setTimeout(() => show(el), DELAY_MS);
  });
  root.addEventListener('pointerout', (e) => {
    if (current && e.relatedTarget instanceof Node && current.contains(e.relatedTarget)) return;
    hide();
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
