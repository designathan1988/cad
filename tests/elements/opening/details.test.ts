// A door's or window's details: every catalog model, closed, half and fully open, gives parts of some
// size inside a sane box; a leaf's design, handle and glazing bars add their parts; opening it moves the
// leaves (a swinging leaf turns out of the wall, a sliding one slides along it), and the amount is a range.

import { describe, expect, it } from 'vitest';
import { openingParts } from '../../../src/elements/opening/parts';
import { newOpening, type OpeningStyle } from '../../../src/elements/opening/schema';
import { isOpeningStyle, OPENING_MODELS, type OpeningModel } from '../../../src/elements/opening/style';
import { oid, wid } from '../../ids';

const frame = (width: number) => ({ start: { x: 0, y: 0 }, end: { x: width, y: 0 }, dir: { x: 1, y: 0 }, normal: { x: 0, y: 1 }, faces: [-0.075, 0.075] as const, region: [] });
const partsOf = (m: OpeningModel, style: Partial<OpeningStyle> = {}, forced = false) => {
  const opening = newOpening(oid('o'), wid('w'), m.kind, { kind: 'centered' }, { width: m.width, height: m.height, sill: m.sill, style: { ...m.style, ...style } });
  return openingParts({ opening, start: 0, end: m.width, bottom: m.sill, top: m.sill + m.height }, frame(m.width), forced);
};
const ys = (ps: ReturnType<typeof partsOf>, role: string) => ps.filter((p) => p.role === role).flatMap((p) => p.polygon.map((q) => q.y));

describe('every catalog model', () => {
  for (const m of OPENING_MODELS) {
    it(`${m.id}: valid, drawn closed, half and fully open within its reach`, () => {
      expect(isOpeningStyle(m.style)).toBe(true);
      for (const open of [0, 0.5, 1]) {
        const ps = partsOf(m, { open });
        expect(ps.length).toBeGreaterThan(3);
        for (const p of ps) {
          expect(p.top - p.bottom).toBeGreaterThan(0);
          for (const q of p.polygon) {
            expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
            // Never further from the opening than a leaf's width (plus trim).
            expect(q.x).toBeGreaterThan(-0.4);
            expect(q.x).toBeLessThan(m.width + 0.4);
            expect(Math.abs(q.y)).toBeLessThan(m.width + 0.4);
          }
        }
      }
    });
  }
});

const door = OPENING_MODELS.find((m) => m.id === 'doorSwing')!;
const slider = OPENING_MODELS.find((m) => m.id === 'doorSliding')!;
const window2 = OPENING_MODELS.find((m) => m.id === 'winCasement')!;

describe('details', () => {
  it('a raised-panel leaf, a glazed one and a handle each add their parts', () => {
    const flush = partsOf(door, { design: 'flush', handle: 'none' }).length;
    expect(partsOf(door, { design: 'panels', handle: 'none' }).length).toBeGreaterThan(flush);
    expect(ys(partsOf(door, { design: 'glazed', handle: 'none' }), 'glass').length).toBeGreaterThan(0);
    expect(partsOf(door, { design: 'flush', handle: 'lever' }).length).toBeGreaterThan(flush);
  });

  it('glazing bars split each pane', () => {
    const plain = partsOf(window2).length;
    expect(partsOf(window2, { muntins: 3 }).length).toBe(plain + 2 * 2 * window2.style.leaves);
  });

  it('a swinging leaf turns out of the wall as it opens, further the more it is open', () => {
    const reach = (open: number) => Math.max(...ys(partsOf(door, { open, handle: 'none' }), 'leaf').map(Math.abs));
    expect(reach(0)).toBeLessThan(0.1);
    expect(reach(0.5)).toBeGreaterThan(0.3);
    expect(reach(1)).toBeGreaterThan(reach(0.5));
  });

  it('a sliding leaf slides along the wall, staying in it', () => {
    const xs = (open: number) => partsOf(slider, { open, handle: 'none' }).filter((p) => p.role === 'leaf').flatMap((p) => p.polygon.map((q) => q.x));
    expect(Math.max(...xs(1))).toBeLessThan(Math.max(...xs(0)));
    expect(Math.max(...ys(partsOf(slider, { open: 1 }), 'leaf').map(Math.abs))).toBeLessThan(0.1);
  });

  it('opened in the view, it is drawn fully open whatever is set', () => {
    expect(partsOf(door, { open: 0 }, true)).toEqual(partsOf(door, { open: 1 }));
  });

  it('a file with an opening amount out of range, or an unknown design, is not taken', () => {
    expect(isOpeningStyle({ ...door.style, open: 1.5 })).toBe(false);
    expect(isOpeningStyle({ ...door.style, design: 'carved' })).toBe(false);
    expect(isOpeningStyle({ ...door.style, muntins: 1 })).toBe(false);
    expect(isOpeningStyle({ ...door.style, open: 0.4, design: 'panels', handle: 'knob', glazing: 'frosted', muntins: 3, leafMaterial: 'oak' })).toBe(true);
  });
});
