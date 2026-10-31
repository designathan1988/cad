// The project's navigator (ref/chat.txt:208): the saved views and the wall types, in the properties' place
// on the right, closed until asked for. It only reads the state and calls the app.

import type { App } from '../session/app';
import { typeUsage } from '../session/browser-data';
import { el, section } from './controls';
import { name, t } from '../i18n/messages';
import { icon } from '../i18n/icons';
import { layerSwatch } from '../elements/wall/swatch';
import { deleteSavedView, goToView, saveCurrentView } from '../session/views-ui';
import { selectWallsOfType } from '../session/selection';
import * as appSettings from '../session/app-settings';

/** A full-width button row in a browser section. */
function item(label: string, onClick: () => void, extra: { pressed?: boolean; current?: boolean; disabled?: boolean; lead?: string; trail?: string } = {}): HTMLElement {
  const b = el('button', { type: 'button', class: 'browser-item' });
  if (extra.lead) b.insertAdjacentHTML('beforeend', extra.lead);
  b.append(el('span', { class: 'browser-label' }, label));
  if (extra.trail) b.append(el('span', { class: 'browser-trail' }, extra.trail));
  if (extra.pressed !== undefined) b.setAttribute('aria-pressed', String(extra.pressed));
  if (extra.current) b.setAttribute('aria-current', 'true');
  b.disabled = extra.disabled === true;
  b.addEventListener('click', onClick);
  return el('div', {}, b);
}

/** A saved view's row: its name, which goes to it, and a button that deletes it. */
function savedItem(label: string, kind: '3d' | 'plan', go: () => void, remove: () => void, trail?: string): HTMLElement {
  const del = el('button', { type: 'button', class: 'icon-btn', title: t('views.delete', { name: label }), 'aria-label': t('views.delete', { name: label }) });
  del.innerHTML = icon('close', 14);
  del.addEventListener('click', remove);
  // section() unwraps a row into its grid: the name and the button stay together in one flex row.
  const row = el('div', { class: 'browser-row' }, ...([...item(label, go, { lead: icon(kind === '3d' ? 'cube' : 'map', 16), ...(trail ? { trail } : {}) }).childNodes] as HTMLElement[]), del);
  return el('div', {}, row);
}

export function renderBrowser(app: App, box: HTMLElement, openWallTypes: () => void): void {
  const { ui } = app;
  const doc = app.store.get();
  const close = el('button', { type: 'button', class: 'icon-btn', title: t('browser.close'), 'aria-label': t('browser.close') });
  close.innerHTML = icon('close', 16);
  close.addEventListener('click', () => appSettings.toggleBrowser(app, false));
  // Counted on the level shown: what a click on a type selects.
  const usage = typeUsage(doc, ui.levelId);
  const wallsHidden = ui.hidden.has('walls');
  // What has its own place is not here (the prototype's navigator): the projects and the units in the
  // Project menu, the levels and Plan or 3D over the view, the materials on the right edge's bar.
  box.replaceChildren(
    el('div', { class: 'panel-head' }, el('span', { class: 'panel-title' }, t('browser.title')), close),
    section(
      t('browser.views'),
      true,
      // Saved views: a click goes back to one; × deletes it (one undo step).
      // A plan view with a scale of its own says it.
      ...doc.views.map((v) => savedItem(name(v.name), v.kind, () => goToView(app, v.id), () => deleteSavedView(app, v.id), v.kind === 'plan' && v.den ? `1:${v.den}` : undefined)),
      item(t('views.save'), () => saveCurrentView(app), { lead: icon('plus', 16) }),
      item(t('section.dialogOpen'), () => app.openSections(), { lead: icon('cut', 16) }),
    ),
    // What is shown (categories, overrides, combinations) is the Visibility popover's (ui/visibility-panel.ts).
    section(
      t('browser.types'),
      true,
      ...doc.wallTypes.map((type) =>
        item(name(type.name), () => selectWallsOfType(app, type.id), {
          lead: layerSwatch(type.layers, doc.materials),
          trail: t('browser.typeCount', { n: usage.get(type.id) ?? 0 }),
          disabled: wallsHidden || (usage.get(type.id) ?? 0) === 0,
        }),
      ),
      item(t('types.edit'), openWallTypes),
    ),
  );
}
