// The view by keyboard (the tester's K4): + and − zoom, Shift+arrows move the plan or turn the 3D view.
// Plain arrows stay with the selection (nudge), and in a tool waiting for a measure − is a sign.

import { describe, expect, it } from 'vitest';
import { viewKey } from '../../src/session/view-keys';

const k = (key: string, mods: Partial<{ shift: boolean; ctrl: boolean; alt: boolean; typing: boolean }> = {}) =>
  viewKey(key, { shift: false, ctrl: false, alt: false, typing: false, ...mods });

describe('viewKey', () => {
  it('+ (or =) zooms in, − zooms out', () => {
    expect(k('+')).toEqual({ zoom: 1.25 });
    expect(k('=')).toEqual({ zoom: 1.25 });
    expect(k('-')).toEqual({ zoom: 0.8 });
  });
  it('Shift+arrows move the view, 80 px a press; Shift with + is still a zoom', () => {
    expect(k('ArrowLeft', { shift: true })).toEqual({ pan: { x: 80, y: 0 } });
    expect(k('ArrowDown', { shift: true })).toEqual({ pan: { x: 0, y: -80 } });
    expect(k('+', { shift: true })).toEqual({ zoom: 1.25 });
  });
  it('not plain arrows (the selection), not with Ctrl or Alt, and not − while a measure is typed', () => {
    expect(k('ArrowLeft')).toBeNull();
    expect(k('ArrowLeft', { shift: true, alt: true })).toBeNull();
    expect(k('+', { ctrl: true })).toBeNull();
    expect(k('-', { typing: true })).toBeNull();
  });
});
