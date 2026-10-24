// Choosing elements without a mouse (ref/chat.txt:242): Tab goes to the next element of the level
// shown, Shift+Tab to the previous, in a fixed order (walls by number, then openings, rooms, floors).

import { describe, expect, it } from 'vitest';
import { stepSelection } from '../../src/app/keyboard-select';

const order = ['w1', 'w2', 'w3', 'o1', 'r1'];

describe('stepping through elements', () => {
  it('nothing selected: Tab takes the first, Shift+Tab the last', () => {
    expect(stepSelection(order, [], 1)).toBe('w1');
    expect(stepSelection(order, [], -1)).toBe('r1');
  });

  it('from one: the next or the previous, going round', () => {
    expect(stepSelection(order, ['w2'], 1)).toBe('w3');
    expect(stepSelection(order, ['w2'], -1)).toBe('w1');
    expect(stepSelection(order, ['r1'], 1)).toBe('w1');
    expect(stepSelection(order, ['w1'], -1)).toBe('r1');
  });

  it('from several: after the last of them in the order (or before the first)', () => {
    expect(stepSelection(order, ['o1', 'w2'], 1)).toBe('r1');
    expect(stepSelection(order, ['o1', 'w2'], -1)).toBe('w1');
  });

  it('nothing to choose: null', () => {
    expect(stepSelection([], ['x'], 1)).toBeNull();
  });
});
