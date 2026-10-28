// The command palette's list: every tool, view, edit, file, setting, level and help action, named in
// both languages, enabled only when it can run.

import { afterEach, describe, expect, it } from 'vitest';
import { appActions } from '../../src/app/actions';
import type { App } from '../../src/app/app';
import { newDocument } from '../../src/app/document';
import { createStore } from '../../src/core/store';
import { addLevel } from '../../src/elements/level/commands';
import { setLang } from '../../src/ui/i18n';
import { VIEW_3D_DEFAULT } from '../../src/app/view-3d';

// Only what appActions reads; the actions themselves are not run here.
function fakeApp(selection: string[] = [], view: '3d' | 'plan' = 'plan') {
  const store = createStore(addLevel('lvl_up', 'Upper').apply(newDocument()));
  return { store, ui: { selection: new Set(selection), view, levelId: 'lvl_ground', hidden: new Set(), view3d: VIEW_3D_DEFAULT }, canMergeSelection: () => false, selectedDoor: () => false, arrangeItems: () => [] } as unknown as App;
}
const openers = { help: () => {}, levels: () => {}, wallTypes: () => {}, materials: () => {}, units: () => {}, objects: () => {}, openings: () => {}, floors: () => {}, presets: () => {}, openFile: () => {}, projects: () => {}, drawing: () => {}, keys: () => {}, variables: () => {} };

describe('palette actions', () => {
  afterEach(() => setLang('en'));

  it(`a new project is in the palette: typed "nov" in Portuguese finds it (the tester's K1)`, () => {
    setLang('pt');
    const found = appActions(fakeApp(), openers).filter((x) => `${x.label} ${x.keywords}`.toLowerCase().includes('nov'));
    expect(found.map((x) => x.id)).toContain('file.new');
  });

  it('covers every tool, both views, files, settings, each level and help, with unique ids', () => {
    const ids = appActions(fakeApp(), openers).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      'tool.select', 'tool.wall', 'tool.arcWall', 'tool.floor', 'tool.door', 'tool.window', 'tool.room',
      'view.3d', 'view.plan', 'view.frameSelection', 'view.frameAll',
      'edit.undo', 'edit.redo', 'edit.delete', 'edit.selectAll', 'edit.clearSelection', 'edit.split', 'edit.corner', 'edit.merge',
      'file.new', 'file.open', 'file.save', 'settings.snaps', 'settings.theme', 'settings.language', 'settings.panel', 'settings.browser',
      'layer.walls', 'layer.openings', 'layer.rooms', 'layer.floors', 'layer.guides', 'edit.clearGuides',
      'view.levelsAll', 'view.levelsBelow', 'view.levelsCurrent', 'view.explode', 'view.cut',
      'level.lvl_ground', 'level.lvl_up', 'level.edit', 'help.shortcuts',
    ]) expect(ids).toContain(id);
  });

  it('the keys shown are the keys the app answers to', () => {
    const keys = Object.fromEntries(appActions(fakeApp(), openers).map((a) => [a.id, a.keys]));
    expect(keys).toMatchObject({
      'tool.select': 'V', 'tool.wall': 'W', 'tool.floor': 'L', 'tool.door': 'D', 'tool.window': 'Shift+W', 'tool.room': 'R',
      'view.3d': '1', 'view.plan': '2', 'view.frameSelection': 'F', 'view.frameAll': 'Home',
      'edit.undo': 'Ctrl+Z', 'edit.redo': 'Ctrl+Shift+Z', 'edit.delete': 'Del', 'edit.selectAll': 'Ctrl+A',
      'edit.split': 'Shift+S', 'edit.corner': 'Shift+T', 'edit.merge': 'Shift+J',
      'file.open': 'Ctrl+O', 'file.save': 'Ctrl+S', 'settings.snaps': 'S', 'settings.language': 'Shift+L', 'help.shortcuts': '?',
      // The right-click menu's and the floating bar's keys are these (context-menu.ts), so they are actions too.
      'edit.flipHinge': 'H', 'help.commands': 'Ctrl+K',
    });
  });

  it('enabled only when it can run: nothing to undo, nothing selected, the view and level already shown', () => {
    const on = (app: App) => Object.fromEntries(appActions(app, openers).map((a) => [a.id, a.enabled]));
    const empty = on(fakeApp());
    expect(empty).toMatchObject({ 'edit.merge': false, 'edit.undo': false, 'edit.redo': false, 'edit.delete': false, 'view.frameSelection': false, 'view.plan': false, 'view.3d': true, 'level.lvl_ground': false, 'level.lvl_up': true });
    expect(on(fakeApp(['w1'], '3d'))).toMatchObject({ 'edit.delete': true, 'view.frameSelection': true, 'view.3d': false, 'view.plan': true });
  });

  it('every label is written in both languages and found by either', () => {
    setLang('pt');
    const pt = appActions(fakeApp(), openers);
    setLang('en');
    const en = appActions(fakeApp(), openers);
    pt.forEach((a, i) => {
      expect(a.label.trim(), a.id).not.toBe('');
      expect(a.keywords, a.id).toContain(en[i]!.label.split(' ')[0]);
    });
    expect(pt.find((a) => a.id === 'tool.wall')!.label).toBe('Desenhar parede');
    expect(en.find((a) => a.id === 'level.lvl_up')!.label).toBe('Go to level Upper');
  });
});
