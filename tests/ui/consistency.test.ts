// The same action has the same name and key everywhere (ref/chat.txt:200): the ribbon's and the title
// bar's tips, the footer, the command palette and the right-click menu read them from the action list
// (app/actions.ts), so they agree in both languages, and a key the user changes changes in all of them.
// Buttons start with a verb (:235).

import { afterEach, describe, expect, it } from 'vitest';
import { appActions, tipOf, type Action } from '../../src/app/actions';
import type { App } from '../../src/app/app';
import { newDocument } from '../../src/app/document';
import type { KeyMap } from '../../src/app/keymap';
import { createStore } from '../../src/core/store';
import { setLang, t, type MessageKey } from '../../src/ui/i18n';
import { VIEW_3D_DEFAULT } from '../../src/app/view-3d';

// Only what appActions reads; no action runs here.
function actions(keymap: KeyMap = {}): Map<string, Action> {
  const app = { store: createStore(newDocument()), ui: { selection: new Set(), view: 'plan', levelId: 'lvl_ground', hidden: new Set(), view3d: VIEW_3D_DEFAULT }, keymap, canMergeSelection: () => false, selectedDoor: () => false, arrangeItems: () => [] } as unknown as App;
  const none = () => {};
  const list = appActions(app, { help: none, levels: none, wallTypes: none, materials: none, units: none, objects: none, openings: none, floors: none, presets: none, openFile: none, projects: none, drawing: none, keys: none, variables: none });
  return new Map(list.map((a) => [a.id, a]));
}
const tip = (keymap: KeyMap, id: string) => tipOf(actions(keymap).get(id)!);

const tools: [string, string][] = [
  ['select', 'V'],
  ['wall', 'W'],
  ['door', 'D'],
  ['window', 'Shift+W'],
  ['room', 'R'],
  ['floor', 'L'],
];

describe('names and keys agree', () => {
  afterEach(() => setLang('en'));

  for (const lang of ['en', 'pt'] as const) {
    it(`${lang}: a tool's tip is its palette name and its key`, () => {
      setLang(lang);
      for (const [tool, key] of tools) expect(tip({}, `tool.${tool}`)).toBe(`${t(`tool.${tool}` as MessageKey)} (${key})`);
    });

    it(`${lang}: the menu and the palette name delete, frame and clear alike`, () => {
      setLang(lang);
      expect(t('ctx.delete')).toBe(t('pal.delete'));
      expect(t('ctx.frameSelection')).toBe(t('pal.frameSelection'));
      expect(t('ctx.frameAll')).toBe(t('pal.frameAll'));
      expect(t('ctx.clearSelection')).toBe(t('pal.clearSelection'));
      expect(tip({}, 'view.frameAll')).toBe(`${t('pal.frameAll')} (Home)`);
    });
  }

  it('pt: buttons and menu items start with a verb', () => {
    setLang('pt');
    const firstWords = (['tool.wall', 'tool.door', 'tool.window', 'tool.room', 'tool.floor', 'ctx.flipHinge', 'ctx.properties', 'ctx.commands'] as MessageKey[]).map((k) => t(k).split(' ')[0]);
    expect(firstWords).toEqual(['Desenhar', 'Colocar', 'Colocar', 'Criar', 'Criar', 'Trocar', 'Mostrar', 'Abrir']);
  });
});

describe('the title bar and footer say what the palette says', () => {
  afterEach(() => setLang('en'));

  // The actions behind the title bar's buttons and the snaps button (app/chrome.ts writes their tips).
  const buttons: [string, MessageKey, string][] = [
    ['edit.undo', 'pal.undo', 'Ctrl+Z'],
    ['edit.redo', 'pal.redo', 'Ctrl+Shift+Z'],
    ['help.commands', 'pal.commands', 'Ctrl+K'],
    ['help.shortcuts', 'pal.shortcuts', '?'],
    ['settings.language', 'pal.language', 'Shift+L'],
    ['file.save', 'pal.save', 'Ctrl+S'],
    ['file.open', 'pal.open', 'Ctrl+O'],
    ['settings.snaps', 'pal.snaps', 'S'],
  ];

  for (const lang of ['en', 'pt'] as const) {
    it(`${lang}: each button's tip is the palette name, with the key when it has one`, () => {
      setLang(lang);
      for (const [id, name, key] of buttons) expect(tip({}, id), id).toBe(`${t(name)} (${key})`);
      // The buttons with no key: their names alone.
      expect(t('top.theme')).toBe(t('pal.theme'));
      expect(t('top.panel')).toBe(t('pal.panel'));
      expect(t('tool.sidebar')).toBe(t('pal.browser'));
    });

    it(`${lang}: the footer's short hint for the select-all key is the palette name in lower case`, () => {
      setLang(lang);
      expect(t('key.selectAll')).toBe(t('pal.selectAll').toLowerCase());
    });
  }

  it('a key the user changes is the one every tip says, and one turned off is not said', () => {
    expect(tip({ 'edit.undo': 'Ctrl+U' }, 'edit.undo')).toBe(`${t('pal.undo')} (Ctrl+U)`);
    expect(tip({ 'settings.snaps': 'G' }, 'settings.snaps')).toBe(`${t('pal.snaps')} (G)`);
    expect(tip({ 'help.commands': null }, 'help.commands')).toBe(t('pal.commands'));
  });

  it('pt: the title bar buttons start with a verb', () => {
    setLang('pt');
    const first = (['pal.commands', 'pal.shortcuts', 'pal.language', 'top.theme', 'pal.save', 'pal.open', 'pal.snaps'] as MessageKey[]).map((k) => t(k).split(' ')[0]);
    expect(first).toEqual(['Abrir', 'Mostrar', 'Trocar', 'Trocar', 'Salvar', 'Abrir', 'Ligar']);
  });
});
