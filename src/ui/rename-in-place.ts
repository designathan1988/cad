// The project's name renamed in place in the title bar: the name becomes a field until Enter or Esc.

import type { App } from '../session/app';
import { el } from './controls';
import { t } from '../i18n/messages';
import { renameProject } from '../project/files';

/**
 * The project's name, typed where it is shown: Enter or leaving the field keeps it, Esc puts the old one
 * back. It names the saved file and the browser tab (the name could not be changed at all before).
 */
export function renameInPlace(app: App): void {
  const button = app.shell.projectName;
  const input = el('input', { type: 'text', class: 'project-name-input', autocomplete: 'off', spellcheck: 'false', 'aria-label': t('top.rename') });
  input.value = app.store.get().name;
  input.placeholder = t('app.untitled');
  button.hidden = true;
  button.after(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (keep: boolean) => {
    if (done) return;
    done = true;
    const name = input.value;
    input.remove();
    button.hidden = false;
    if (keep) renameProject(app, name);
    button.focus();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    // Not let through: the focus goes back to the name's button, and the same Enter would press it,
    // opening the field again.
    e.preventDefault();
    finish(e.key === 'Enter');
  });
  input.addEventListener('blur', () => finish(true));
}
