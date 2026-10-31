// Shortcuts the user remaps or turns off (phase 9; WCAG 2.1.4): a map from an action's id to its key,
// or null for none, kept with the preferences. A key the user gave an action runs it; an action's own
// key, once the action has another or none, does nothing. Keys are written as the palette writes them:
// "W", "Shift+W", "Ctrl+P", "Ctrl+Shift+Z", "1", "?", "Home", "Del", "F7".

export type KeyMap = Readonly<Record<string, string | null>>;

/** A key as written: its modifiers in one order (Ctrl, Alt, Shift), a letter in capitals. */
export function normalizeCombo(text: string): string {
  const parts = text
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  const has = (m: string) => parts.some((p) => p.toLowerCase() === m.toLowerCase());
  const key = parts.filter((p) => !['ctrl', 'alt', 'shift', 'cmd', 'meta'].includes(p.toLowerCase())).at(-1) ?? '';
  const k = key.length === 1 ? key.toUpperCase() : key[0] ? key[0].toUpperCase() + key.slice(1) : '';
  return [...(has('ctrl') || has('cmd') || has('meta') ? ['Ctrl'] : []), ...(has('alt') ? ['Alt'] : []), ...(has('shift') ? ['Shift'] : []), k].join('+');
}

const NAMED: Readonly<Record<string, string>> = { Delete: 'Del', Escape: 'Esc', ' ': 'Space' };

/** The key an event is, as written; null for a modifier alone. A typed symbol (?) carries no Shift. */
export function comboOf(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return null;
  const letterOrDigit = /^[a-z0-9]$/i.test(e.key);
  const named = NAMED[e.key] ?? (e.key.length > 1 ? e.key : null);
  const key = named ?? e.key.toUpperCase();
  // Shift counts with a letter, a digit or a named key; a symbol typed with it (?) is the symbol.
  const shift = e.shiftKey && (letterOrDigit || named !== null);
  return normalizeCombo([...(e.ctrlKey || e.metaKey ? ['Ctrl'] : []), ...(e.altKey ? ['Alt'] : []), ...(shift ? ['Shift'] : []), key].join('+'));
}

/** An action's key now: the user's, none, or its own. */
export function keyOf(id: string, own: string | undefined, map: KeyMap | undefined): string | undefined {
  if (map && id in map) return map[id] ?? undefined;
  return own;
}

/** A second key an action answers to while it keeps its own (Windows' Ctrl+Y for redo, Backspace for delete). */
export const SECOND_KEYS: Readonly<Record<string, string>> = { 'edit.redo': 'Ctrl+Y', 'edit.delete': 'Backspace' };

/**
 * The action a key runs: the one whose key, as the user has it now (`keys`, keyOf), it is; else the one
 * whose second key it is, while that action keeps its own. An action's own key, once it has another or
 * none, runs nothing. A sequence ("W, Q") is never one key: the tool reads its second key.
 */
export function actionOfKey<A extends { readonly id: string; readonly keys?: string; readonly defaultKeys?: string }>(combo: string, actions: readonly A[]): A | undefined {
  return (
    actions.find((a) => a.keys !== undefined && !a.keys.includes(',') && normalizeCombo(a.keys) === combo) ??
    actions.find((a) => SECOND_KEYS[a.id] !== undefined && a.keys !== undefined && a.keys === a.defaultKeys && normalizeCombo(SECOND_KEYS[a.id]!) === combo)
  );
}

/**
 * The keys the tools read themselves (input-keys.ts), no action's: A an arc, Q a rectangle, C a copy or a
 * measuring chain, U disjoin, Space, Enter, Backspace, Tab and the arrows. Given to an action, it ran
 * before the tool saw it and the wall tool's arc or rectangle stopped working, unexplained.
 */
export const TOOL_KEYS: readonly string[] = ['A', 'Q', 'C', 'U', 'Space', 'Enter', 'Backspace', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** The map with `id` given `combo`, taken from any other action that had it (theirs turned off). */
export function assignKey<A extends { readonly id: string; readonly defaultKeys?: string }>(map: KeyMap, actions: readonly A[], id: string, combo: string): { readonly map: KeyMap; readonly taken: readonly A[] } {
  const next: Record<string, string | null> = { ...map, [id]: combo };
  const taken = actions.filter((a) => a.id !== id && keyOf(a.id, a.defaultKeys, map) !== undefined && normalizeCombo(keyOf(a.id, a.defaultKeys, map)!) === combo);
  for (const a of taken) next[a.id] = null;
  return { map: next, taken };
}
