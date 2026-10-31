// The project browser (ref/chat.txt:208): levels, views, layers (what is shown) and wall types, in a
// drawer beside the tool bar, closed until asked for. It only reads the state and calls the app.

import type { App } from '../session/app';
import { typeUsage } from '../session/browser-data';
import { el, section } from './controls';
import { name, t } from '../i18n/messages';
import { icon } from '../i18n/icons';
import { layerSwatch } from '../elements/wall/swatch';
import { setView } from '../session/view-ui';
import { deleteSavedView, goToView, saveCurrentView } from '../session/views-ui';
import { selectWallsOfType } from '../session/selection';

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

export function renderBrowser(app: App, box: HTMLElement, openLevels: () => void, openWallTypes: () => void, openMaterials: () => void): void {
  const { ui } = app;
  const doc = app.store.get();
  const close = el('button', { type: 'button', class: 'icon-btn', title: t('browser.close'), 'aria-label': t('browser.close') });
  close.innerHTML = icon('close', 16);
  close.addEventListener('click', () => app.toggleBrowser(false));
  const levels = [...doc.levels].sort((a, b) => b.elevation - a.elevation);
  // Counted on the level shown: what a click on a type selects.
  const usage = typeUsage(doc, ui.levelId);
  const wallsHidden = ui.hidden.has('walls');
  box.replaceChildren(
    el('div', { class: 'panel-head' }, el('span', { class: 'panel-title' }, t('browser.title')), close),
    // The other projects kept in this browser (app/projects.ts).
    section(
      t('projects.title'),
      true,
      item(t('pal.projects'), () => app.openProjects(), { lead: icon('folder', 16) }),
      item(t('units.now', { u: doc.units.length, n: doc.units.decimals }), () => app.openUnits(), {}),
    ),
    section(
      t('browser.levels'),
      true,
      ...levels.map((l) => item(name(l.name), () => app.setLevel(l.id), { current: l.id === ui.levelId, lead: icon('slab', 16), ...(l.id === ui.levelId ? { trail: t('browser.current') } : {}) })),
      item(t('levels.edit'), openLevels),
    ),
    section(
      t('browser.views'),
      true,
      item(t('view.3d'), () => setView(app, '3d'), { current: ui.view === '3d', lead: icon('cube', 16), ...(ui.view === '3d' ? { trail: t('browser.current') } : {}) }),
      item(t('view.plan'), () => setView(app, 'plan'), { current: ui.view === 'plan', lead: icon('map', 16), ...(ui.view === 'plan' ? { trail: t('browser.current') } : {}) }),
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
      item(t('mats.edit'), openMaterials),
    ),
  );
}
