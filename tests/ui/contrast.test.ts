// Contrast in both themes (ref/chat.txt:228), measured from the design tokens as styles.css defines
// them, with the WCAG 2.2 formula: 4.5 for text, 3 for controls, outlines and large marks.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');

/** The custom properties of the first block whose selector is exactly `selector`. */
function tokens(selector: string): Map<string, string> {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no block ${selector}`);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

const light = tokens(':root');
// The dark theme overrides some tokens; the rest are the light ones.
const dark = new Map([...light, ...tokens(":root[data-theme='dark']")]);

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

// [foreground, background, minimum, what it is]
const pairs: [string, string, number, string][] = [
  ['--text', '--bg', 4.5, 'text'],
  ['--text-2', '--bg', 4.5, 'secondary text (labels, hints)'],
  ['--text-2', '--field', 4.5, 'secondary text on a field'],
  ['--text-3', '--bg', 4.5, 'units and quiet text'],
  ['--text', '--canvas', 4.5, 'room names on the drawing'],
  ['--text-2', '--canvas', 4.5, 'room areas on the drawing'],
  ['--accent-text', '--canvas', 4.5, 'the live measure'],
  ['--accent-text', '--accent-soft', 4.5, 'selected items'],
  ['--accent-contrast', '--accent', 4.5, 'text on the main button'],
  ['--warn', '--bg', 4.5, 'warning text'],
  ['--warn', '--warn-soft', 4.5, 'warning box'],
  ['--warn', '--canvas', 4.5, 'warning tags on the drawing'],
  ['--error', '--bg', 4.5, 'error message'],
  ['--snap', '--bg', 4.5, 'snap label'],
  ['--bg', '--text', 4.5, 'tooltip'],
  ['--wall-sel', '--canvas', 3, 'selection on the drawing'],
  ['--accent', '--bg', 3, 'focus ring and pressed tools'],
  ['--border-strong', '--bg', 3, 'dialog edges'],
  // Walls in plan by layer: the outline and the lines between layers on every layer's colour. A line
  // is 1 px and antialiasing takes some of it (the tester measured 2.95 on a pixel at a 3.1 token
  // pair): 4.5 between the tokens keeps it above 3 on screen.
  ['--wall-line', '--layer-structure', 4.5, 'line on a core layer'],
  ['--wall-line', '--layer-substrate', 4.5, 'line on a substrate layer'],
  ['--wall-line', '--layer-thermal', 4.5, 'line on an insulation layer'],
  ['--wall-line', '--layer-finish', 4.5, 'line on a finish layer'],
];

describe('contrast of the design tokens', () => {
  for (const [name, theme] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`${name} theme: every pair reaches its minimum`, () => {
      const low = pairs
        .map(([fg, bg, min, what]) => ({ what, fg, bg, min, got: ratio(theme.get(fg)!, theme.get(bg)!) }))
        .filter((p) => p.got < p.min)
        .map((p) => `${p.what}: ${p.fg} on ${p.bg} ${p.got.toFixed(2)} < ${p.min}`);
      expect(low).toEqual([]);
    });
  }
});
