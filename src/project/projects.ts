// The projects kept in the browser (io/project-db.ts): a new one, opening one, a file opened as a new
// one, duplicating, renaming and deleting. The project left stays saved in the list: a new or opened
// project is not an undo step over the last one, it is another project. Without a database the app
// keeps the old way (app-files.ts).

import { newId } from '../core/id';
import { deleteProject, forgetSaved, listProjects, type ProjectInfo, saveProject } from './db';
import { t } from '../i18n/messages';
import type { App } from '../session/app';
import { PROJECT_PREFIX, readStored } from './boot';
import { type Doc, newDocument, startLevel } from './doc';
import { flushSave, savePrefs, saveTo } from './persist';
import { renameProject } from './files';

/** The open project becomes `doc`, kept under `id`: the one before is saved first, its history left behind. */
function switchTo(app: App, db: IDBDatabase, id: string, doc: Doc): void {
  void flushSave();
  saveTo(db, id);
  savePrefs({ projectId: id });
  app.projectId = id;
  app.ui.error = null;
  app.ui.selection.clear();
  app.ui.drag = null;
  app.ui.levelId = startLevel(doc);
  savePrefs({ levelId: app.ui.levelId });
  app.store.reset(doc);
  app.framed.plan = false;
  app.framed['3d'] = false;
  app.frameAll();
}

/** A new empty project; the open one stays in the list. */
export async function newStoredProject(app: App, db: IDBDatabase): Promise<void> {
  const doc = newDocument();
  const id = newId(PROJECT_PREFIX);
  await saveProject(db, id, doc);
  switchTo(app, db, id, doc);
  app.toast(t('toast.newProject'));
}

/** A project of the list opened; false when it could not be read. */
export async function openStoredProject(app: App, db: IDBDatabase, id: string): Promise<boolean> {
  if (id === app.projectId) return true;
  const doc = await readStored(db, id);
  if (!doc) return false;
  // Read again: its next save writes it whole, so nothing stale stays in the database.
  forgetSaved(id);
  switchTo(app, db, id, doc);
  app.toast(t('toast.openedProject', { name: doc.name || t('app.untitled') }));
  return true;
}

/** A project file (already read and checked) opened as a new project of the list. */
export async function importAsProject(app: App, db: IDBDatabase, doc: Doc): Promise<void> {
  const id = newId(PROJECT_PREFIX);
  await saveProject(db, id, doc);
  switchTo(app, db, id, doc);
}

/** The projects, the open one's info brought up to date first. */
export async function projectsList(db: IDBDatabase): Promise<ProjectInfo[]> {
  await flushSave();
  return listProjects(db);
}

/** A copy of a project under a new id, named "… (copy)". */
export async function duplicateProject(app: App, db: IDBDatabase, id: string): Promise<void> {
  await flushSave();
  const doc = id === app.projectId ? app.store.get() : await readStored(db, id);
  if (!doc) return;
  await saveProject(db, newId(PROJECT_PREFIX), { ...doc, name: t('projects.copyName', { name: doc.name || t('app.untitled') }) });
}

/** A project of the list renamed (the open one by a command, one undo step, as everywhere). */
export async function renameStoredProject(app: App, db: IDBDatabase, id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (id === app.projectId) {
    renameProject(app, clean);
    return;
  }
  const doc = await readStored(db, id);
  if (!doc || doc.name === clean) return;
  forgetSaved(id);
  await saveProject(db, id, { ...doc, name: clean });
}

/** A project gone for good; the open one gives way to the next in the list, or a new one. */
export async function deleteStoredProject(app: App, db: IDBDatabase, id: string): Promise<void> {
  if (id === app.projectId) {
    const next = (await listProjects(db)).find((p) => p.id !== id);
    if (!next || !(await openStoredProject(app, db, next.id))) await newStoredProject(app, db);
  }
  await deleteProject(db, id);
}
