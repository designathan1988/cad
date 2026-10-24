// Automatic saving in the browser: the document (validated on the way back in) and the interface
// preferences, kept apart. Storage can be missing or full; then the app keeps working unsaved and
// says so in the console, and never drops the project it has in memory.

import type { Lang } from '../ui/i18n';
import { readProject, repairProject } from '../io/project-file';
import type { Doc } from './document';

const DOC_KEY = 'cad2.document.v1';
const PREFS_KEY = 'cad2.prefs.v1';

export interface Prefs {
  lang?: Lang;
  theme?: 'light' | 'dark';
  view?: '3d' | 'plan';
  panelOpen?: boolean;
  /** The first-use tour was taken, skipped or declined: it is not offered again. */
  tourSeen?: boolean;
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

/** The saved document, repaired if some elements are bad (they are dropped and reported in the console). */
export function loadDocument(): Doc | null {
  const raw = storage()?.getItem(DOC_KEY);
  if (!raw) return null;
  const r = readProject(raw);
  if (r.ok) {
    if (r.fixes.length > 0) console.warn('The saved project had bad elements, dropped:', r.fixes);
    return r.doc;
  }
  console.warn(`The saved project could not be read (${r.error}); starting a new one. The saved copy is kept under`, `${DOC_KEY}.invalid`);
  storage()?.setItem(`${DOC_KEY}.invalid`, raw);
  return null;
}

/** The document if every element is valid, or null. Documents saved before openings, rooms or floors get none. */
export function validateDocument(raw: unknown): Doc | null {
  const r = repairProject(raw);
  return r.ok && r.fixes.length === 0 ? r.doc : null;
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
