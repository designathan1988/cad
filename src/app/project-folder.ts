// The documents cad2 makes for the approval journey (approval/schema.ts Generated), one by one or all
// together in the project's folder (docs/plano-de-escopo.md: "uma pasta do projeto com tudo o que foi
// emitido"): a ZIP with the project file, its IFC, the memorial, the compliance report, the table of
// areas, the CUB estimate, the budget's sheet, ABC curve and schedule, the approval journey, and the
// sheets' PDF when there are sheets.

import type { Generated } from '../approval/schema';
import { budgetOf } from '../costs/budget';
import { abcRows, csvOf, scheduleRows, sheetRows } from '../costs/tables';
import { writeProject } from '../io/project-file';
import { zipFiles } from '../io/zip';
import { getLang, type MessageKey, t } from '../ui/i18n';
import type { App } from './app';
import { ifcText } from './app-files';
import { approvalHtml, areasHtml, complianceHtml, cubHtml, memorialHtml } from './documents';
import { sheetsPdf } from './sheets';

const today = () => new Date().toLocaleDateString(getLang() === 'pt' ? 'pt-BR' : 'en-GB');
const say = (k: string, v?: Readonly<Record<string, string | number>>) => t(k as MessageKey, v);

interface Made {
  readonly name: string;
  readonly data: Uint8Array | string;
  readonly type: string;
}

/** One document: its file's name, its content and its type; null when there is nothing to make (no sheets). */
async function make(app: App, kind: Generated): Promise<Made | null> {
  const doc = app.store.get();
  const g = app.geometry;
  const base = app.fileBase();
  const html = (key: MessageKey, text: string): Made => ({ name: `${base} - ${t(key)}.html`, data: text, type: 'text/html' });
  const csv = (key: MessageKey, rows: Parameters<typeof csvOf>[0]): Made => ({ name: `${base} - ${t(key)}.csv`, data: csvOf(rows, getLang() === 'pt'), type: 'text/csv;charset=utf-8' });
  switch (kind) {
    case 'compliance':
      return html('report.title', complianceHtml(doc, g, (id) => app.reportTitle(id), today()));
    case 'areas':
      return html('areas.title', areasHtml(doc, g, today()));
    case 'cub':
      return html('budget.tab.cub', cubHtml(doc, g, today()));
    case 'memorial':
      return html('memo.title', memorialHtml(doc, g, today()));
    case 'budget':
      return csv('budget.tab.sheet', sheetRows(doc, budgetOf(doc, g), say));
    case 'schedule':
      return csv('budget.tab.schedule', scheduleRows(doc, budgetOf(doc, g), say));
    case 'sheets': {
      const pdf = await sheetsPdf(app);
      return pdf ? { name: pdf.file, data: pdf.pdf, type: 'application/pdf' } : null;
    }
    case 'model':
      return { name: `${base}.ifc`, data: ifcText(app), type: 'application/x-step' };
  }
}

/** One document made and given to save; said when there is nothing to make. */
export async function generateDocument(app: App, kind: Generated): Promise<void> {
  try {
    const m = await make(app, kind);
    if (!m) {
      app.toast(t('approval.nothing'));
      return;
    }
    app.download(m.name, new Blob([m.data as BlobPart], { type: m.type }), m.type);
    app.toast(t('schedule.saved', { file: m.name }));
  } catch (e) {
    console.error(e);
    app.toast(t('export.failed', { what: t(`approval.gen.${kind}`), error: e instanceof Error ? e.message : String(e) }));
  }
}

/** Every document, the project file, the ABC curve and the approval journey, in one ZIP. */
export async function downloadFolder(app: App): Promise<void> {
  try {
    const doc = app.store.get();
    const base = app.fileBase();
    const files: { name: string; data: Uint8Array | string }[] = [{ name: `${base}.json`, data: writeProject(doc) }];
    for (const kind of ['memorial', 'compliance', 'areas', 'cub', 'budget', 'schedule', 'model', 'sheets'] as const) {
      const m = await make(app, kind);
      if (m) files.push({ name: m.name, data: m.data });
    }
    files.push({ name: `${base} - ${t('budget.tab.abc')}.csv`, data: csvOf(abcRows(budgetOf(doc, app.geometry), say), getLang() === 'pt') });
    files.push({ name: `${base} - ${t('approval.title')}.html`, data: approvalHtml(doc, today()) });
    const zip = await zipFiles(files);
    const file = `${base} - ${t('approval.folder')}.zip`;
    app.download(file, new Blob([zip as BlobPart], { type: 'application/zip' }), 'application/zip');
    app.toast(t('approval.folderSaved', { file, n: files.length }));
  } catch (e) {
    console.error(e);
    app.toast(t('export.failed', { what: 'ZIP', error: e instanceof Error ? e.message : String(e) }));
  }
}
