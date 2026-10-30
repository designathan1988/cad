// Automatic saving in the browser: the document (validated on the way back in) and the interface
// preferences, kept apart. Storage can be missing or full; then the app keeps working unsaved and
// says so in the console, and never drops the project it has in memory.

import type { Lang } from '../i18n/messages';
import { readProject, repairProject } from './file';
import type { Doc } from './doc';
import type { View3D } from './view-prefs';
import { saveProject } from './db';

const DOC_KEY = 'cad2.document.v1';
const PREFS_KEY = 'cad2.prefs.v1';

export interface Prefs {
  lang?: Lang;
  theme?: 'light' | 'dark';
  view?: '3d' | 'plan';
  /** The level last shown: interface state, kept by the browser and never in the project or its undo. */
  levelId?: string;
  panelOpen?: boolean;
  /** The project browser drawer is open. */
  browserOpen?: boolean;
  /** How the 3D view shows the levels (view-3d.ts). */
  view3d?: View3D;
  /** Every wall's reference line shown in plan, not only the selected ones'. */
  refLines?: boolean;
  /** Doors' and windows' type marks shown in plan (default on). */
  openingTags?: boolean;
  /** Points snap (S): off, it stays off. */
  snaps?: boolean;
  /** Collisions (app/collision.ts): off, it stays off. */
  collisions?: boolean;
  /** Into how many parts a segment's division points cut it (snap.ts): 3 when not set. */
  snapParts?: number;
  /** Shortcuts the user remapped or turned off (app/keymap.ts): an action's id, its key or null. */
  keymap?: Record<string, string | null>;
  /** Where the plan was looking (pixels per metre, world point at the centre): a reload framed it all again. */
  planView?: { scale: number; center: { x: number; y: number } };
  /** The project open last, of those kept in the browser (io/project-db.ts). */
  projectId?: string;
  /** The ribbon's tab shown last (app/ribbon-tabs.ts). */
  ribbonTab?: string;
  /** A wall's type changed keeps the face against its room where it was (default on), or its reference line. */
  keepClear?: boolean;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch (e) {
    console.warn('Browser storage unavailable; changes will not be kept after closing.', e);
    return null;
  }
}

export function saveDocument(doc: Doc): void {
  try {
    storage()?.setItem(DOC_KEY, JSON.stringify(doc));
  } catch (e) {
    console.warn('Could not save the project in the browser.', e);
  }
}

/** The version waiting to be saved, and whether a save is asked for. */
let pending: Doc | null = null;
let asked = false;

/** Where the project is saved: its record in the browser's database (io/project-db.ts), or, without
 * one, the single document of before. */
let target: { readonly db: IDBDatabase; readonly id: string } | null = null;

/** The project saved from now on, in the database. */
export function saveTo(db: IDBDatabase, id: string): void {
  target = { db, id };
}

/** The project being saved in the database, if any. */
export const savedAs = (): { readonly db: IDBDatabase; readonly id: string } | null => target;

/** Saves what is waiting, now: when the page is hidden or closed, nothing is left behind. Resolved when written. */
export function flushSave(): Promise<void> {
  if (!pending) return Promise.resolve();
  const doc = pending;
  pending = null;
  if (!target) {
    saveDocument(doc);
    return Promise.resolve();
  }
  // Element by element (only what changed); a failure is said, and the document kept the old way too.
  return saveProject(target.db, target.id, doc).catch((e: unknown) => {
    console.warn('Could not save the project in the browser database; kept in local storage instead.', e);
    saveDocument(doc);
  });
}

/**
 * The document saved when the browser is idle, the latest version only: a drag or the arrows held made
 * a version at every step, each written whole as it came (docs/plano-de-escopo.md, phase 1: saving
 * without holding the drawing up). Hiding or closing the page saves at once (wireSaving).
 */
export function scheduleSave(doc: Doc): void {
  pending = doc;
  if (asked) return;
  asked = true;
  const run = () => {
    asked = false;
    void flushSave();
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1000 });
  else setTimeout(run, 200);
}

/** Saves what is waiting when the page is hidden or about to close. */
export function wireSaving(): void {
  window.addEventListener('pagehide', () => void flushSave());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSave();
  });
}

/** The saved document, repaired if some elements are bad (they are dropped and reported in the console). */
export function loadDocument(): Doc | null {
  const raw = storage()?.getItem(DOC_KEY);
  if (!raw) return null;
  const r = readProject(raw);
  if (r.ok) {
    if (r.fixes.length > 0) console.warn('The saved project was repaired (bad elements dropped, ids given their kind):', r.fixes);
    return r.doc;
  }
  console.warn(`The saved project could not be read (${r.error}); starting a new one. The saved copy is kept under`, `${DOC_KEY}.invalid`);
  storage()?.setItem(`${DOC_KEY}.invalid`, raw);
  return null;
}

/** The document if every element is valid (ids given their kind's prefix are kept: typed-ids.ts), or null. Documents saved before openings, rooms or floors get none. */
export function validateDocument(raw: unknown): Doc | null {
  const r = repairProject(raw);
  return r.ok && r.fixes.every((f) => f.kind === 'typedIds') ? r.doc : null;
}

export function loadPrefs(): Prefs {
  try {
    return JSON.parse(storage()?.getItem(PREFS_KEY) ?? '{}') as Prefs;
  } catch (e) {
    console.warn('Interface preferences could not be read; using defaults.', e);
    return {};
  }
}

export function savePrefs(patch: Prefs): void {
  try {
    storage()?.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch (e) {
    console.warn('Could not save interface preferences.', e);
  }
}
