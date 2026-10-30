// The same action has the same name and key everywhere (ref/chat.txt:200): the toolbar tooltip, the
// command palette and the right-click menu agree, in both languages; buttons start with a verb (:235).

import { afterEach, describe, expect, it } from 'vitest';
import { setLang, t, type MessageKey } from '../../src/ui/i18n';

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
    it(`${lang}: a tool's tooltip is its palette name and its key`, () => {
      setLang(lang);
      for (const [tool, key] of tools) expect(t(`tool.${tool}Key` as MessageKey)).toBe(`${t(`tool.${tool}` as MessageKey)} (${key})`);
    });

    it(`${lang}: the menu and the palette name delete, frame and clear alike`, () => {
      setLang(lang);
      expect(t('ctx.delete')).toBe(t('pal.delete'));
      expect(t('ctx.frameSelection')).toBe(t('pal.frameSelection'));
      expect(t('ctx.frameAll')).toBe(t('pal.frameAll'));
      expect(t('ctx.clearSelection')).toBe(t('pal.clearSelection'));
    });
  }

  it('pt: buttons and menu items start with a verb', () => {
    setLang('pt');
    const firstWords = (['tool.wall', 'tool.door', 'tool.window', 'tool.room', 'tool.floor', 'ctx.flipHinge', 'ctx.properties', 'ctx.commands'] as MessageKey[]).map((k) => t(k).split(' ')[0]);
    expect(firstWords).toEqual(['Desenhar', 'Colocar', 'Colocar', 'Criar', 'Criar', 'Trocar', 'Mostrar', 'Abrir']);
  });
});

describe('the top bar, footer and help say what the palette says', () => {
  afterEach(() => setLang('en'));

  for (const lang of ['en', 'pt'] as const) {
    it(`${lang}: each button's tooltip is the palette name, with the key when it has one`, () => {
      setLang(lang);
      const pairs: [MessageKey, string][] = [
        ['top.undo', `${t('pal.undo')} (Ctrl+Z)`],
        ['top.redo', `${t('pal.redo')} (Ctrl+Shift+Z)`],
        ['top.commands', `${t('pal.commands')} (Ctrl+K)`],
        ['top.shortcuts', `${t('pal.shortcuts')} (?)`],
        ['top.language', `${t('pal.language')} (Shift+L)`],
        ['top.theme', t('pal.theme')],
        ['top.export', `${t('pal.save')} (Ctrl+S)`],
        ['top.open', `${t('pal.open')} (Ctrl+O)`],
        ['top.panel', t('pal.panel')],
        ['foot.snap', `${t('pal.snaps')} (S)`],
        ['tool.sidebar', t('pal.browser')],
      ];
      for (const [key, text] of pairs) expect(t(key), key).toBe(text);
    });

    it(`${lang}: the footer's short hint for Ctrl+A is the palette name in lower case`, () => {
      setLang(lang);
      expect(t('key.selectAll')).toBe(t('pal.selectAll').toLowerCase());
    });
  }

  it('pt: the top bar buttons start with a verb', () => {
    setLang('pt');
    const first = (['top.commands', 'top.shortcuts', 'top.language', 'top.theme', 'top.export', 'top.open', 'foot.snap'] as MessageKey[]).map((k) => t(k).split(' ')[0]);
    expect(first).toEqual(['Abrir', 'Mostrar', 'Trocar', 'Trocar', 'Salvar', 'Abrir', 'Ligar']);
  });
});
