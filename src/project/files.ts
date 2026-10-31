// The project as a file: saving, opening and a new one. Functions over the app (app.ts delegates).

import { t } from '../i18n/messages';
import { type Doc, newDocument, startLevel } from './doc';
import { savedAs, savePrefs } from './persist';
import { readProject, writeProject } from './file';
import { importAsProject, newStoredProject } from './projects';
import { safeFileName } from '../model/fs-name';
import type { App } from '../session/app';

/** The project's name, as one undo step; an empty name is "Untitled project" again. */
export function renameProject(app: App, next: string): void {
  const name = next.trim();
  if (name === app.store.get().name) return;
  app.store.dispatch({ label: 'cmd.renameProject', apply: (d) => ({ ...d, name }) });
}

export function saveFile(app: App): void {
  const doc = app.store.get();
  // Named after the project, without what a file name cannot hold: every save was "project.json".
  download(app, `${fileBase(app)}.json`, writeProject(doc), 'application/json')
  app.toast(t('toast.saved'));
}

/** A file given to the browser to save: the project. */
export function download(_app: App, file: string, content: string | Blob, type: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** The project's file name: its name without what a file name cannot hold. */
export function fileBase(app: App): string {
  return safeFileName(app.store.get().name || t('app.untitled'));
}

/**
 * A new, empty project in place of the current one, as one undo step: like opening a file, nothing is
 * lost (Ctrl+Z gives the previous project back), so it asks nothing.
 */
export function newProject(app: App): void {
  // Kept in the browser's database: another project, the open one staying in the list (projects.ts).
  const stored = savedAs();
  if (stored) {
    void newStoredProject(app, stored.db);
    return;
  }
  const doc = newDocument();
  showProject(app, doc, () => app.store.dispatch({ label: 'cmd.newProject', apply: () => doc }));
  app.toast(t('toast.newUndo'));
}

/**
 * Another project shown in place of the open one: the old one's message, selection, drag and level go,
 * and it is framed whole. `put` puts the document in the store (one undo step, or a history of its own).
 */
export function showProject(app: App, doc: Doc, put: () => void): void {
  app.ui.error = null;
  app.ui.selection.clear();
  app.ui.drag = null;
  app.ui.levelId = startLevel(doc);
  savePrefs({ levelId: app.ui.levelId });
  put();
  app.framed.plan = false;
  app.framed['3d'] = false;
  app.frameAll();
}

/** Opens a project file in place of the current project, as one undo step. */
export async function openFile(app: App, file: File): Promise<void> {
  const r = readProject(await file.text());
  if (!r.ok) {
    app.ui.error = t(`open.${r.error}`);
    return app.renderChrome();
  }
  // A project saved without a name is called by its file's: "casa.json" opens as "casa".
  const opened = r.doc.name ? r.doc : { ...r.doc, name: file.name.replace(/\.json$/i, '') };
  // Elements left out; ids only given their kind's prefix (typed-ids.ts) were kept, and are not counted.
  const fixed = r.fixes.filter((f) => f.kind !== 'typedIds').reduce((s, f) => s + f.count, 0);
  const stored = savedAs();
  if (stored) {
    // A new project of the list: the open one stays there (projects.ts).
    await importAsProject(app, stored.db, opened);
    app.toast(fixed > 1 ? t('toast.importedFixed', { n: fixed }) : fixed === 1 ? t('toast.importedFixedOne') : t('toast.imported'));
    return;
  }
  // One undo step, like any other change: opening by mistake never loses the project that was open.
  showProject(app, opened, () => app.store.dispatch({ label: 'cmd.openProject', apply: () => opened }));
  app.toast(fixed > 1 ? t('toast.openedFixed', { n: fixed }) : fixed === 1 ? t('toast.openedFixedOne') : t('toast.openedUndo'));
}
