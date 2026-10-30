// Saved views (saved-views.ts): names, the file, and what is dropped when read.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { deleteView, isSavedView, moveView, nextViewName, type SavedView, saveView, updateView } from '../../src/session/saved-views';
import { VIEW_3D_DEFAULT } from '../../src/app/view-3d';
import { detailOf } from '../../src/elements/drawing/schema';
import { readProject, writeProject } from '../../src/project/file';

const v3d: SavedView = { id: 'view_a', name: '3D 1', kind: '3d', levelId: 'lvl_ground', position: [10, 8, 12], target: [4, 1.4, -3], view3d: { ...VIEW_3D_DEFAULT, xray: true } };
const vPlan: SavedView = { id: 'view_b', name: 'Ground floor 1', kind: 'plan', levelId: 'lvl_ground', scale: 80, center: { x: 4, y: 3 } };

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
    const r = readProject(JSON.stringify({ ...newDocument(), views: [v3d, { ...vPlan, kind: 'side' }, { ...vPlan, id: 'view_c', levelId: 'gone' }] }));
    expect(r.ok && r.doc.views.map((v) => v.id)).toEqual(['view_a']);
    expect(r.ok && r.fixes).toEqual([
      { kind: 'droppedViews', count: 1 },
      { kind: 'droppedViews', count: 1 },
    ]);
  });

  it('renamed and captioned; an empty caption is none, an empty name keeps the old one', () => {
    const d = saveView(v3d).apply(newDocument());
    const named = updateView('view_a', { name: ' Entrada ', caption: ' A porta da frente ' }).apply(d);
    expect(named.views[0]).toMatchObject({ name: 'Entrada', caption: 'A porta da frente' });
    const cleared = updateView('view_a', { caption: '  ', name: '' }).apply(named);
    expect(cleared.views[0]!.name).toBe('Entrada');
    expect(cleared.views[0]).not.toHaveProperty('caption');
    expect(updateView('view_a', { name: 'Entrada' }).apply(named)).toBe(named);
  });

  it('moved up and down the list: the tour order; past either end, nothing', () => {
    const d = [v3d, vPlan, { ...v3d, id: 'view_c', name: '3D 2' }].reduce((doc, v) => saveView(v).apply(doc), newDocument());
    expect(moveView('view_c', -1).apply(d).views.map((v) => v.id)).toEqual(['view_a', 'view_c', 'view_b']);
    expect(moveView('view_a', 1).apply(d).views.map((v) => v.id)).toEqual(['view_b', 'view_a', 'view_c']);
    expect(moveView('view_a', -1).apply(d)).toBe(d);
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
