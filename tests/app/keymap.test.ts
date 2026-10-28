// Remapped and turned-off shortcuts (phase 9; WCAG 2.1.4): keys written one way, a key the user gave
// running its action, an action's own key doing nothing once it has another or none, a key given to
// one action taken from the other.

import { describe, expect, it } from 'vitest';
import { actionOfKey, assignKey, comboOf, keyOf, normalizeCombo, type KeyMap } from '../../src/app/keymap';

const ev = (key: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) => ({ key, ctrlKey: !!mods.ctrl, metaKey: false, altKey: !!mods.alt, shiftKey: !!mods.shift });
const actions = [
  { id: 'tool.wall', defaultKeys: 'W' },
  { id: 'tool.window', defaultKeys: 'Shift+W' },
  { id: 'tool.door', defaultKeys: 'D' },
  { id: 'file.print', defaultKeys: 'Ctrl+P' },
  { id: 'tool.arc', defaultKeys: 'W, A' },
  { id: 'edit.redo', defaultKeys: 'Ctrl+Shift+Z' },
  { id: 'edit.paste' },
];
// The actions with their keys under a map, as the action list (app/actions.ts) builds them.
const keyed = (map: KeyMap) =>
  actions.map((a) => {
    const keys = keyOf(a.id, a.defaultKeys, map);
    return keys === undefined ? a : { ...a, keys };
  });

describe('keys as written', () => {
  it('modifiers in one order, a letter in capitals', () => {
    expect(normalizeCombo('shift+ctrl+z')).toBe('Ctrl+Shift+Z');
    expect(normalizeCombo('w')).toBe('W');
    expect(normalizeCombo('Cmd+P')).toBe('Ctrl+P');
  });

  it('an event as written: Shift with a letter, a symbol as typed, named keys short', () => {
    expect(comboOf(ev('w'))).toBe('W');
    expect(comboOf(ev('W', { shift: true }))).toBe('Shift+W');
    expect(comboOf(ev('p', { ctrl: true }))).toBe('Ctrl+P');
    expect(comboOf(ev('?', { shift: true }))).toBe('?');
    expect(comboOf(ev('Delete'))).toBe('Del');
    expect(comboOf(ev('Escape'))).toBe('Esc');
    expect(comboOf(ev('F7'))).toBe('F7');
    expect(comboOf(ev('Shift', { shift: true }))).toBeNull();
  });
});

describe('the user map', () => {
  it("an action's key: the user's, none, or its own", () => {
    expect(keyOf('tool.wall', 'W', {})).toBe('W');
    expect(keyOf('tool.wall', 'W', { 'tool.wall': 'K' })).toBe('K');
    expect(keyOf('tool.wall', 'W', { 'tool.wall': null })).toBeUndefined();
    expect(keyOf('edit.paste', undefined, { 'edit.paste': 'Ctrl+Shift+V' })).toBe('Ctrl+Shift+V');
  });

  it("a key the user gave runs its action; the action's own key then does nothing; others are their own", () => {
    const map = { 'tool.wall': 'K' };
    expect(actionOfKey('K', keyed(map))?.id).toBe('tool.wall');
    expect(actionOfKey('W', keyed(map))).toBeUndefined();
    expect(actionOfKey('D', keyed(map))?.id).toBe('tool.door');
    // Turned off: its key does nothing.
    expect(actionOfKey('D', keyed({ 'tool.door': null }))).toBeUndefined();
    // A two-key sequence is not one key: left to the tool.
    expect(actionOfKey('W', keyed({ 'tool.wall': null }))).toBeUndefined();
  });

  it("a second key works while its action keeps its own key, and goes with it", () => {
    expect(actionOfKey('Ctrl+Y', keyed({}))?.id).toBe('edit.redo');
    expect(actionOfKey('Ctrl+Shift+Z', keyed({}))?.id).toBe('edit.redo');
    expect(actionOfKey('Ctrl+Y', keyed({ 'edit.redo': 'Ctrl+R' }))).toBeUndefined();
    expect(actionOfKey('Ctrl+Y', keyed({ 'edit.redo': null }))).toBeUndefined();
  });

  it('a key given to one action is taken from the one that had it', () => {
    const { map, taken } = assignKey({}, actions, 'tool.door', 'W');
    expect(map).toEqual({ 'tool.door': 'W', 'tool.wall': null });
    expect(taken.map((a) => a.id)).toEqual(['tool.wall']);
    expect(actionOfKey('W', keyed(map))?.id).toBe('tool.door');
    // A key no one has: nothing taken.
    expect(assignKey({}, actions, 'edit.paste', 'Ctrl+Shift+V').taken).toEqual([]);
  });
});
