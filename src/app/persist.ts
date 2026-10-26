// Automatic saving in the browser: the document (validated on the way back in) and the interface
// preferences, kept apart. Storage can be missing or full; then the app keeps working unsaved and
// says so in the console, and never drops the project it has in memory.

import type { Lang } from '../ui/i18n';
import { readProject, repairProject } from '../io/project-file';
import type { Doc } from './document';
import type { View3D } from './view-3d';

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
  /** The first-use tour was taken, skipped or declined: it is not offered again. */
  tourSeen?: boolean;
  /** How the 3D view shows the levels (view-3d.ts). */
  view3d?: View3D;
  /** Every wall's reference line shown in plan, not only the selected ones'. */
  refLines?: boolean;
  /** Doors' and windows' type marks shown in plan (default on). */
  openingTags?: boolean;
  /** Points snap (S): off, it stays off. */
  snaps?: boolean;
  /** Where the plan was looking (pixels per metre, world point at the centre): a reload framed it all again. */
  planView?: { scale: number; center: { x: number; y: number } };
  /** Walking: the eyes' height above the floor (m). */
  eyeHeight?: number;
  /** A tour's stop, playing by itself (s). */
  tourSeconds?: number;
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

/** Saves what is waiting, now: when the page is hidden or closed, nothing is left behind. */
export function flushSave(): void {
  if (!pending) return;
  const doc = pending;
  pending = null;
  saveDocument(doc);
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
    flushSave();
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1000 });
  else setTimeout(run, 200);
}

/** Saves what is waiting when the page is hidden or about to close. */
export function wireSaving(): void {
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
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
