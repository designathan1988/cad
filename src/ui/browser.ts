// The project browser (ref/chat.txt:208): levels, views, layers (what is shown) and wall types, in a
// drawer beside the tool bar, closed until asked for. It only reads the state and calls the app.

import type { App } from '../app/app';
import { typeUsage } from '../app/browser-data';
import type { Category } from '../app/geometry';
import { el, section } from './controls';
import { name, t, type MessageKey } from './i18n';
import { icon } from './icons';
import { layerSwatch } from './swatch';

const CATEGORIES: readonly { id: Category; key: MessageKey }[] = [
  { id: 'walls', key: 'layer.walls' },
  { id: 'openings', key: 'layer.openings' },
  { id: 'rooms', key: 'layer.rooms' },
  { id: 'floors', key: 'layer.floors' },
  { id: 'guides', key: 'layer.guides' },
];

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
function savedItem(label: string, kind: '3d' | 'plan', go: () => void, remove: () => void): HTMLElement {
  const del = el('button', { type: 'button', class: 'icon-btn', title: t('views.delete', { name: label }), 'aria-label': t('views.delete', { name: label }) });
  del.innerHTML = icon('close', 14);
  del.addEventListener('click', remove);
  // section() unwraps a row into its grid: the name and the button stay together in one flex row.
  const row = el('div', { class: 'browser-row' }, ...([...item(label, go, { lead: icon(kind === '3d' ? 'cube' : 'map', 16) }).childNodes] as HTMLElement[]), del);
  return el('div', {}, row);
}

export function renderBrowser(app: App, box: HTMLElement, openLevels: () => void, openWallTypes: () => void): void {
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
    section(t('projects.title'), true, item(t('pal.projects'), () => app.openProjects(), { lead: icon('folder', 16) })),
    section(
      t('browser.levels'),
      true,
      ...levels.map((l) => item(name(l.name), () => app.setLevel(l.id), { current: l.id === ui.levelId, lead: icon('slab', 16), ...(l.id === ui.levelId ? { trail: t('browser.current') } : {}) })),
      item(t('levels.edit'), openLevels),
    ),
    section(
      t('browser.views'),
      true,
      item(t('view.3d'), () => app.setView('3d'), { current: ui.view === '3d', lead: icon('cube', 16), ...(ui.view === '3d' ? { trail: t('browser.current') } : {}) }),
      item(t('view.plan'), () => app.setView('plan'), { current: ui.view === 'plan', lead: icon('map', 16), ...(ui.view === 'plan' ? { trail: t('browser.current') } : {}) }),
      item(t('view.walk'), () => app.toggleWalk(), { current: app.walker !== null, lead: icon('walk', 16), ...(app.walker ? { trail: t('browser.current') } : {}) }),
      // Saved views: a click goes back to one; × deletes it (one undo step).
      ...doc.views.map((v) => savedItem(name(v.name), v.kind, () => app.goToView(v.id), () => app.deleteSavedView(v.id))),
      item(t('views.save'), () => app.saveCurrentView(), { lead: icon('plus', 16) }),
      item(t('gtour.edit'), () => app.openTour(), {}),
      item(t('poi.dialogOpen'), () => app.openPoints(), { lead: icon('pin', 16) }),
      item(t('schedule.open'), () => app.openSchedules(), { lead: icon('table', 16) }),
      ...(doc.views.length > 0 ? [item(t('gtour.play'), () => app.playTour(), { lead: icon('play', 16) })] : []),
    ),
    section(
      t('browser.export'),
      false,
      item(t('export.glb'), () => void app.exportGlb(), { lead: icon('cube', 16) }),
      item(t('export.dxf'), () => app.exportDxf(), { lead: icon('map', 16) }),
      item(t('schedule.open'), () => app.openSchedules(), { lead: icon('table', 16) }),
    ),
    section(
      t('browser.layers'),
      true,
      ...CATEGORIES.map((c) => item(t(c.key), () => app.toggleCategory(c.id), { pressed: !ui.hidden.has(c.id), trail: ui.hidden.has(c.id) ? t('layer.hidden') : t('layer.shown') })),
      // Every wall's reference line and direction, as ArchiCAD's view option (the selected ones' always show).
      item(t('layer.refLines'), () => app.toggleRefLines(), { pressed: ui.refLines, trail: ui.refLines ? t('layer.shown') : t('layer.hidden') }),
      item(t('layer.openingTags'), () => app.toggleOpeningTags(), { pressed: ui.openingTags, trail: ui.openingTags ? t('layer.shown') : t('layer.hidden') }),
    ),
    section(
      t('browser.types'),
      true,
      ...doc.wallTypes.map((type) =>
        item(name(type.name), () => app.selectWallsOfType(type.id), {
          lead: layerSwatch(type.layers),
          trail: t('browser.typeCount', { n: usage.get(type.id) ?? 0 }),
          disabled: wallsHidden || (usage.get(type.id) ?? 0) === 0,
        }),
      ),
      item(t('types.edit'), openWallTypes),
    ),
  );
}
