// A window's mullions and transoms where they are wanted (phase 5: "particionamento de janela com
// montantes e travessas em posições livres"). A window 1.20 wide centred on a wall along x from 0 to 4
// (its jambs at x 1.4 and 2.6), 1.20 high on a 1.00 sill, a 5 cm frame: its clear opening runs from
// 0.05 to 1.15 along it (x 1.45 to 2.55) and from 1.05 to 2.15 up.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/app/document';
import { deriveGeometry } from '../../../src/app/geometry';
import { openingParts } from '../../../src/elements/opening/parts';
import { newOpening, type OpeningStyle } from '../../../src/elements/opening/schema';
import { fitStyle, isOpeningStyle, paneRows, paneSpans } from '../../../src/elements/opening/style';
import { symbolLines } from '../../../src/elements/opening/symbol';

const wall: DocWall = { id: 'w', wallTypeId: 'wt_masonry15', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, referenceLine: 'centerline', levelId: 'lvl_ground', baseOffset: 0, top: { kind: 'level', offset: 0 } };
const fixed: OpeningStyle = { operation: 'fixed', leaves: 1, frame: 0.05, casing: 0, transom: 0, threshold: false };
const placed = (style: OpeningStyle) => {
  const doc: Doc = { ...newDocument(), walls: [wall], openings: [{ ...newOpening('win', 'w', 'window', { kind: 'centered' }, { width: 1.2, height: 1.2, style }), sill: 1 }] };
  return deriveGeometry(doc).openings.get('win')!;
};
const glass = (style: OpeningStyle) => {
  const o = placed(style);
  return openingParts(o, o.frame!, false)
    .filter((p) => p.role === 'glass')
    .map((p) => ({ x0: Math.min(...p.polygon.map((q) => q.x)), x1: Math.max(...p.polygon.map((q) => q.x)), z0: p.bottom, z1: p.top }))
    .sort((a, b) => a.x0 - b.x0 || a.z0 - b.z0);
};

describe("a window's mullions and transoms", () => {
  it('a mullion 30 cm from the jamb: a narrow pane and a wide one, each its sash 4 cm in from its edges', () => {
    const g = glass({ ...fixed, mullions: [0.3] });
    expect(g).toHaveLength(2);
    // Panes from x 1.45 to 1.75 and 1.75 to 2.55; their glass 4 cm in.
    expect(g.map((p) => [p.x0, p.x1].map((v) => Math.round(v * 1000) / 1000))).toEqual([
      [1.49, 1.71],
      [1.79, 2.51],
    ]);
  });

  it('a transom 40 cm up: each pane in two rows, 1.05 to 1.45 and 1.45 to 2.15', () => {
    const g = glass({ ...fixed, mullions: [0.3], transoms: [0.4] });
    expect(g).toHaveLength(4);
    // The rows' glass, the sash 4 cm in from each row's bottom and top.
    expect(g.slice(0, 2).map((p) => [p.z0, p.z1].map((v) => Math.round(v * 1000) / 1000))).toEqual([
      [1.09, 1.41],
      [1.49, 2.11],
    ]);
    expect(paneRows({ ...fixed, transoms: [0.4] }, 1.05, 2.15).map((r) => r.map((v) => Math.round(v * 1000) / 1000))).toEqual([
      [1.05, 1.45],
      [1.45, 2.15],
    ]);
  });

  it('in plan, the mullion is a line across the wall where it is', () => {
    const o = placed({ ...fixed, mullions: [0.3] });
    const across = symbolLines(o, o.frame).filter((l) => l.length === 2 && Math.abs(l[0]!.x - l[1]!.x) < 1e-9);
    expect(across.map((l) => Math.round(l[0]!.x * 1000) / 1000)).toEqual([1.75]);
  });

  it('a casement opens each pane by its own width', () => {
    const o = placed({ ...fixed, operation: 'casement', leaves: 2, mullions: [0.3] });
    const leaves = symbolLines(o, o.frame)
      // The leaves square to the wall (the frame's lines across its 15 cm are not).
      .filter((l) => l.length === 2 && Math.abs(l[0]!.x - l[1]!.x) < 1e-9 && Math.abs(l[0]!.y - l[1]!.y) > 0.2)
      .map((l) => Math.round(Math.abs(l[1]!.y - l[0]!.y) * 1000) / 1000)
      .sort();
    expect(leaves).toEqual([0.3, 0.8]);
  });

  it('without them, equal panes as before; one past the frame or too near another is left out', () => {
    expect(paneSpans({ ...fixed, leaves: 2 }, 0.05, 1.1).map((s) => s.map((v) => Math.round(v * 1000) / 1000))).toEqual([
      [0.05, 0.6],
      [0.6, 1.15],
    ]);
    // 1.08 is within 5 cm of the far jamb (1.10 clear), 0.32 within 5 cm of 0.30.
    expect(paneSpans({ ...fixed, mullions: [0.3, 0.32, 1.08] }, 0.05, 1.1).map((s) => s.map((v) => Math.round(v * 1000) / 1000))).toEqual([
      [0.05, 0.35],
      [0.35, 1.15],
    ]);
  });

  it("kept to panes side by side: a sliding window's and a door's let go; the panes counted from them", () => {
    expect(fitStyle('window', { ...fixed, operation: 'sliding', leaves: 2, mullions: [0.3] }).mullions).toBeUndefined();
    expect(fitStyle('door', { ...fixed, operation: 'swing', mullions: [0.3], transoms: [0.5] })).not.toHaveProperty('transoms');
    expect(fitStyle('window', { ...fixed, mullions: [0.9, 0.3, 0.6] })).toMatchObject({ mullions: [0.3, 0.6, 0.9], leaves: 4 });
    expect(fitStyle('window', { ...fixed, mullions: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7] }).mullions).toHaveLength(5);
    expect(isOpeningStyle({ ...fixed, mullions: [0.3], transoms: [0.4] })).toBe(true);
    expect(isOpeningStyle({ ...fixed, mullions: ['a'] })).toBe(false);
    expect(isOpeningStyle({ ...fixed, transoms: [-1] })).toBe(false);
  });
});
