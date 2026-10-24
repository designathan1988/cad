// The keyboard of a menu, as the W3C APG menu pattern describes it (docs/adr/0002-ui-patterns.md):
// what a key does to the focused item. Pure, so it is tested without a page.

import { fold } from './search';

export interface MenuKeyResult {
  readonly index: number;
  readonly run?: true;
  readonly close?: true;
}

export function menuKey(items: readonly { label: string; disabled: boolean }[], index: number, key: string): MenuKeyResult | null {
  const n = items.length;
  switch (key) {
    case 'ArrowDown':
      return { index: (index + 1) % n };
    case 'ArrowUp':
      return { index: (index - 1 + n) % n };
    case 'Home':
      return { index: 0 };
    case 'End':
      return { index: n - 1 };
    case 'Enter':
    case ' ':
      return items[index]?.disabled ? { index } : { index, run: true };
    case 'Escape':
    case 'Tab':
      return { index, close: true };
  }
  if (key.length !== 1) return null;
  // Typeahead: the next item after this one whose label starts with the letter.
  const letter = fold(key);
  for (let k = 1; k <= n; k++) {
    const i = (index + k) % n;
    if (fold(items[i]!.label).startsWith(letter)) return { index: i };
  }
  return { index };
}
