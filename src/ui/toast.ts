// The toast stack (docs/revisao-interface.md, M5): three at most, the newest at the bottom, each with
// its way back when it has one. Extracted from the App: one responsibility, one module.

export function toast(box: HTMLElement, text: string, action?: { readonly label: string; readonly run: () => void }): void {
    const item = document.createElement('div');
    item.className = 'toast-item';
    item.append(Object.assign(document.createElement('span'), { textContent: text }));
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-action';
      b.textContent = action.label;
      b.addEventListener('click', () => {
        item.remove();
        action.run();
      });
      item.append(b);
    }
    box.append(item);
    while (box.childElementCount > 3) box.firstElementChild?.remove();
    // Long enough to be read: 1.6 s took away "Project opened; 1 bad element was left out. Ctrl+Z goes
    // back" before its end. Short ones ("Undone") still go quickly; one with a button stays longer.
    window.setTimeout(() => item.remove(), Math.max(action ? 5000 : 2500, 1500 + text.length * 50));
}
