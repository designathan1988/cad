// Saved views (Revit's views in the project browser, ArchiCAD's View Map): a 3D view's camera and
// what it shows, or a plan's level, zoom and position, under a name. In the document, so they go
// with the file; saving and deleting one are undo steps. Going to one changes only the interface.

import type { Command } from '../core/store';
import type { Point2 } from '../core/vector';
import type { Doc } from './document';
import type { View3D } from './view-3d';

export type SavedView =
  | {
      readonly id: string;
      readonly name: string;
      readonly kind: '3d';
      readonly levelId: string;
      /** What the tour says at this stop (tour.ts); none when absent. */
      readonly caption?: string;
      /** Camera position and the point it looks at, in three.js coordinates (y up). */
      readonly position: readonly [number, number, number];
      readonly target: readonly [number, number, number];
      readonly view3d: View3D;
    }
  | {
      readonly id: string;
      readonly name: string;
      readonly kind: 'plan';
      readonly levelId: string;
      readonly caption?: string;
      /** Pixels per metre, and the plan point in the middle. */
      readonly scale: number;
      readonly center: Point2;
    };

/** The next free name of a kind: "3D 1", "3D 2", or the level's name and a number for a plan. */
export function nextViewName(views: readonly SavedView[], base: string): string {
  const taken = new Set(views.map((v) => v.name));
  for (let n = 1; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

export const saveView = (view: SavedView): Command<Doc> => ({
  label: 'cmd.saveView',
  apply: (doc) => ({ ...doc, views: [...doc.views, view] }),
});

export const deleteView = (id: string): Command<Doc> => ({
  label: 'cmd.deleteView',
  apply: (doc) => (doc.views.some((v) => v.id === id) ? { ...doc, views: doc.views.filter((v) => v.id !== id) } : doc),
});

/** A view's name or caption changed; an empty caption is none. */
export const updateView = (id: string, patch: { readonly name?: string; readonly caption?: string }): Command<Doc> => ({
  label: 'cmd.updateView',
  apply: (doc) => {
    let changed = false;
    const views = doc.views.map((v) => {
      if (v.id !== id) return v;
      const name = patch.name !== undefined && patch.name.trim() !== '' ? patch.name.trim() : v.name;
      const caption = patch.caption !== undefined ? patch.caption.trim() : (v.caption ?? '');
      if (name === v.name && caption === (v.caption ?? '')) return v;
      changed = true;
      const { caption: _c, ...rest } = v;
      return (caption === '' ? { ...rest, name } : { ...rest, name, caption }) as SavedView;
    });
    return changed ? { ...doc, views } : doc;
  },
});

/** A view one place earlier (−1) or later (+1) in the list: the tour's order. */
export const moveView = (id: string, step: -1 | 1): Command<Doc> => ({
  label: 'cmd.moveView',
  apply: (doc) => {
    const i = doc.views.findIndex((v) => v.id === id);
    const j = i + step;
    if (i < 0 || j < 0 || j >= doc.views.length) return doc;
    const views = [...doc.views];
    [views[i], views[j]] = [views[j]!, views[i]!];
    return { ...doc, views };
  },
});

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const triple = (a: unknown): boolean => Array.isArray(a) && a.length === 3 && a.every(finite);

/** Whether a stored value is a saved view (project-file.ts). */
export function isSavedView(v: unknown): v is SavedView {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.levelId !== 'string') return false;
  if (o.caption !== undefined && typeof o.caption !== 'string') return false;
  if (o.kind === '3d') {
    const w = o.view3d as Record<string, unknown> | undefined;
    return (
      triple(o.position) &&
      triple(o.target) &&
      typeof w === 'object' &&
      w !== null &&
      ['all', 'below', 'current'].includes(w.levels as string) &&
      typeof w.explode === 'boolean' &&
      typeof w.cut === 'boolean' &&
      typeof w.xray === 'boolean'
    );
  }
  if (o.kind === 'plan') {
    const c = o.center as Record<string, unknown> | undefined;
    return finite(o.scale) && o.scale > 0 && typeof c === 'object' && c !== null && finite(c.x) && finite(c.y);
  }
  return false;
}
