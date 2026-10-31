// The temporary dimensions of the selection: where they go in the view, and their editable fields.

import type { App } from '../session/app';
import { type TempDim, tempDims } from '../session/temp-dims';
import { shownFor } from '../project/derived-filters';
import { lengthNum, lengthText, typingExamples } from '../i18n/units';
import { t } from '../i18n/messages';
import { parseLength } from '../core/measure';

/**
 * Temporary dimensions of the one selected element, while selecting; while dragging only when they
 * follow the drag: a door or a window slid, or one wall moved (its length and its gaps to the walls
 * parallel to it, as they become).
 */
export function currentDims(app: App): TempDim[] {
  const d = app.ui.drag;
  if (app.ui.tool !== 'select' || (d && d.kind !== 'slide' && d.kind !== 'move')) return [];
  const doc = app.store.get();
  const moved = d?.kind === 'slide' ? { ...doc, openings: d.openings, openingGroups: d.groups } : d?.kind === 'move' ? { ...doc, walls: d.walls } : doc;
  // Measured only to what shows: an isolated wall measured 2,55 m to a wall hidden for now.
  const temp = app.ui.temp;
  const shown = temp ? { ...moved, walls: moved.walls.filter((w) => shownFor(temp, w.id)), openings: moved.openings.filter((o) => shownFor(temp, o.id) || shownFor(temp, o.wallId)) } : moved;
  return tempDims(shown, app.geometry, app.ui.selection);
}

/**
 * The value of each temporary dimension, as a button at the middle of its line; the one being
 * edited is a field. Elements are kept between renders so a field being typed in keeps its focus.
 */
export function placeDims(app: App, dims: readonly TempDim[]): void {
  const box = app.shell.dims;
  if (app.ui.dimEdit && !dims.some((d) => d.id === app.ui.dimEdit)) app.ui.dimEdit = null;
  const keep = new Set(dims.map((d) => `${d.id}|${d.id === app.ui.dimEdit ? 'edit' : 'show'}`));
  for (const child of [...box.children] as HTMLElement[]) if (!keep.has(child.dataset.key ?? '')) child.remove();
  const nodes: HTMLElement[] = [];
  for (const d of dims) {
    const editing = d.id === app.ui.dimEdit;
    const key = `${d.id}|${editing ? 'edit' : 'show'}`;
    let node = [...box.children].find((c) => (c as HTMLElement).dataset.key === key) as HTMLElement | undefined;
    if (!node) {
      node = editing ? app.dimField(d) : app.dimButton(d);
      node.dataset.key = key;
      box.append(node);
      if (node instanceof HTMLInputElement) {
        node.focus();
        node.select();
      }
    }
    if (node instanceof HTMLButtonElement) {
      node.textContent = lengthNum(d.value);
      node.title = t('dim.edit');
      node.setAttribute('aria-label', `${lengthText(d.value)}. ${t('dim.edit')}`);
    }
    nodes.push(node);
  }
  // Where the plan places them (plan-view.ts: dimValueBoxes), which its tags keep off too.
  const boxes = app.plan.dimValueBoxes(dims.map((d) => ({ ...d, text: lengthNum(d.value) })));
  nodes.forEach((node, i) => {
    node.style.left = `${boxes[i]!.x + boxes[i]!.w / 2}px`;
    node.style.top = `${boxes[i]!.y + boxes[i]!.h / 2}px`;
  });
}

export function dimButton(app: App, d: TempDim): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.addEventListener('click', () => {
    app.ui.dimEdit = d.id;
    app.render();
  });
  return b;
}

export function dimField(app: App, d: TempDim): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = lengthNum(d.value);
  input.setAttribute('aria-label', t('foot.measure'));
  const close = () => {
    if (app.ui.dimEdit !== d.id) return;
    app.ui.dimEdit = null;
    app.render();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      app.ui.error = null;
      return close();
    }
    if (e.key !== 'Enter') return;
    const text = input.value.trim();
    const v = parseLength(text);
    // The dimension as it is now: the one app field was made for may be stale.
    const dim = app.currentDims().find((x) => x.id === d.id);
    const cmd = v.ok && dim ? dim.apply(v.value) : null;
    if (!cmd) {
      app.ui.error = t(v.ok ? 'hint.dimRefused' : 'hint.badMeasure', { ...typingExamples(), text });
      return app.renderChrome();
    }
    app.ui.error = null;
    app.ui.dimEdit = null;
    app.store.dispatch(cmd);
  });
  input.addEventListener('blur', close);
  return input;
}
