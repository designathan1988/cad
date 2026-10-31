// A dialog that edits the project (levels, wall types): drawn again after every change, kept in the
// window's dialog layer. One place for what each needs alike:
// - while a field of it is being typed in, it is not rebuilt under the cursor; it is when the field
//   is left, so totals and thumbnails catch up (the tester's A on the types dialog);
// - Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) undo and redo from anywhere in it but a text field, which
//   keeps its own text undo (B);
// - Esc closes it wherever the focus is, and focus always lands on something enabled, so it is never
//   lost (C): the control with the same data-focus key, else the given fallback, else Close.

import type { App } from '../session/app';
import * as appEdit from '../session/app-edit';

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
    return ((a instanceof HTMLInputElement && a.type === 'text') || a instanceof HTMLTextAreaElement) && back.contains(a);
  };
  // Between a field's blur and the next one's focus the focus is nowhere (the page): drawn again then,
  // the field Tab was moving to was replaced and the focus fell to the page, so what was typed next went
  // to the app's shortcuts (a point's text turned on the door tool). Drawn when the focus has landed.
  const between = () => document.activeElement === null || document.activeElement === document.body;
  const focusKey = (key: string | undefined) => {
    const find = (k: string | null | undefined) => (k ? back.querySelector<HTMLElement>(`[data-focus="${k}"]`) : null);
    const usable = (x: HTMLElement | null) => (x && !(x as HTMLButtonElement).disabled ? x : null);
    (usable(find(key)) ?? usable(find(fallback())) ?? find('close'))?.focus();
  };
  const focusables = () => [...back.querySelectorAll<HTMLElement>('input, select, textarea, button, summary')];
  const redraw = () => {
    stale = false;
    const a = document.activeElement;
    const inside = a instanceof HTMLElement && back.contains(a);
    const key = inside ? a.dataset.focus : undefined;
    // A control with no focus key: its place among the controls, and its kind. A list chosen with the
    // arrow keys took one step, then the focus fell to the page and the next arrows did nothing.
    const at = inside && key === undefined ? focusables().indexOf(a) : -1;
    const tag = inside ? a.tagName : '';
    back.replaceChildren(render(close));
    if (key !== undefined) focusKey(key);
    else if (at >= 0) {
      const again = focusables()[at];
      if (again && again.tagName === tag) again.focus();
    }
  };
  const unsubscribe = app.store.subscribe(() => {
    if (typing()) stale = true;
    else if (between()) {
      // Once the focus has landed (on the next field, or nowhere at all): drawn then, keeping it.
      stale = true;
      setTimeout(() => {
        if (open && stale && !typing()) redraw();
      }, 0);
    } else redraw();
  });
  const onFocusOut = () =>
    // After the focus has moved on: the field left, the dialog catches up, focus where it went. A
    // microtask runs before Tab's focus has landed: then it waits for a task, as above.
    queueMicrotask(() => {
      if (!stale || typing()) return;
      if (between())
        setTimeout(() => {
          if (open && stale && !typing()) redraw();
        }, 0);
      else redraw();
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
      if (key === 'y' || e.shiftKey) appEdit.redo(app);
      else appEdit.undo(app);
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
