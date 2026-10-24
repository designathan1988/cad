// Automatic saving in the browser: the document (validated on the way back in) and the interface
// preferences, kept apart. Storage can be missing or full; then the app keeps working unsaved and
// says so in the console, and never drops the project it has in memory.

import type { Lang } from '../ui/i18n';
import type { Doc } from './document';

const DOC_KEY = 'cad2.document.v1';
const PREFS_KEY = 'cad2.prefs.v1';

export interface Prefs {
  lang?: Lang;
  theme?: 'light' | 'dark';
  view?: '3d' | 'plan';
  panelOpen?: boolean;
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

/** The saved document if it is valid; otherwise null and the reason in the console. */
export function loadDocument(): Doc | null {
  const raw = storage()?.getItem(DOC_KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<Doc>;
    const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
    const point = (p: unknown) => typeof p === 'object' && p !== null && finite((p as { x: unknown }).x) && finite((p as { y: unknown }).y);
    const ok =
      d.version === 1 &&
      Array.isArray(d.levels) &&
      d.levels.length > 0 &&
      Array.isArray(d.wallTypes) &&
      d.wallTypes.length > 0 &&
      Array.isArray(d.walls) &&
      d.walls.every((w) => typeof w.id === 'string' && point(w.start) && point(w.end) && typeof w.wallTypeId === 'string');
    if (ok) return d as Doc;
    console.warn('The saved project is not valid; starting a new one. The saved copy is kept under', `${DOC_KEY}.invalid`);
    storage()?.setItem(`${DOC_KEY}.invalid`, raw);
    return null;
  } catch (e) {
    console.warn('The saved project could not be read; starting a new one.', e);
    return null;
  }
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
