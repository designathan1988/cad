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
      expect(t('float.frame')).toBe(`${t('pal.frameAll')} (Home)`);
    });
  }

  it('pt: buttons and menu items start with a verb', () => {
    setLang('pt');
    const firstWords = (['tool.wall', 'tool.door', 'tool.window', 'tool.room', 'tool.floor', 'tour.prev', 'tour.next', 'tour.later', 'ctx.flipHinge', 'ctx.properties', 'ctx.commands'] as MessageKey[]).map((k) => t(k).split(' ')[0]);
    expect(firstWords).toEqual(['Desenhar', 'Colocar', 'Colocar', 'Criar', 'Criar', 'Voltar', 'Avançar', 'Deixar', 'Trocar', 'Mostrar', 'Abrir']);
  });
});
