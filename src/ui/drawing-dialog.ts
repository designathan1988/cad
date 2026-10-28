// The project's own scale and pens (elements/drawing/schema.ts), in a dialog of their own: one command
// each change.

import type { App } from '../app/app';
import { type Doc, drawingOf } from '../app/document';
import type { Command } from '../core/store';
import { type DrawingSettings, isDrawingSettings, PEN_MAX, PEN_MIN, PEN_ROLES, type PenRole, ROOM_TAGS, SCALES } from '../elements/drawing/schema';
import { el, numberField, select } from './controls';
import { openProjectDialog } from './dialog';
import { type MessageKey, t } from './i18n';

export const setDrawing = (drawing: DrawingSettings): Command<Doc> => ({
  label: 'cmd.setDrawing',
  apply: (doc) => (!isDrawingSettings(drawing) || JSON.stringify(drawingOf(doc)) === JSON.stringify(drawing) ? doc : { ...doc, drawing }),
});

const row = (label: string, control: HTMLElement, focus: string) => {
  const target = control.querySelector('input, select') ?? control;
  (target as HTMLElement).dataset.focus = focus;
  if (target !== control) target.setAttribute('aria-label', label);
  return el('div', { class: 'mat-row' }, el('span', { class: 'mat-cap' }, label), control);
};

/** The project's scale and pens. */
export function showDrawingSettings(app: App): void {
  openProjectDialog(app, (close) => {
    const d = drawingOf(app.store.get());
    const change = (next: DrawingSettings) => app.store.dispatch(setDrawing(next));
    // The scale shown (a saved view's own while it is shown); a new one is the project's, for every view without one.
    const scale = select(
      SCALES.map((x) => ({ value: String(x), label: `1:${x}` })),
      String(app.drawingNow().scale),
      (v) => {
        app.ui.viewDen = null;
        change({ ...d, scale: Number(v) });
      },
    );
    const tag = select(
      ROOM_TAGS.map((x) => ({ value: x, label: t(`draw.roomTag.${x}` as MessageKey) })),
      d.roomTag ?? 'numberName',
      (v) => change({ ...d, roomTag: v }),
    );
    const pen = (role: PenRole) => row(t(`draw.pen.${role}` as MessageKey), numberField(d.pens[role], (v) => change({ ...d, pens: { ...d.pens, [role]: v } }), PEN_MIN, 2, 'mm', PEN_MAX), `pen:${role}`);
    const done = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    done.dataset.focus = 'close';
    done.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('draw.title') },
      el('h2', {}, t('draw.title')),
      el('div', { class: 'units-body' }, row(t('draw.scale'), scale, 'scale'), ...PEN_ROLES.map(pen), row(t('draw.roomTag'), tag, 'roomTag'), el('p', { class: 'mat-note' }, t('draw.note'))),
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), done),
    );
  });
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="scale"]')?.focus();
}
