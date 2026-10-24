// Keyboard of a menu (W3C APG menu pattern): arrows wrap, Home/End, Enter/Space run (not when
// disabled), Esc and Tab close, a letter jumps to the next item starting with it.

import { describe, expect, it } from 'vitest';
import { menuKey } from '../../src/ui/menu-keys';

const items = [
  { label: 'Select', disabled: false },
  { label: 'Delete', disabled: false },
  { label: 'Draw wall', disabled: true },
  { label: 'Frame all', disabled: false },
];

describe('menu keys', () => {
  it('arrows move and wrap at both ends', () => {
    expect(menuKey(items, 0, 'ArrowDown')).toEqual({ index: 1 });
    expect(menuKey(items, 3, 'ArrowDown')).toEqual({ index: 0 });
    expect(menuKey(items, 0, 'ArrowUp')).toEqual({ index: 3 });
  });

  it('disabled items can be focused but not run', () => {
    expect(menuKey(items, 1, 'ArrowDown')).toEqual({ index: 2 });
    expect(menuKey(items, 2, 'Enter')).toEqual({ index: 2 });
    expect(menuKey(items, 1, 'Enter')).toEqual({ index: 1, run: true });
    expect(menuKey(items, 1, ' ')).toEqual({ index: 1, run: true });
  });

  it('Home and End go to the ends; Esc and Tab close', () => {
    expect(menuKey(items, 2, 'Home')).toEqual({ index: 0 });
    expect(menuKey(items, 0, 'End')).toEqual({ index: 3 });
    expect(menuKey(items, 1, 'Escape')).toEqual({ index: 1, close: true });
    expect(menuKey(items, 1, 'Tab')).toEqual({ index: 1, close: true });
  });

  it('a letter jumps to the next item starting with it, ignoring case and accents, wrapping', () => {
    expect(menuKey(items, 0, 'd')).toEqual({ index: 1 });
    expect(menuKey(items, 1, 'd')).toEqual({ index: 2 });
    expect(menuKey(items, 2, 'D')).toEqual({ index: 1 });
    expect(menuKey([{ label: 'Édition', disabled: false }, { label: 'Zoom', disabled: false }], 1, 'e')).toEqual({ index: 0 });
    expect(menuKey(items, 0, 'q')).toEqual({ index: 0 });
  });

  it('other keys do nothing', () => {
    expect(menuKey(items, 1, 'Shift')).toBeNull();
  });
});
