// Saved views (saved-views.ts): names, the file, and what is dropped when read.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { deleteView, isSavedView, nextViewName, type SavedView, saveView } from '../../src/project/saved-views';
import { VIEW_3D_DEFAULT } from '../../src/session/view/view-3d';
import { detailOf } from '../../src/elements/drawing/schema';
import { readProject, writeProject } from '../../src/project/file';
import { lid } from '../ids';

const v3d: SavedView = { id: 'view_a', name: '3D 1', kind: '3d', levelId: lid('lvl_ground'), position: [10, 8, 12], target: [4, 1.4, -3], view3d: { ...VIEW_3D_DEFAULT, xray: true } };
const vPlan: SavedView = { id: 'view_b', name: 'Ground floor 1', kind: 'plan', levelId: lid('lvl_ground'), scale: 80, center: { x: 4, y: 3 } };

describe('saved views', () => {
  it('the next free name of a kind', () => {
    expect(nextViewName([], '3D')).toBe('3D 1');
    expect(nextViewName([v3d], '3D')).toBe('3D 2');
    expect(nextViewName([{ ...v3d, name: '3D 2' }], '3D')).toBe('3D 1');
  });

  it('saving and deleting are one step each, and delete leaves the others', () => {
    const one = saveView(v3d).apply(newDocument());
    const two = saveView(vPlan).apply(one);
    expect(two.views.map((v) => v.id)).toEqual(['view_a', 'view_b']);
    expect(deleteView('view_a').apply(two).views.map((v) => v.id)).toEqual(['view_b']);
    expect(deleteView('nope').apply(two)).toBe(two);
  });

  it('read back from the file as saved; an older file has none', () => {
    const back = readProject(writeProject({ ...newDocument(), views: [v3d, vPlan] }));
    expect(back.ok && back.doc.views).toEqual([v3d, vPlan]);
    const v5 = readProject(JSON.stringify({ ...newDocument(), version: 5, views: undefined }));
    expect(v5.ok && v5.doc.views).toEqual([]);
  });

  it('a malformed view, or one of a level that is gone, is dropped and said', () => {
    expect(isSavedView({ ...v3d, position: [1, 2] })).toBe(false);
    expect(isSavedView({ ...vPlan, scale: 0 })).toBe(false);
    expect(isSavedView({ ...v3d, view3d: { levels: 'all', explode: false, cut: false } })).toBe(false);
    const r = readProject(JSON.stringify({ ...newDocument(), views: [v3d, { ...vPlan, kind: 'side' }, { ...vPlan, id: 'view_c', levelId: lid('gone') }] }));
    expect(r.ok && r.doc.views.map((v) => v.id)).toEqual(['view_a']);
    expect(r.ok && r.fixes).toEqual([
      { kind: 'droppedViews', count: 1 },
      { kind: 'droppedViews', count: 1 },
    ]);
  });

  it('a caption that is not text is not a saved view', () => {
    expect(isSavedView({ ...v3d, caption: 3 })).toBe(false);
  });

  it('a plan view keeps a drawing scale of its own, and with it its detail; the file keeps it', () => {
    const at50: SavedView = { ...vPlan, den: 50 };
    expect(isSavedView(at50)).toBe(true);
    expect(isSavedView({ ...vPlan, den: 0 })).toBe(false);
    expect(isSavedView({ ...vPlan, den: 'x' })).toBe(false);
    expect(detailOf(50)).toBe('fine');
    expect(detailOf(200)).toBe('coarse');
    const r = readProject(writeProject(saveView(at50).apply(newDocument())));
    expect(r.ok && r.doc.views[0]).toMatchObject({ den: 50 });
  });
});
