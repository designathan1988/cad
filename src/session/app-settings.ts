// The session's settings and panels: snaps and collisions, language and theme, keys, reference lines,
//  the project browser, overrides and layer sets, categories, the ribbon tab and the properties panel.

import type { App } from './app';
import { deleteLayerSet as deleteLayerSetCommand, nextName, saveLayerSet as saveLayerSetCommand } from '../project/layer-sets';
import type { KeyMap } from './keymap';
import { getLang, htmlLang, setLang, t, type Lang } from '../i18n/messages';
import { hasSolid } from '../elements/registry';
import { type Category } from '../project/derived-filters';
import { boundsOf } from '../project/derived-queries';
import { savePrefs } from '../project/persist';
import { newId } from '../core/id';
import { covered } from './view-ui';
import * as sceneLook from '../render/scene-look';

/** Division points cut segments into n parts (2 to 10): kept with the preferences. */
export function setSnapParts(app: App, n: number): void {
  app.ui.snapParts = Math.min(10, Math.max(2, Math.round(n)));
  savePrefs({ snapParts: app.ui.snapParts });
  app.toast(t('toast.snapParts', { n: app.ui.snapParts }));
  app.render();
}

export function toggleCollisions(app: App): void {
  app.ui.collisions = !app.ui.collisions;
  savePrefs({ collisions: app.ui.collisions });
  app.toast(t(app.ui.collisions ? 'toast.collisionsOn' : 'toast.collisionsOff'));
  app.render();
}

export function toggleSnaps(app: App): void {
  app.ui.snaps = !app.ui.snaps;
  // Kept, as the other view choices are: turned off, they came back on with every reload.
  savePrefs({ snaps: app.ui.snaps });
  // Said, not only shown by the magnet's state: S is one key, easy to press by mistake, and drawing
  // then stops snapping with nothing else to tell why.
  app.toast(t(app.ui.snaps ? 'toast.snapsOn' : 'toast.snapsOff'));
  app.render();
}

export function otherLanguage(): Lang {
  return getLang() === 'en' ? 'pt' : 'en';
}

export function setLanguage(app: App, lang: Lang): void {
  setLang(lang);
  document.documentElement.lang = htmlLang(lang);
  savePrefs({ lang });
  app.shell.relabel();
  app.cube.relabel();
  app.render();
}

export function toggleTheme(app: App): void {
  app.ui.theme = app.ui.theme === 'dark' ? 'light' : 'dark';
  savePrefs({ theme: app.ui.theme });
  applyTheme(app);
  app.render();
}

export function setKeymap(app: App, map: KeyMap): void {
  app.keymap = map;
  savePrefs({ keymap: { ...map } });
  app.render();
}

/** Every wall's reference line in plan, or only the selected ones'; kept with the preferences. */
export function toggleRefLines(app: App): void {
  app.ui.refLines = !app.ui.refLines;
  savePrefs({ refLines: app.ui.refLines });
  app.render();
}

export function toggleBrowser(app: App, open = !app.ui.browserOpen): void {
  const before = covered(app).left ?? 0;
  app.ui.browserOpen = open;
  savePrefs({ browserOpen: open });
  app.shell.browser.hidden = !open;
  const after = covered(app).left ?? 0;
  // The plan moves only when the drawer comes over the drawing, and only as far as it covers it:
  // sliding by half the drawer each time it opened or closed was a jump of the whole drawing.
  const box = boundsOf(app.geometry);
  if (app.ui.view === 'plan' && box && after > before) {
    const left = app.plan.toScreen({ x: box.min.x, y: box.max.y }).x;
    const need = after + 16 - left;
    if (need > 0) app.plan.panBy(need, 0);
  }
  app.render();
  if (open) app.shell.browser.querySelector<HTMLElement>('button')?.focus();
  else app.shell.sidebar.focus();
}

/** Shows or hides a category of elements; what is hidden leaves the selection. */
/** Graphic overrides shown or not (a view's choice). */
export function toggleOverrides(app: App): void {
  app.ui.overridesOn = !app.ui.overridesOn;
  app.toast(t(app.ui.overridesOn ? 'ovr.toastOn' : 'ovr.toastOff'));
  app.refresh();
}

/** A layer combination: its categories hidden, the others shown. */
export function applyLayerSet(app: App, id: string): void {
  const set = app.store.get().layerSets?.find((s) => s.id === id);
  if (!set) return;
  app.ui.hidden = new Set(set.hidden);
  const shown = app.visibleGeometry();
  for (const sid of [...app.ui.selection]) if (!hasSolid(shown.kinds, sid)) app.ui.selection.delete(sid);
  app.toast(t('layers.applied', { name: set.name }));
  app.refresh();
}

/** The categories hidden now, kept as a combination under the next free name. */
export function saveLayerSet(app: App): void {
  const sets = app.store.get().layerSets ?? [];
  const name = nextName(
    sets.map((s) => s.name),
    t('layers.base'),
  );
  app.store.dispatch(saveLayerSetCommand({ id: newId('layers'), name, hidden: [...app.ui.hidden] }));
  app.toast(t('layers.saved', { name }));
}

export function deleteLayerSet(app: App, id: string): void {
  app.store.dispatch(deleteLayerSetCommand(id));
}

export function toggleCategory(app: App, c: Category): void {
  if (app.ui.hidden.has(c)) app.ui.hidden.delete(c);
  else app.ui.hidden.add(c);
  const shown = app.visibleGeometry();
  // Each with its category (a text and a dimension have none, an axis and a guide go with the guides).
  for (const id of [...app.ui.selection]) if (!hasSolid(shown.kinds, id)) app.ui.selection.delete(id);
  app.refresh();
}

export function chooseRibbonTab(app: App, id: string): void {
  // The contextual tab is the selection's, not a tab to come back to.
  if (id === 'context') app.ribbonAway = false;
  else {
    app.ribbonAway = app.ui.selection.size > 0 || app.ui.tool !== 'select';
    app.ribbonTab = id;
    savePrefs({ ribbonTab: id });
  }
  app.renderChrome();
}

/**
 * The button toggles what is on screen. On a narrow screen the panel waits hidden while it has
 * nothing to show: the button looked pressed then, and a click only switched a preference that
 * changed nothing; now it shows the panel.
 */
export function togglePanel(app: App, open = app.shell.panel.hidden): void {
  app.ui.panelOpen = open;
  app.ui.panelPeek = open;
  savePrefs({ panelOpen: open });
  app.render();
}

/** Opens the properties panel and puts the keyboard in it. */
export function showProperties(app: App): void {
  if (!app.ui.panelOpen) togglePanel(app, true);
  app.render();
  const first = app.shell.panel.querySelector<HTMLElement>('input, select, button:not([disabled])');
  (first ?? app.shell.panel).focus();
}

export function applyTheme(app: App): void {
  document.documentElement.dataset.theme = app.ui.theme;
  const css = getComputedStyle(document.documentElement);
  sceneLook.setTheme(app.scene, app.ui.theme === 'dark', (name) => css.getPropertyValue(name).trim());
}
