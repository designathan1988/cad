// Libraries shared by link (io/library-file.ts): a link copied from the objects' or the materials'
// dialog, and a link opened, here or in a tab already open, bringing what it carries into the project
// open as one undo step. The hash is taken off the address after, so a reload does not bring it twice.

import { type LibraryFile, libraryFromHash, libraryHash, LINK_KEY, mergeLibrary } from '../io/library-file';
import { t } from '../ui/i18n';
import type { App } from './app';

/** Past this a link is cut by mail and chat programs: the file is the way then (about 100 kB). */
const LINK_MAX = 100_000;

/** The library's link copied to the clipboard, and said; too long, or the clipboard refused, said why. */
export async function copyLibraryLink(app: App, file: LibraryFile): Promise<void> {
  const url = `${location.origin}${location.pathname}${await libraryHash(file)}`;
  if (url.length > LINK_MAX) {
    app.toast(t('lib.linkTooLong', { kb: Math.round(url.length / 1000) }));
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    app.toast(t('lib.linkCopied', { defs: file.definitions.length, mats: file.materials.length }));
  } catch (e) {
    console.warn('The link could not be copied to the clipboard.', e);
    app.toast(t('lib.linkNotCopied', { error: e instanceof Error ? e.message : String(e) }));
  }
}

/** The library the address carries, brought into the project open; nothing when it carries none. */
export async function openLibraryLink(app: App): Promise<void> {
  if (!location.hash.includes(LINK_KEY)) return;
  const hash = location.hash;
  // Off the address first: a link that cannot be read is not tried again on every reload.
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  let raw: unknown;
  try {
    raw = await libraryFromHash(hash);
  } catch (e) {
    console.warn('The library link could not be read.', e);
    app.toast(t('lib.linkBad'));
    return;
  }
  const r = mergeLibrary(app.store.get(), raw);
  if (!r.ok) {
    app.toast(t('lib.linkBad'));
    return;
  }
  // One undo step, merged into the document as it is when the step is applied.
  app.store.dispatch({
    label: 'cmd.importLibrary',
    apply: (doc) => {
      const x = mergeLibrary(doc, raw);
      return x.ok ? x.doc : doc;
    },
  });
  app.toast(t('lib.fromLink', { defs: r.definitions, mats: r.materials, bad: r.bad, same: r.same }));
}

/** Links opened when the app starts, and pasted into a tab already open. */
export function wireLibraryLinks(app: App): void {
  void openLibraryLink(app);
  window.addEventListener('hashchange', () => void openLibraryLink(app));
}
