// Printing a plan (phase 9, app/print.ts): the level, the scale, the paper and its turn, with a preview
// of the page as it will print and whether the plan fits it; then the PDF. And the project's own scale
// and pens (elements/drawing/schema.ts), in a dialog of their own: one command each change.

import type { App } from '../app/app';
import { type Doc, drawingOf } from '../app/document';
import { downloadPlanPdf, fitOf, levelPlan, paperSize, type PrintSetup, printCanvas } from '../app/print';
import type { Command } from '../core/store';
import { type DrawingSettings, isDrawingSettings, PAPERS, PEN_MAX, PEN_MIN, PEN_ROLES, type PenRole, ROOM_TAGS, SCALES } from '../elements/drawing/schema';
import { el, numberField, segmented, select } from './controls';
import { openProjectDialog } from './dialog';
import { type MessageKey, name, num, t } from './i18n';

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

/** "12,40 × 8,10 m". */
const size = (s: { w: number; h: number }) => `${num(s.w, 2)} × ${num(s.h, 2)} m`;

/** A preview's resolution (dpi): a page of the dialog's width. */
const PREVIEW_DPI = 36;

export function showPrint(app: App): void {
  const doc0 = app.store.get();
  let setup: PrintSetup = { levelId: app.ui.levelId, den: drawingOf(doc0).scale, paper: 'A3', landscape: true };
  let busy = false;
  const dialog = openProjectDialog(app, (close) => {
    const doc = app.store.get();
    if (!doc.levels.some((l) => l.id === setup.levelId)) setup = { ...setup, levelId: doc.levels[0]!.id };
    const set = (p: Partial<PrintSetup>) => {
      setup = { ...setup, ...p };
      dialog.redraw();
    };
    const level = select(
      [...doc.levels].sort((a, b) => b.elevation - a.elevation).map((l) => ({ value: l.id, label: name(l.name) })),
      setup.levelId,
      (v) => set({ levelId: v }),
    );
    const scale = select(
      SCALES.map((d) => ({ value: String(d), label: `1:${d}` })),
      String(setup.den),
      (v) => set({ den: Number(v) }),
    );
    const paper = select(
      Object.keys(PAPERS).map((p) => {
        const s = paperSize({ paper: p, landscape: true });
        return { value: p, label: `${p} (${s.w} × ${s.h} mm)` };
      }),
      setup.paper,
      (v) => set({ paper: v }),
    );
    const turn = segmented(
      [
        { value: 'landscape', label: t('print.landscape') },
        { value: 'portrait', label: t('print.portrait') },
      ],
      setup.landscape ? 'landscape' : 'portrait',
      (v) => set({ landscape: v === 'landscape' }),
    );
    turn.setAttribute('aria-label', t('print.orientation'));
    for (const b of turn.querySelectorAll('button')) b.dataset.focus = `turn:${b.textContent}`;
    // The page as it will print, small; and whether the plan fits it at that scale.
    const fit = fitOf(levelPlan(doc, setup.levelId, app.ui.hidden), setup);
    const preview = printCanvas(app, setup, PREVIEW_DPI);
    preview.className = 'print-preview';
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', t('print.preview', { den: setup.den }));
    const said = el('p', { class: fit.fits ? 'mat-note' : 'mat-note print-warn', role: 'status' }, t(fit.fits ? 'print.fits' : 'print.noFit', { need: size(fit.need), room: size(fit.room) }));
    const go = el('button', { type: 'button', class: 'icon-btn text-btn primary' }, t('print.download'));
    go.dataset.focus = 'download';
    go.toggleAttribute('disabled', busy);
    go.addEventListener('click', () => {
      busy = true;
      dialog.redraw();
      // Let the button show it is working before the page is drawn at full size.
      setTimeout(() => {
        void downloadPlanPdf(app, setup)
          .catch((e: unknown) => app.toast(t('print.failed', { why: e instanceof Error ? e.message : String(e) })))
          .finally(() => {
            busy = false;
            dialog.redraw();
          });
      }, 30);
    });
    const done = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    done.dataset.focus = 'close';
    done.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-wide print-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('print.title') },
      el('h2', {}, t('print.title')),
      el(
        'div',
        { class: 'print-body' },
        el(
          'div',
          { class: 'print-fields' },
          row(t('print.level'), level, 'level'),
          row(t('print.scaleLabel'), scale, 'scale'),
          row(t('print.paper'), paper, 'paper'),
          el('div', { class: 'mat-row' }, el('span', { class: 'mat-cap' }, t('print.orientation')), turn),
          said,
          el('p', { class: 'mat-note' }, t('print.note')),
        ),
        el('div', { class: 'print-page' }, preview),
      ),
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }, busy ? t('print.working') : ''), go, done),
    );
  });
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="scale"]')?.focus();
}

/** The project's scale and pens. */
export function showDrawingSettings(app: App): void {
  openProjectDialog(app, (close) => {
    const d = drawingOf(app.store.get());
    const change = (next: DrawingSettings) => app.store.dispatch(setDrawing(next));
    const scale = select(
      SCALES.map((x) => ({ value: String(x), label: `1:${x}` })),
      String(d.scale),
      (v) => change({ ...d, scale: Number(v) }),
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
