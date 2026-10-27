// Sheets (phase 10; elements/sheet, app/sheets.ts): the set listed by number, one opened beside it with
// its number, name, paper and turn, the page as it prints with its views, and those views: added (a
// level's plan, a section or an elevation, a schedule or the list of sheets), dragged to their place on
// the page, given a scale, a size, what they show; one sheet or the whole set as a PDF. Every change is
// one command; the page is drawn from the model each time, so it follows the model.

import type { App } from '../app/app';
import { drawingOf } from '../app/document';
import { downloadSheetsPdf, planViewport, sectionViewport, sheetCanvas, tableLayout, tableOf, viewFrame, viewTitle } from '../app/sheets';
import { planMiddle } from '../app/print';
import { newId } from '../core/id';
import { PAPERS, SCALES } from '../elements/drawing/schema';
import { addSheet, addViewport, deleteSheet, deleteViewport, moveSheet, sheetsOf, updateSheet, updateViewport } from '../elements/sheet/commands';
import { drawingArea, nextSheetNumber, SHEET_PREFIX, SHEET_SCHEDULES, type Sheet, type SheetSchedule, sheetSize, type Viewport } from '../elements/sheet/schema';
import { el, numberField, segmented, select } from './controls';
import { openProjectDialog } from './dialog';
import { icon } from './icons';
import { type MessageKey, name, t } from './i18n';

/** The page's preview width on screen (px): its resolution follows from it. */
const PREVIEW_PX = 760;

const row = (label: string, control: HTMLElement, focus: string) => {
  const target = control.querySelector('input, select') ?? control;
  (target as HTMLElement).dataset.focus = focus;
  if (target !== control) target.setAttribute('aria-label', label);
  return el('div', { class: 'mat-row' }, el('span', { class: 'mat-cap' }, label), control);
};

/**
 * A view put where it overlaps none already on the sheet: the first free place in the drawing area,
 * row by row from its top left, 5 mm apart; where it was when there is none.
 */
export function placedFree(app: App, sheet: Sheet, v: Viewport): Viewport {
  const area = drawingArea(sheet);
  const gap = 5;
  const taken = sheet.viewports.map((x) => viewFrame(app, x));
  const f0 = viewFrame(app, v);
  const w = f0.x1 - f0.x0;
  // Room under a view for its title.
  const h = f0.y1 - f0.y0 + (v.kind === 'schedule' ? 0 : 9);
  for (let y = area.y0; y + h <= area.y1; y += gap) {
    for (let x = area.x0; x + w <= area.x1; x += gap) {
      if (taken.every((f) => x + w + gap <= f.x0 || x >= f.x1 + gap || y + h + gap <= f.y0 || y >= f.y1 + 9 + gap)) {
        const at = v.kind === 'schedule' ? { x, y } : { x: x + w / 2, y: y + (f0.y1 - f0.y0) / 2 };
        return { ...v, at };
      }
    }
  }
  return v;
}

/** A new sheet: the next number, A3 turned, the current level's plan on it at the project's scale. */
export function newSheet(app: App): Sheet {
  const doc = app.store.get();
  const all = sheetsOf(doc);
  const base = { paper: 'A3', landscape: true } as const;
  const level = doc.levels.find((l) => l.id === app.ui.levelId) ?? doc.levels[0]!;
  return {
    id: newId(SHEET_PREFIX),
    number: nextSheetNumber(all),
    name: t('sheet.planOf', { level: name(level.name) }),
    ...base,
    viewports: [planViewport(app, base, level.id, drawingOf(doc).scale, newId('vp'))],
  };
}

