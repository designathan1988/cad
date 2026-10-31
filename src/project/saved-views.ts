// Saved views (Revit's views in the project browser, ArchiCAD's View Map): a 3D view's camera and
// what it shows, or a plan's level, zoom and position, under a name. In the document, so they go
// with the file; saving and deleting one are undo steps. Going to one changes only the interface.

import type { Category } from './derived-filters';
import { nextName } from '../project/layer-sets';
import { isCategoryList } from '../project/layer-sets';
import type { Command } from '../core/store';
import type { Point2 } from '../model/vector';
import type { Doc } from '../project/doc';
import type { View3D } from './view-prefs';
import type { LevelId } from './doc';

/** What a view shows besides its camera (a view template): the categories hidden, the overrides on. */
interface Shows {
  readonly hidden?: readonly Category[];
  readonly overrides?: boolean;
}

export type SavedView = Shows &
  (
  | {
      readonly id: string;
      readonly name: string;
      readonly kind: '3d';
      readonly levelId: LevelId;
      /** What the tour said at this stop (the tour is out of the app for now: kept as read). */
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
      readonly levelId: LevelId;
      readonly caption?: string;
      /** Pixels per metre, and the plan point in the middle. */
      readonly scale: number;
      readonly center: Point2;
      /** Its drawing scale (1 : den), and with it how much detail it shows (drawing/schema.ts: detailOf); the project's when absent. */
      readonly den?: number;
    }
  );

/** The next free name of a kind: "3D 1", "3D 2", or the level's name and a number for a plan. */
export const nextViewName = (views: readonly SavedView[], base: string): string => nextName(views.map((v) => v.name), base);
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
  if (o.caption !== undefined && typeof o.caption !== 'string') return false;
  if ((o.hidden !== undefined && !isCategoryList(o.hidden)) || (o.overrides !== undefined && typeof o.overrides !== 'boolean')) return false;
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
    return finite(o.scale) && o.scale > 0 && typeof c === 'object' && c !== null && finite(c.x) && finite(c.y) && (o.den === undefined || (finite(o.den) && o.den > 0));
  }
  return false;
}
