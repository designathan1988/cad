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

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const triple = (a: unknown): boolean => Array.isArray(a) && a.length === 3 && a.every(finite);

/** Whether a stored value is a saved view (project-file.ts). */
export function isSavedView(v: unknown): v is SavedView {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.levelId !== 'string') return false;
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
