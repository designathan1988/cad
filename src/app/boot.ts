// The project the app opens with: the last one open, from the browser's database (io/project-db.ts).
// The first time, the document kept the old way (one document in local storage) becomes the first
// project there, so nothing drawn before is lost. Without a database (a private window may have none)
// the app keeps the old way.

import { newId } from '../core/id';
import { listProjects, loadProject, openDb, saveProject } from '../io/project-db';
import { repairProject } from '../io/project-file';
import { type Doc, newDocument } from './document';
import { loadDocument, loadPrefs, savePrefs, saveTo } from './persist';

export interface Boot {
  readonly doc: Doc;
  /** The database and the project's id there; null without a database. */
  readonly db: IDBDatabase | null;
  readonly projectId: string | null;
}

export const PROJECT_PREFIX = 'project';

/** A project read from the database and checked as a file is; null when it is not there or not readable. */
export async function readStored(db: IDBDatabase, id: string): Promise<Doc | null> {
  const raw = await loadProject(db, id);
  if (!raw) return null;
  const r = repairProject(raw);
  if (!r.ok) {
    console.warn(`The project ${id} could not be read (${r.error}).`);
    return null;
  }
  if (r.fixes.length > 0) console.warn('The project was repaired (bad elements dropped, ids given their kind):', r.fixes);
  return r.doc;
}

export async function boot(): Promise<Boot> {
  const opening = openDb();
  if (!opening) return { doc: loadDocument() ?? newDocument(), db: null, projectId: null };
  let db: IDBDatabase;
  try {
    db = await opening;
  } catch (e) {
    console.warn('The browser database could not be opened; the project is kept in local storage.', e);
    return { doc: loadDocument() ?? newDocument(), db: null, projectId: null };
  }
  // The last one open, or else the last one changed.
  const last = loadPrefs().projectId;
  const candidates = [...(last ? [last] : []), ...(await listProjects(db)).map((p) => p.id).filter((id) => id !== last)];
  for (const id of candidates) {
    const doc = await readStored(db, id);
    if (doc) {
      saveTo(db, id);
      savePrefs({ projectId: id });
      return { doc, db, projectId: id };
    }
  }
  // None yet: the document of before (or a new one) is the first project.
  const doc = loadDocument() ?? newDocument();
  const id = newId(PROJECT_PREFIX);
  await saveProject(db, id, doc);
  saveTo(db, id);
  savePrefs({ projectId: id });
  return { doc, db, projectId: id };
}
