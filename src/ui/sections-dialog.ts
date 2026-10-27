// Sections and elevations (phase 10; elements/section, app/section-drawing.ts): the marks listed, the one
// picked drawn as it prints, from the model as it is now; the four elevations made round the building
// in one go, a section drawn in plan with its tool, and a drawing put on a sheet at the project's scale.

import type { App } from '../app/app';
import { drawingOf } from '../app/document';
import { levelText, sectionCanvas, sectionOf, sectionViewport } from '../app/sheets';
import { sectionDxf, toCp1252 } from '../io/export-dxf';
import { newId } from '../core/id';
import { addViewport, addSheet, sheetsOf } from '../elements/sheet/commands';
import { nextSheetNumber, SHEET_PREFIX } from '../elements/sheet/schema';
import { el } from './controls';
import { openProjectDialog } from './dialog';
import { t } from './i18n';
import { showSheets } from './sheets-dialog';

/** The preview's size on screen (px). */
const PREVIEW_W = 640;
const PREVIEW_H = 360;

export function showSections(app: App, first?: string): void {
  let current: string | null = first ?? app.store.get().sections[0]?.id ?? null;
  const dialog = openProjectDialog(
    app,
    (close) => {
      const doc = app.store.get();
      if (!doc.sections.some((m) => m.id === current)) current = doc.sections[0]?.id ?? null;
      const mark = doc.sections.find((m) => m.id === current) ?? null;
      const list = el(
        'div',
        { class: 'sheet-list', role: 'list', 'aria-label': t('section.dialog') },
        ...doc.sections.map((m) => {
          const b = el('button', { type: 'button', class: 'sheet-item', 'aria-pressed': String(m.id === current), role: 'listitem' }, el('strong', {}, m.name), el('span', {}, t(m.kind === 'section' ? 'section.kindSection' : 'section.kindElevation')));
          b.dataset.focus = `mark:${m.id}`;
          b.addEventListener('click', () => {
            current = m.id;
            dialog.redraw();
          });
          return b;
        }),
      );
      const elevations = el('button', { type: 'button', class: 'btn' }, t('section.makeElevations'));
      elevations.dataset.focus = 'elevations';
      elevations.addEventListener('click', () => app.addElevations());
      const draw = el('button', { type: 'button', class: 'btn' }, t('section.draw'));
      draw.dataset.focus = 'draw';
      draw.addEventListener('click', () => {
        close();
        app.setTool('section');
      });
      let main: HTMLElement;
      if (!mark) main = el('p', { class: 'tour-empty' }, t('section.empty'));
      else {
        const d = sectionOf(app, mark);
        // Fitted to the preview: the drawing's box and the level marks' room at its right.
        const box = d.box ?? { min: { x: 0, y: 0 }, max: { x: d.length, y: 3 } };
        const wM = box.max.x - box.min.x + 4;
        const hM = box.max.y - Math.min(0, box.min.y) + 2;
        const mmPerM = Math.min((PREVIEW_W * 0.75) / wM, PREVIEW_H / hM) / (96 / 25.4);
        const den = 1000 / mmPerM;
        const wMm = (PREVIEW_W / 96) * 25.4;
        const hMm = (PREVIEW_H / 96) * 25.4;
        const canvas = sectionCanvas(app, mark, { den, wMm, hMm, center: { x: (box.min.x + box.max.x) / 2 + (wMm * 0.12 * den) / 1000, y: (Math.min(0, box.min.y) + box.max.y) / 2 } }, 96 * Math.min(2, window.devicePixelRatio || 1));
        canvas.className = 'section-preview';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', t(mark.kind === 'section' ? 'section.titleOne' : 'section.elevationOne', { name: mark.name }));
        const place = el('button', { type: 'button', class: 'btn' }, t('section.place'));
        place.dataset.focus = 'place';
        place.addEventListener('click', () => {
          // On the first sheet that has room… the last sheet, or a new one when there is none.
          const sheets = sheetsOf(doc);
          let sheet = sheets.at(-1) ?? null;
          if (!sheet) {
            sheet = { id: newId(SHEET_PREFIX), number: nextSheetNumber(sheets), name: t(mark.kind === 'section' ? 'section.titleOne' : 'section.elevationOne', { name: mark.name }), paper: 'A3', landscape: true, viewports: [] };
            app.store.dispatch(addSheet(sheet));
          }
          app.store.dispatch(addViewport(sheet.id, sectionViewport(app, sheet, mark, drawingOf(app.store.get()).scale, newId('vp'))));
          close();
          showSheets(app, sheet.id);
        });
        const dxf = el('button', { type: 'button', class: 'btn' }, t('section.dxf'));
        dxf.dataset.focus = 'dxf';
        dxf.addEventListener('click', () => {
          const file = `${app.fileBase()} - ${t(mark.kind === 'section' ? 'section.titleOne' : 'section.elevationOne', { name: mark.name })}.dxf`;
          app.download(file, new Blob([toCp1252(sectionDxf(d, levelText)) as BlobPart], { type: 'application/dxf' }), 'application/dxf');
          app.toast(t('export.dxfSaved', { file }));
        });
        main = el('div', { class: 'section-main' }, el('div', { class: 'print-page' }, canvas), el('p', { class: 'mat-note' }, t('section.note')), el('div', { class: 'sheet-adds' }, place, dxf));
      }
      const done = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
      done.dataset.focus = 'close';
      done.addEventListener('click', close);
      return el(
        'div',
        { class: 'dialog dialog-xl sheets-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('section.dialog') },
        el('h2', {}, t('section.dialog')),
        el('div', { class: 'sheet-body' }, el('div', { class: 'sheet-side' }, list, elevations, draw), main),
        el('div', { class: 'actions' }, el('span', { class: 'spacer' }), done),
      );
    },
    () => (current ? `mark:${current}` : 'elevations'),
  );
  app.shell.helpBack.querySelector<HTMLElement>(current ? `[data-focus="mark:${current}"]` : '[data-focus="elevations"]')?.focus();
}
