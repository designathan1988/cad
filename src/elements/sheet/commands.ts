// Commands on sheets and the views on them. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import { isSheet, isViewport, type Sheet, type Viewport } from './schema';

export const sheetsOf = (doc: Doc): readonly Sheet[] => doc.sheets ?? [];

const withSheets = (doc: Doc, sheets: readonly Sheet[]): Doc => ({ ...doc, sheets });

export const addSheet = (sheet: Sheet): Command<Doc> => ({
  label: 'cmd.addSheet',
  apply: (doc) => (!isSheet(sheet) || sheetsOf(doc).some((s) => s.id === sheet.id) ? doc : withSheets(doc, [...sheetsOf(doc), sheet])),
});

export type SheetPatch = Partial<Pick<Sheet, 'number' | 'name' | 'paper' | 'landscape'>>;

/** A sheet's number, name, paper or turn; a number another sheet has, or an empty one, changes nothing. */
export const updateSheet = (id: string, patch: SheetPatch): Command<Doc> => ({
  label: 'cmd.updateSheet',
  apply: (doc) => {
    const all = sheetsOf(doc);
    const was = all.find((s) => s.id === id);
    if (!was) return doc;
    const clean: SheetPatch = {
      ...patch,
      ...(patch.number !== undefined ? { number: patch.number.trim() } : {}),
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    };
    if (clean.number !== undefined && (clean.number === '' || all.some((s) => s.id !== id && s.number === clean.number))) return doc;
    const next = { ...was, ...clean };
    if (!isSheet(next) || JSON.stringify(next) === JSON.stringify(was)) return doc;
    return withSheets(doc, all.map((s) => (s.id === id ? next : s)));
  },
});

export const deleteSheet = (id: string): Command<Doc> => ({
  label: 'cmd.deleteSheet',
  apply: (doc) => (!sheetsOf(doc).some((s) => s.id === id) ? doc : withSheets(doc, sheetsOf(doc).filter((s) => s.id !== id))),
});

/** A sheet one place earlier (-1) or later (+1) in the set. */
export const moveSheet = (id: string, by: -1 | 1): Command<Doc> => ({
  label: 'cmd.moveSheet',
  apply: (doc) => {
    const all = [...sheetsOf(doc)];
    const i = all.findIndex((s) => s.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= all.length) return doc;
    [all[i], all[j]] = [all[j]!, all[i]!];
    return withSheets(doc, all);
  },
});

const onSheet = (doc: Doc, sheetId: string, change: (vs: readonly Viewport[]) => readonly Viewport[]): Doc => {
  const all = sheetsOf(doc);
  const s = all.find((x) => x.id === sheetId);
  if (!s) return doc;
  const viewports = change(s.viewports);
  return viewports === s.viewports ? doc : withSheets(doc, all.map((x) => (x.id === sheetId ? { ...x, viewports } : x)));
};

export const addViewport = (sheetId: string, v: Viewport): Command<Doc> => ({
  label: 'cmd.addViewport',
  apply: (doc) => (!isViewport(v) ? doc : onSheet(doc, sheetId, (vs) => (vs.some((x) => x.id === v.id) ? vs : [...vs, v]))),
});

/** A view's place, size, scale or what it shows; one that would not be a view changes nothing. */
export const updateViewport = (sheetId: string, id: string, patch: Partial<Viewport>, label = 'cmd.updateViewport'): Command<Doc> => ({
  label,
  apply: (doc) =>
    onSheet(doc, sheetId, (vs) => {
      const was = vs.find((x) => x.id === id);
      if (!was) return vs;
      const next = { ...was, ...patch, id: was.id, kind: was.kind } as Viewport;
      if (!isViewport(next) || JSON.stringify(next) === JSON.stringify(was)) return vs;
      return vs.map((x) => (x.id === id ? next : x));
    }),
});

export const deleteViewport = (sheetId: string, id: string): Command<Doc> => ({
  label: 'cmd.deleteViewport',
  apply: (doc) => onSheet(doc, sheetId, (vs) => (vs.some((x) => x.id === id) ? vs.filter((x) => x.id !== id) : vs)),
});
