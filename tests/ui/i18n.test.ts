import { afterEach, describe, expect, it } from 'vitest';
import { defaultName, name, setLang } from '../../src/ui/i18n';

describe('stored names', () => {
  afterEach(() => setLang('en'));

  it('default names are stored in one form and read in the language of the moment', () => {
    expect(defaultName.level(2)).toBe('Level 2');
    expect(defaultName.room(3)).toBe('Room 3');
    setLang('pt');
    expect(name(defaultName.level(2))).toBe('Pavimento 2');
    expect(name(defaultName.room(3))).toBe('Cômodo 3');
    expect(name('Ground floor')).toBe('Térreo');
    setLang('en');
    expect(name(defaultName.room(3))).toBe('Room 3');
  });

  it("the user's own names are never translated", () => {
    setLang('pt');
    expect(name('Level of the roof')).toBe('Level of the roof');
    expect(name('Room 3b')).toBe('Room 3b');
  });
});
