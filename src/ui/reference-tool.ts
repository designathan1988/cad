// References in the app (phase 11; elements/reference): a picture, a PDF's first page or a DXF put under
// the current level's plan, and calibrated by two points of it and the distance between them typed.

import type { App } from '../session/app';
import { newId } from '../core/id';
import type { Point2 } from '../model/vector';
import { addReference, setReference } from '../elements/reference/commands';
import { calibrated, DEFAULT_OPACITY, IMAGE_SCALE, REFERENCE_PREFIX, type Reference } from '../elements/reference/schema';
import { readDxfLines } from '../io/import-dxf';
import { el, numberField } from './controls';
import { openProjectDialog } from './dialog';
import { t } from '../i18n/messages';
import { lengthText } from '../i18n/units';
import { setView } from '../session/view-ui';

/** A PDF's page drawn at this resolution (dpi) to become a picture. */
const PDF_DPI = 150;

/** A picture's size, once it has loaded. */
function pictureSize(data: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error(t('ref.badPicture')));
    img.src = data;
  });
}

const dataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('read'));
    r.readAsDataURL(file);
  });

/** A PDF's first page as a PNG picture (pdf.js, loaded when first asked for). */
async function pdfPicture(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: PDF_DPI / 72 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/png');
}

/** A file as a reference on the current level: its middle at the plan's, a DXF where its own coordinates put it. */
export async function importReference(app: App, file: File): Promise<void> {
  const name = file.name;
  const base = { id: newId(REFERENCE_PREFIX), levelId: app.ui.levelId, name, angle: 0, opacity: DEFAULT_OPACITY };
  try {
    let r: Reference;
    if (/\.dxf$/i.test(name)) {
      const d = readDxfLines(await file.text());
      if (d.lines.length === 0) {
        app.toast(t('ref.emptyDxf'));
        return;
      }
      r = { ...base, source: { kind: 'dxf', lines: d.lines, w: d.w, h: d.h }, at: d.origin, scale: 1 };
      const left = Object.entries(d.skipped).map(([k, n]) => `${n} ${k}`).join(', ');
      app.store.dispatch(addReference(r));
      app.toast(left ? t('ref.dxfSome', { n: d.lines.length / 4, left }) : t('ref.dxfMade', { n: d.lines.length / 4 }));
    } else {
      const data = /\.pdf$/i.test(name) || file.type === 'application/pdf' ? await pdfPicture(file) : await dataUrl(file);
      const { w, h } = await pictureSize(data);
      // A PDF page: a pixel of it at 1:100 on paper (calibrated after); a picture: a pixel a centimetre.
      const scale = /\.pdf$/i.test(name) ? (0.0254 / PDF_DPI) * 100 : IMAGE_SCALE;
      const mid = app.plan.center;
      r = { ...base, source: { kind: 'image', data, w, h }, at: { x: mid.x - (w * scale) / 2, y: mid.y - (h * scale) / 2 }, scale };
      app.store.dispatch(addReference(r));
      app.toast(t('ref.pictureMade'));
    }
    if (app.ui.view !== 'plan') setView(app, 'plan');
    app.ui.selection = new Set([r.id]);
    app.refresh();
  } catch (e) {
    app.toast(t('ref.failed', { why: e instanceof Error ? e.message : String(e) }));
  }
}

/** Asks for a file to put under the plan. */
export function pickReference(app: App): void {
  const input = el('input', { type: 'file', accept: 'image/*,.pdf,application/pdf,.dxf' });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) void importReference(app, f);
  });
  input.click();
}

/** Calibrating `id`: the tool takes two points of it, then the distance is asked. */
export function startCalibration(app: App, id: string): void {
  app.setTool('calibrate');
  app.ui.calibrate = { id, a: null };
  app.ui.info = t('hint.calibrateFirst');
  app.render();
}

export function calibrateClick(app: App, p: Point2): void {
  const c = app.ui.calibrate;
  if (!c) return app.setTool('select');
  if (!c.a) {
    app.ui.calibrate = { ...c, a: p };
    return app.render();
  }
  const a = c.a;
  const now = Math.hypot(p.x - a.x, p.y - a.y);
  if (now < 1e-6) return;
  app.ui.calibrate = null;
  app.setTool('select');
  askDistance(app, c.id, a, p, now);
}

/** The line being measured for a calibration, and its length as the reference has it now. */
export function calibrateDraft(app: App): { a: Point2; b: Point2; text: string } | null {
  const c = app.ui.view === 'plan' && app.ui.tool === 'calibrate' ? app.ui.calibrate : null;
  const b = app.ui.snap?.point ?? app.ui.cursor;
  if (!c?.a || !b) return null;
  return { a: c.a, b, text: lengthText(Math.hypot(b.x - c.a.x, b.y - c.a.y)) };
}

/** The real distance between the two points, typed; the reference scaled about the first. */
function askDistance(app: App, id: string, a: Point2, b: Point2, now: number): void {
  let real = now;
  const dialog = openProjectDialog(app, (close) => {
    const field = numberField(real, (v) => {
      real = v;
    }, 0.001);
    const input = field.querySelector('input')!;
    input.dataset.focus = 'distance';
    input.setAttribute('aria-label', t('ref.realDistance'));
    const ok = el('button', { type: 'button', class: 'icon-btn text-btn primary' }, t('ref.apply'));
    ok.dataset.focus = 'ok';
    const apply = () => {
      const r = app.store.get().references.find((x) => x.id === id);
      const next = r && calibrated(r, a, b, real);
      if (next) {
        app.store.dispatch(setReference(next));
        app.toast(t('ref.calibrated', { now: lengthText(now), real: lengthText(real) }));
      }
      close();
    };
    ok.addEventListener('click', apply);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') setTimeout(apply, 0);
    });
    const cancel = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    cancel.dataset.focus = 'close';
    cancel.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('ref.calibrateTitle') },
      el('h2', {}, t('ref.calibrateTitle')),
      el('div', { class: 'units-body' }, el('p', { class: 'mat-note' }, t('ref.calibrateNote', { now: lengthText(now) })), el('div', { class: 'mat-row' }, el('span', { class: 'mat-cap' }, t('ref.realDistance')), field)),
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), ok, cancel),
    );
  });
  void dialog;
  const input = app.shell.helpBack.querySelector<HTMLInputElement>('[data-focus="distance"]');
  input?.focus();
  input?.select();
}
