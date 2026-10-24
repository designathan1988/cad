// Where the tour's card goes: beside its target, never over it, always inside the window.

import { describe, expect, it } from 'vitest';
import { placeCallout } from '../../src/ui/callout';

const view = { w: 1280, h: 720 };
const card = { w: 300, h: 140 };
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('tour card placement', () => {
  it('the tool bar on the left: the card goes to its right, level with it, inside the window', () => {
    const tools = { x: 0, y: 44, w: 48, h: 640 };
    const p = placeCallout(tools, card, view);
    expect(p.side).toBe('right');
    expect(p.x).toBe(48 + 12);
    expect(overlaps({ ...p, ...card }, tools)).toBe(false);
    expect(p.y + card.h).toBeLessThanOrEqual(view.h - 8);
  });

  it('the panel on the right: to its left', () => {
    const panel = { x: 992, y: 44, w: 288, h: 640 };
    const p = placeCallout(panel, card, view);
    expect(p.side).toBe('left');
    expect(p.x + card.w).toBe(992 - 12);
  });

  it('the footer across the bottom: above it', () => {
    const foot = { x: 0, y: 684, w: 1280, h: 36 };
    const p = placeCallout(foot, card, view);
    expect(p.side).toBe('above');
    expect(p.y + card.h).toBe(684 - 12);
  });

  it('a button in the top right corner: no room to its right, so to its left, top kept inside', () => {
    const button = { x: 1200, y: 6, w: 32, h: 32 };
    const p = placeCallout(button, card, view);
    expect(p.side).toBe('left');
    expect(p.x + card.w).toBe(1200 - 12);
    expect(p.y).toBe(8);
    expect(overlaps({ ...p, ...card }, button)).toBe(false);
  });

  it('a wide bar across the top: no room beside it, so below it', () => {
    const bar = { x: 0, y: 0, w: 1280, h: 44 };
    const p = placeCallout(bar, card, view);
    expect(p.side).toBe('below');
    expect(p.y).toBe(44 + 12);
  });

  it('a target that is not shown (no size): the card is centred', () => {
    const p = placeCallout({ x: 0, y: 0, w: 0, h: 0 }, card, view);
    expect(p.side).toBe('center');
    expect(p).toMatchObject({ x: (1280 - 300) / 2, y: (720 - 140) / 2 });
  });
});
