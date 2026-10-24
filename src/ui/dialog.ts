// A dialog that edits the project (levels, wall types): drawn again after every change, kept in the
// window's dialog layer. One place for what each needs alike:
// - while a field of it is being typed in, it is not rebuilt under the cursor; it is when the field
//   is left, so totals and thumbnails catch up (the tester's A on the types dialog);
// - Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) undo and redo from anywhere in it but a text field, which
//   keeps its own text undo (B);
// - Esc closes it wherever the focus is, and focus always lands on something enabled, so it is never
//   lost (C): the control with the same data-focus key, else the given fallback, else Close.

import type { App } from '../app/app';

export interface ProjectDialog {
  /** Draws it again now, keeping the focus by its data-focus key. */
  readonly redraw: () => void;
  readonly close: () => void;
}

export function openProjectDialog(app: App, render: (close: () => void) => HTMLElement, fallback: () => string | null = () => null): ProjectDialog {
  const back = app.shell.helpBack;
  let stale = false;
  const typing = () => {
    const a = document.activeElement;
    return a instanceof HTMLInputElement && a.type === 'text' && back.contains(a);
  };
  const focusKey = (key: string | undefined) => {
    const find = (k: string | null | undefined) => (k ? back.querySelector<HTMLElement>(`[data-focus="${k}"]`) : null);
    const usable = (x: HTMLElement | null) => (x && !(x as HTMLButtonElement).disabled ? x : null);
    (usable(find(key)) ?? usable(find(fallback())) ?? find('close'))?.focus();
  };
  const redraw = () => {
    stale = false;
    const a = document.activeElement;
    const key = a instanceof HTMLElement && back.contains(a) ? a.dataset.focus : undefined;
    back.replaceChildren(render(close));
    if (key !== undefined) focusKey(key);
  };
  const unsubscribe = app.store.subscribe(() => {
    if (typing()) stale = true;
    else redraw();
  });
  const onFocusOut = () =>
    // After the focus has moved on: the field left, the dialog catches up, focus where it went.
    queueMicrotask(() => {
      if (stale && !typing()) redraw();
    });
  const onKey = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (e.key === 'Escape') {
      e.preventDefault();
      // After the field's own Esc has put its text back: closing blurs it, and a blur commits. Not a
      // microtask: those run between the listeners of a user's event, before the field's.
      setTimeout(close, 0);
    } else if (ctrl && (key === 'z' || key === 'y') && !typing()) {
      e.preventDefault();
      // Handled here only: the window's own shortcuts would undo a second time.
      e.stopPropagation();
      if (key === 'y' || e.shiftKey) app.redo();
      else app.undo();
    }
  };
  const onClick = (e: MouseEvent) => {
    if (e.target === back) close();
  };
  let open = true;
  function close(): void {
    if (!open) return;
    open = false;
    unsubscribe();
    window.removeEventListener('keydown', onKey, true);
    back.removeEventListener('focusout', onFocusOut);
    back.removeEventListener('click', onClick);
    back.hidden = true;
    app.shell.planCanvas.focus();
  }
  // Captured on the window: Esc and undo work wherever the focus went, even off the dialog. What an
  // earlier dialog in the same layer set on it goes.
  back.onkeydown = null;
  back.onclick = null;
  window.addEventListener('keydown', onKey, true);
  back.addEventListener('focusout', onFocusOut);
  back.addEventListener('click', onClick);
  back.replaceChildren(render(close));
  back.hidden = false;
  return { redraw, close };
}
