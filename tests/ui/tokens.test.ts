// The design system's tokens are defined once and used everywhere (ref/chat.txt:227): outside the
// token definitions, styles.css has no size in px and no colour of its own.

import { stylesText } from './styles-source';
import { describe, expect, it } from 'vitest';

const css = stylesText();
// Declarations that are not token definitions, comments or media conditions.
const declarations = css
  .split('\n')
  .map((line, i) => ({ line: i + 1, text: line.trim() }))
  .filter(({ text }) => text !== '' && !text.startsWith('--') && !text.startsWith('/*') && !text.startsWith('*') && !text.startsWith('@media'));

describe('design tokens', () => {
  it('no size in px outside the tokens', () => {
    expect(declarations.filter((d) => /\d+(\.\d+)?px\b/.test(d.text))).toEqual([]);
  });

  // ref/chat.txt:244: targets of at least 32 px, and 44 px on touch. The controls take their heights
  // from these tokens only (the rule above), so checking the tokens checks every control.
  it('every target size is at least 32 px, and 44 px on touch', () => {
    const targets = ['--control-h', '--control-h-sm', '--field-h', '--wide-btn-h', '--tool-w'];
    const px = (block: string, name: string) => Number(new RegExp(`${name}:[ ]*([0-9]+)px`).exec(block)?.[1]);
    const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    const touchAt = css.indexOf('@media (pointer: coarse)');
    const touch = css.slice(touchAt, css.indexOf('}', touchAt));
    expect(targets.filter((n) => !(px(root, n) >= 32))).toEqual([]);
    expect(['--control-h', '--control-h-sm', '--field-h', '--wide-btn-h'].filter((n) => !(px(touch, n) >= 44))).toEqual([]);
  });

  it('every token used is defined', () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    expect([...used].filter((name) => !defined.has(name))).toEqual([]);
  });

  it('no colour outside the tokens', () => {
    expect(declarations.filter((d) => /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(d.text))).toEqual([]);
  });
});
