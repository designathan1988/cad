// The design system's tokens are defined once and used everywhere (ref/chat.txt:227): outside the
// token definitions, styles.css has no size in px and no colour of its own.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
// Declarations that are not token definitions, comments or media conditions.
const declarations = css
  .split('\n')
  .map((line, i) => ({ line: i + 1, text: line.trim() }))
  .filter(({ text }) => text !== '' && !text.startsWith('--') && !text.startsWith('/*') && !text.startsWith('*') && !text.startsWith('@media'));

describe('design tokens', () => {
  it('no size in px outside the tokens', () => {
    expect(declarations.filter((d) => /\d+(\.\d+)?px\b/.test(d.text))).toEqual([]);
  });

  it('no colour outside the tokens', () => {
    expect(declarations.filter((d) => /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(d.text))).toEqual([]);
  });
});
