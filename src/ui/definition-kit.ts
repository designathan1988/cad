// The object editor's form pieces (definition-editor.ts): a committed text field, a choice, the remove
// and add buttons, a words field, a table head and the material options of the draft.

import type { App } from '../session/app';
import { words } from '../elements/object/fields';
import { parseFormula } from '../elements/object/formula';
import type { Words } from '../elements/object/schema';
import { el } from './controls';
import { getLang, materialLabel, t } from '../i18n/messages';
import { icon } from '../i18n/icons';
import type { EditorState } from './definition-editor';

export function editorKit(app: App, ed: EditorState) {
  // ---------- fields ----------
  const input = (value: string, onCommit: (v: string) => void, focus: string, label: string, list?: string, cls = 'text-field ed-in') => {
    const i = el('input', { type: 'text', class: cls, autocomplete: 'off', spellcheck: 'false', 'aria-label': label, ...(list ? { list } : {}) });
    i.value = value;
    i.dataset.focus = focus;
    i.title = label;
    // A formula that does not read is marked as it is typed; committed on leaving the field or Enter.
    i.addEventListener('input', () => i.classList.toggle('invalid', i.value.trim() !== '' && !/^-?\d+(\.\d+)?$/.test(i.value.trim()) && list === 'ed-names' && !parseFormula(i.value).ok));
    i.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') i.blur();
    });
    i.addEventListener('change', () => onCommit(i.value));
    return i;
  };
  const choose = <T extends string>(options: readonly { value: T; label: string }[], value: T, onChange: (v: T) => void, focus: string, label: string) => {
    const s = el('select', { class: 'ed-select', 'aria-label': label });
    for (const o of options) s.append(new Option(o.label, o.value, o.value === value, o.value === value));
    s.dataset.focus = focus;
    s.addEventListener('change', () => onChange(s.value as T));
    return s;
  };
  const remove = (label: string, focus: string, run: () => void) => {
    const b = el('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label });
    b.innerHTML = icon('trash', 16);
    b.dataset.focus = focus;
    b.addEventListener('click', run);
    return b;
  };
  const addButton = (label: string, focus: string, run: () => void) => {
    const b = el('button', { type: 'button', class: 'icon-btn text-btn' });
    b.innerHTML = icon('plus', 16);
    b.append(label);
    b.dataset.focus = focus;
    b.addEventListener('click', run);
    return b;
  };
  const wordsIn = (w: Words, onCommit: (w: Words) => void, focus: string, label: string) => {
    const lang = getLang();
    return input(lang === 'pt' ? w.pt : w.en, (v) => onCommit(lang === 'pt' ? { ...w, pt: v.trim() } : { ...w, en: v.trim() }), focus, label);
  };
  const replaceAt = <T>(list: readonly T[], i: number, x: T): T[] => list.map((y, k) => (k === i ? x : y));
  /** A table's column heads, laid out as its rows (`cls`). */
  const head = (cls: string, ...cols: string[]) => el('div', { class: `ed-row ${cls} ed-head`, 'aria-hidden': 'true' }, ...cols.map((c) => el('span', {}, c)));
  const materialOptions = () => [
    ...ed.draft.params.filter((p) => p.kind === 'material').map((p) => ({ value: p.name, label: `${t('ed.param')}: ${words(p.label)}` })),
    ...app.store.get().materials.map((m) => ({ value: m.id, label: materialLabel(m) })),
  ];
  return { input, choose, remove, addButton, wordsIn, replaceAt, head, materialOptions };
}

/** The form pieces one editor run uses. */
export type EditorKit = ReturnType<typeof editorKit>;
