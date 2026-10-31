// The project the app opens with: the last one open, from the browser's database (io/project-db.ts).
// The first time, the document kept the old way (one document in local storage) becomes the first
// project there, so nothing drawn before is lost. Without a database (a private window may have none)
// the app keeps the old way.

import { newId } from '../core/id';
import { listProjects, loadProject, openDb, saveProject } from './db';
import { type ReadError, repairProject } from './file';
import { type Doc, newDocument } from './doc';
import { loadDocument, loadPrefs, savePrefs, saveTo } from './persist';
import type { Fix } from './file';

/** The project the app opens with; where it is saved from now on is persist.ts's (saveTo, savedAs). */
export interface Boot {
  readonly doc: Doc;
  /** The last project open, when it could not be read and another was opened instead: its name and why. */
  readonly notOpened?: { readonly name: string; readonly error: ReadError };
  /** How many of its elements reading repaired or left out: said, as opening a file says it. */
  readonly repaired?: number;
  /** Starting failed (the browser's database refused): a project without it, said. */
  readonly failed?: true;
}

/** The elements reading repaired or left out, counted (ids only given their kind's prefix are not). */
export const fixedCount = (fixes: readonly Fix[]): number => fixes.filter((f) => f.kind !== 'typedIds').reduce((s, f) => s + f.count, 0);

export const PROJECT_PREFIX = 'project';

/**
 * A project read from the database and checked as a file is; null when it is not there or not readable
 * (`failed` hears why). `repaired` hears how many elements reading repaired or left out.
 */
export async function readStored(db: IDBDatabase, id: string, failed?: (error: ReadError) => void, repaired?: (n: number) => void): Promise<Doc | null> {
  const raw = await loadProject(db, id);
  if (!raw) return null;
  const r = repairProject(raw);
  if (!r.ok) {
    console.warn(`The project ${id} could not be read (${r.error}).`);
    failed?.(r.error);
    return null;
  }
  if (r.fixes.length > 0) console.warn('The project was repaired (bad elements dropped, ids given their kind):', r.fixes);
  if (fixedCount(r.fixes) > 0) repaired?.(fixedCount(r.fixes));
  return r.doc;
}

/** Without a database: the document kept in local storage, or a new one. */
export function local(): Boot {
  let repaired = 0;
  const doc = loadDocument((n) => (repaired = n)) ?? newDocument();
  return { doc, ...(repaired > 0 ? { repaired } : {}) };
}

export async function boot(): Promise<Boot> {
  const opening = openDb();
  if (!opening) return local();
  let db: IDBDatabase;
  try {
    db = await opening;
  } catch (e) {
    console.warn('The browser database could not be opened; the project is kept in local storage.', e);
    return local();
  }
  // The last one open, or else the last one changed.
  const last = loadPrefs().projectId;
  const list = await listProjects(db);
  const candidates = [...(last ? [last] : []), ...list.map((p) => p.id).filter((id) => id !== last)];
  // The last one, when it does not open, is said: another opening in its place, silently, looked
  // like the work was lost.
  let notOpened: Boot['notOpened'];
  for (const id of candidates) {
    let repaired = 0;
    const doc = await readStored(
      db,
      id,
      (error) => {
        if (id === last) notOpened = { name: list.find((p) => p.id === id)?.name ?? '', error };
      },
      (n) => (repaired = n),
    );
    if (doc) {
      saveTo(db, id);
      savePrefs({ projectId: id });
      return { doc, ...(notOpened ? { notOpened } : {}), ...(repaired > 0 ? { repaired } : {}) };
    }
  }
  // None yet: the document of before (or a new one) is the first project.
  let repaired = 0;
  const doc = loadDocument((n) => (repaired = n)) ?? newDocument();
  const id = newId(PROJECT_PREFIX);
  await saveProject(db, id, doc);
  saveTo(db, id);
  savePrefs({ projectId: id });
  return { doc, ...(notOpened ? { notOpened } : {}), ...(repaired > 0 ? { repaired } : {}) };
}