export function showSheets(app: App, first?: string): void {
  let current: string | null = first ?? sheetsOf(app.store.get())[0]?.id ?? null;
  let picked: string | null = null;
  let busy = false;
  const choice: { level: string; section: string; table: SheetSchedule } = { level: '', section: '', table: 'rooms' };
  const dialog = openProjectDialog(app, (close) => {
    const doc = app.store.get();
    const all = sheetsOf(doc);
    if (!all.some((s) => s.id === current)) current = all[0]?.id ?? null;
    const sheet = all.find((s) => s.id === current) ?? null;
    if (!sheet?.viewports.some((v) => v.id === picked)) picked = null;
    const pick = (id: string | null) => {
      picked = id;
      dialog.redraw();
    };
    const add = el('button', { type: 'button', class: 'btn' }, t('sheet.add'));
    add.dataset.focus = 'add';
    add.addEventListener('click', () => {
      const s = newSheet(app);
      current = s.id;
      app.store.dispatch(addSheet(s));
    });
    // The set, by its order: each a button; the open one pressed.
    const list = el(
      'div',
      { class: 'sheet-list', role: 'list', 'aria-label': t('sheet.title') },
      ...all.map((s) => {
        const b = el('button', { type: 'button', class: 'sheet-item', 'aria-pressed': String(s.id === current), role: 'listitem' }, el('strong', {}, s.number), el('span', {}, s.name));
        b.dataset.focus = `sheet:${s.id}`;
        b.addEventListener('click', () => {
          current = s.id;
          picked = null;
          dialog.redraw();
        });
        return b;
      }),
    );
    const left = el('div', { class: 'sheet-side' }, list, add);
    let body: HTMLElement;
    if (!sheet) {
      body = el('div', { class: 'sheet-body' }, left, el('p', { class: 'tour-empty' }, t('sheet.empty')));
    } else {
      const set = (p: Parameters<typeof updateSheet>[1]) => app.store.dispatch(updateSheet(sheet.id, p));
      const number = el('input', { type: 'text', value: sheet.number, autocomplete: 'off', spellcheck: 'false' });
      number.addEventListener('change', () => set({ number: number.value }));
      const nameIn = el('input', { type: 'text', value: sheet.name, autocomplete: 'off' });
      nameIn.addEventListener('change', () => set({ name: nameIn.value }));
      const paper = select(
        Object.keys(PAPERS).map((p) => {
          const z = sheetSize({ paper: p, landscape: true });
          return { value: p, label: `${p} (${z.w} × ${z.h} mm)` };
        }),
        sheet.paper,
        (v) => set({ paper: v }),
      );
      const turn = segmented(
        [
          { value: 'landscape', label: t('print.landscape') },
          { value: 'portrait', label: t('print.portrait') },
        ],
        sheet.landscape ? 'landscape' : 'portrait',
        (v) => set({ landscape: v === 'landscape' }),
      );
      turn.setAttribute('aria-label', t('print.orientation'));
      for (const b of turn.querySelectorAll('button')) b.dataset.focus = `turn:${b.textContent}`;
      const order = (by: -1 | 1, label: MessageKey, iconName: 'arrowUp' | 'arrowDown') => {
        const b = el('button', { type: 'button', class: 'icon-btn', title: t(label), 'aria-label': t(label) });
        b.innerHTML = icon(iconName, 16);
        b.dataset.focus = `order:${by}`;
        const i = all.indexOf(sheet);
        b.disabled = by < 0 ? i === 0 : i === all.length - 1;
        b.addEventListener('click', () => app.store.dispatch(moveSheet(sheet.id, by)));
        return b;
      };
      const drop = el('button', { type: 'button', class: 'icon-btn', title: t('sheet.delete'), 'aria-label': t('sheet.delete') });
      drop.innerHTML = icon('trash', 16);
      drop.dataset.focus = 'deleteSheet';
      drop.addEventListener('click', () => app.store.dispatch(deleteSheet(sheet.id)));
      const props = el(
        'div',
        { class: 'sheet-props' },
        row(t('sheet.number'), number, 'number'),
        row(t('sheet.name'), nameIn, 'name'),
        row(t('print.paper'), paper, 'paper'),
        el('div', { class: 'mat-row' }, el('span', { class: 'mat-cap' }, t('print.orientation')), turn),
        el('div', { class: 'sheet-tools' }, order(-1, 'sheet.up', 'arrowUp'), order(1, 'sheet.down', 'arrowDown'), drop),
      );
      // The page as it prints, small, with the view picked outlined; a view dragged on it moves.
      const size = sheetSize(sheet);
      const dpi = (PREVIEW_PX / size.w) * 25.4;
      const page = sheetCanvas(app, sheet, dpi, { n: all.indexOf(sheet) + 1, of: all.length }, () => dialog.redraw());
      page.className = 'sheet-preview';
      page.setAttribute('role', 'img');
      page.setAttribute('aria-label', t('sheet.preview', { number: sheet.number }));
      const over = el('canvas', { class: 'sheet-over', 'aria-hidden': 'true' });
      over.width = page.width;
      over.height = page.height;
      const k = page.width / size.w;
      const outline = (v: Viewport | null, dx = 0, dy = 0) => {
        const ctx = over.getContext('2d')!;
        ctx.clearRect(0, 0, over.width, over.height);
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2563eb';
        for (const x of sheet.viewports) {
          const f = viewFrame(app, x);
          const on = x.id === v?.id;
          ctx.strokeStyle = accent;
          ctx.globalAlpha = on ? 1 : 0.35;
          ctx.lineWidth = on ? 2 : 1;
          ctx.setLineDash(on ? [] : [4, 3]);
          ctx.strokeRect((f.x0 + (on ? dx : 0)) * k, (f.y0 + (on ? dy : 0)) * k, (f.x1 - f.x0) * k, (f.y1 - f.y0) * k);
        }
      };
      const pickedView = sheet.viewports.find((v) => v.id === picked) ?? null;
      outline(pickedView);
      const mmAt = (e: PointerEvent) => {
        const r = over.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h };
      };
      let drag: { v: Viewport; from: { x: number; y: number }; moved: boolean } | null = null;
      over.addEventListener('pointerdown', (e) => {
        const p = mmAt(e);
        // The topmost view under the pointer (drawn last).
        const hit = [...sheet.viewports].reverse().find((v) => {
          const f = viewFrame(app, v);
          return p.x >= f.x0 && p.x <= f.x1 && p.y >= f.y0 && p.y <= f.y1;
        });
        if (!hit) {
          pick(null);
          return;
        }
        over.setPointerCapture(e.pointerId);
        drag = { v: hit, from: p, moved: false };
        picked = hit.id;
        outline(hit);
      });
      over.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const p = mmAt(e);
        const dx = p.x - drag.from.x;
        const dy = p.y - drag.from.y;
        if (Math.hypot(dx, dy) > 1) drag.moved = true;
        if (drag.moved) outline(drag.v, dx, dy);
      });
      const end = (e: PointerEvent) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (!d.moved) {
          pick(d.v.id);
          return;
        }
        const p = mmAt(e);
        // To the whole millimetre: a page's places are written in them.
        const at = { x: Math.round(d.v.at.x + p.x - d.from.x), y: Math.round(d.v.at.y + p.y - d.from.y) };
        app.store.dispatch(updateViewport(sheet.id, d.v.id, { at }, 'cmd.moveViewport'));
      };
      over.addEventListener('pointerup', end);
      over.addEventListener('pointercancel', () => {
        drag = null;
        outline(pickedView);
      });
      const pageBox = el('div', { class: 'sheet-page' }, el('div', { class: 'sheet-stack' }, page, over));
      // Views to add: a plan of a level, a section or an elevation, a schedule.
      const area = drawingArea(sheet);
      // What to add: chosen first, then added with its button (a choice made with the arrow keys
      // changes the list at each step; adding on it added a view at each).
      const levels = [...doc.levels].sort((x, y) => y.elevation - x.elevation);
      if (!levels.some((l) => l.id === choice.level)) choice.level = levels.find((l) => l.id === app.ui.levelId)?.id ?? levels[0]!.id;
      if (!doc.sections.some((m) => m.id === choice.section)) choice.section = doc.sections[0]?.id ?? '';
      const place = (v: Viewport) => {
        picked = v.id;
        app.store.dispatch(addViewport(sheet.id, placedFree(app, sheet, v)));
      };
      const adder = (control: HTMLElement, focus: string, label: MessageKey, run: () => void, enabled = true) => {
        const sel = control.querySelector('select') as HTMLSelectElement;
        sel.dataset.focus = `${focus}:choice`;
        sel.setAttribute('aria-label', t(label));
        sel.disabled = !enabled;
        const go = el('button', { type: 'button', class: 'btn' }, t(label));
        go.dataset.focus = focus;
        go.disabled = !enabled;
        go.addEventListener('click', run);
        return el('div', { class: 'sheet-add' }, control, go);
      };
      const addPlan = adder(
        select(
          levels.map((l) => ({ value: l.id, label: name(l.name) })),
          choice.level,
          (v) => (choice.level = v),
        ),
        'addPlan',
        'sheet.addPlan',
        () => place(planViewport(app, sheet, choice.level, drawingOf(doc).scale, newId('vp'))),
      );
      const addSection = adder(
        select(
          doc.sections.length > 0 ? doc.sections.map((m) => ({ value: m.id, label: t(m.kind === 'section' ? 'section.titleOne' : 'section.elevationOne', { name: m.name }) })) : [{ value: '', label: t('sheet.noSections') }],
          choice.section,
          (v) => (choice.section = v),
        ),
        'addSection',
        'sheet.addSection',
        () => {
          const m = doc.sections.find((x) => x.id === choice.section);
          if (m) place(sectionViewport(app, sheet, m, drawingOf(doc).scale, newId('vp')));
        },
        doc.sections.length > 0,
      );
      const addTable = adder(
        select(
          SHEET_SCHEDULES.map((x) => ({ value: x, label: t(x === 'sheets' ? 'sheet.list' : (`schedule.kind.${x}` as MessageKey)) })),
          choice.table,
          (v) => (choice.table = v as SheetSchedule),
        ),
        'addTable',
        'sheet.addSchedule',
        () => {
          const ctx = document.createElement('canvas').getContext('2d')!;
          const w = Math.min(tableLayout(ctx, tableOf(app, choice.table), 'sans-serif').width, area.x1 - area.x0);
          place({ id: newId('vp'), kind: 'schedule', schedule: choice.table, at: { x: area.x0, y: area.y0 }, w: Math.max(40, Math.round(w)) });
        },
      );
      // The views on it, each a row: what it shows, its scale and size; the picked one marked.
      const views = el(
        'div',
        { class: 'sheet-views' },
        ...sheet.viewports.map((v) => {
          const upd = (p: Partial<Viewport>) => app.store.dispatch(updateViewport(sheet.id, v.id, p));
          const title = el('button', { type: 'button', class: 'sheet-view-name', 'aria-pressed': String(v.id === picked) }, viewTitle(doc, v));
          title.dataset.focus = `view:${v.id}`;
          title.addEventListener('click', () => pick(v.id === picked ? null : v.id));
          const cells: HTMLElement[] = [title];
          if (v.kind !== 'schedule') {
            const scale = select(
              SCALES.map((d) => ({ value: String(d), label: `1:${d}` })),
              String(v.den),
              // The frame grows or shrinks with the scale, so it keeps showing what it showed.
              (d) => upd({ den: Number(d), w: Math.max(10, Math.round((v.w * v.den) / Number(d))), h: Math.max(10, Math.round((v.h * v.den) / Number(d))) }),
            );
            scale.querySelector('select')!.setAttribute('aria-label', t('print.scaleLabel'));
            (scale.querySelector('select') as HTMLElement).dataset.focus = `scale:${v.id}`;
            cells.push(scale);
            const w = numberField(v.w, (x) => upd({ w: x }), 10, 0, 'mm', 2000);
            const h = numberField(v.h, (x) => upd({ h: x }), 10, 0, 'mm', 2000);
            w.querySelector('input')!.setAttribute('aria-label', t('sheet.width'));
            h.querySelector('input')!.setAttribute('aria-label', t('sheet.height'));
            (w.querySelector('input') as HTMLElement).dataset.focus = `w:${v.id}`;
            (h.querySelector('input') as HTMLElement).dataset.focus = `h:${v.id}`;
            cells.push(w, h);
            // Centred again on what it shows (the plan's middle, the drawing's).
            const centre = el('button', { type: 'button', class: 'icon-btn', title: t('sheet.recenter'), 'aria-label': t('sheet.recenter') });
            centre.innerHTML = icon('center', 16);
            centre.dataset.focus = `centre:${v.id}`;
            centre.addEventListener('click', () => {
              if (v.kind === 'plan') upd({ center: planMiddle(app, v.levelId) });
              else {
                const m = doc.sections.find((x) => x.id === v.sectionId);
                if (m) upd({ center: sectionViewport(app, sheet, m, v.den, v.id).center });
              }
            });
            cells.push(centre);
          } else {
            const w = numberField(v.w, (x) => upd({ w: x }), 20, 0, 'mm', 2000);
            w.querySelector('input')!.setAttribute('aria-label', t('sheet.width'));
            (w.querySelector('input') as HTMLElement).dataset.focus = `w:${v.id}`;
            cells.push(w);
          }
          const x = el('button', { type: 'button', class: 'icon-btn', title: t('sheet.removeView'), 'aria-label': t('sheet.removeView') });
          x.innerHTML = icon('close', 16);
          x.dataset.focus = `remove:${v.id}`;
          x.addEventListener('click', () => app.store.dispatch(deleteViewport(sheet.id, v.id)));
          cells.push(x);
          return el('div', { class: v.id === picked ? 'sheet-view picked' : 'sheet-view' }, ...cells);
        }),
      );
      body = el(
        'div',
        { class: 'sheet-body' },
        left,
        el('div', { class: 'sheet-main' }, props, pageBox, el('p', { class: 'mat-note' }, t('sheet.dragNote')), el('div', { class: 'sheet-adds' }, addPlan, addSection, addTable), views),
      );
    }
    const pdf = (only: string | undefined, label: MessageKey, focus: string) => {
      const b = el('button', { type: 'button', class: only ? 'btn' : 'icon-btn text-btn primary' }, t(label));
      b.dataset.focus = focus;
      b.disabled = busy || all.length === 0;
      b.addEventListener('click', () => {
        busy = true;
        dialog.redraw();
        setTimeout(() => {
          void downloadSheetsPdf(app, only)
            .catch((e: unknown) => app.toast(t('print.failed', { why: e instanceof Error ? e.message : String(e) })))
            .finally(() => {
              busy = false;
              dialog.redraw();
            });
        }, 30);
      });
      return b;
    };
    const done = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    done.dataset.focus = 'close';
    done.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-xl sheets-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('sheet.title') },
      el('h2', {}, t('sheet.title')),
      body,
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }, busy ? t('print.working') : ''), ...(sheet ? [pdf(sheet.id, 'sheet.pdfOne', 'pdfOne')] : []), pdf(undefined, 'sheet.pdfAll', 'pdfAll'), done),
    );
  }, () => (current ? `sheet:${current}` : 'add'));
  app.shell.helpBack.querySelector<HTMLElement>(current ? `[data-focus="sheet:${current}"]` : '[data-focus="add"]')?.focus();
}
