// A window's protection (phase 5: "venezianas e grades"): a grille's bars and a shutter's slats on its
// outside face, the shutter pushed aside when the window is drawn open; a door has neither.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { deriveGeometry } from '../../../src/project/derive';
import { openingParts } from '../../../src/elements/opening/parts';
import { newOpening, type OpeningStyle } from '../../../src/elements/opening/schema';
import { fitStyle, isOpeningStyle } from '../../../src/elements/opening/style';
import { wid } from '../../ids';
import { oid } from '../../ids';

const wall: DocWall = { id: wid('w'), wallTypeId: 'wt_masonry15', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, referenceLine: 'centerline', levelId: 'lvl_ground', baseOffset: 0, top: { kind: 'level', offset: 0 } };
const sliding: OpeningStyle = { operation: 'sliding', leaves: 2, frame: 0.05, casing: 0, transom: 0, threshold: false };
const parts = (style: OpeningStyle, open = false) => {
  const doc: Doc = { ...newDocument(), walls: [wall], openings: [{ ...newOpening(oid('win'), wid('w'), 'window', { kind: 'centered' }, { width: 1.2, height: 1.2, style }), sill: 1 }] };
  const o = deriveGeometry(doc).openings.get(oid('win'))!;
  return openingParts(o, o.frame!, open);
};

describe("a window's protection", () => {
  it('a grille: bars 12 cm apart across its 1.20 m (9 between the jambs) and two cross bars, outside the exterior face', () => {
    const plain = parts(sliding).length;
    const grilled = parts({ ...sliding, screen: 'grille' });
    expect(grilled.length - plain).toBe(9 + 2);
    // Open, a grille stays.
    expect(parts({ ...sliding, screen: 'grille' }, true).length - parts(sliding, true).length).toBe(11);
  });

  it('a shutter: two stiles and a slat every 5 cm over its 1.20 m; drawn open, it is pushed aside', () => {
    const plain = parts(sliding).length;
    const shut = parts({ ...sliding, screen: 'shutter' });
    // Slats from 3 cm up, 3 cm tall, 5 cm apart, while one fits under the head: 23 of them.
    expect(shut.length - plain).toBe(2 + 23);
    expect(shut.filter((p) => p.role === 'leaf').length - parts(sliding).filter((p) => p.role === 'leaf').length).toBe(23);
    expect(parts({ ...sliding, screen: 'shutter' }, true).length).toBe(parts(sliding, true).length);
  });

  it('kept in the style, checked as files are read; a door has none', () => {
    expect(isOpeningStyle({ ...sliding, screen: 'grille' })).toBe(true);
    expect(isOpeningStyle({ ...sliding, screen: 'curtain' })).toBe(false);
    expect(fitStyle('door', { ...sliding, operation: 'swing', leaves: 1, screen: 'grille' }).screen).toBeUndefined();
    expect(fitStyle('window', { ...sliding, screen: 'shutter' }).screen).toBe('shutter');
  });
});
