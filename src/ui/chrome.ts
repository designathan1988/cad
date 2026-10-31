// The interface around the views: the tool bar, the level list, the footer's hints and keys, the float bar, the browser drawer. Functions over the app (app.ts delegates).

import { lengthText } from '../i18n/units';
import { getLang, type MessageKey, name, t } from '../i18n/messages';
import { icon } from '../i18n/icons';
import { drawingOf, elementIds } from '../project/doc';
import { SCALES } from '../elements/drawing/schema';
import { renderBrowser } from './browser';
import { renderVisibility } from './visibility-panel';
import { exploding, RENDER_QUALITIES, shownLevels, VISUAL_STYLES } from '../session/view/view-3d';
import { type App, EDIT_LEVELS } from '../session/app';
import { renderRibbon } from './ribbon';
import { renderFooter } from './footer';

/** The parts the snaps divide a segment into, as the palette's (actions.ts). */
const SNAP_PARTS = [2, 3, 4, 5, 6, 8, 10];

export function renderBrowserDrawer(app: App): void {
  const { ui, shell } = app;
  shell.browser.hidden = !ui.browserOpen;
  shell.sidebar.setAttribute('aria-pressed', String(ui.browserOpen));
  if (!ui.browserOpen) return;
  const doc = app.store.get();
  // What the drawer shows: also the units (its Units item) and the materials (the types' thumbnails).
  // The layer combinations and the overrides too (its Layers section).
  const key = JSON.stringify([getLang(), ui.view, ui.levelId, [...ui.hidden], ui.refLines, ui.openingTags, ui.overridesOn, doc.levels, doc.wallTypes.map((x) => [x.id, x.name]), doc.walls.map((w) => w.wallTypeId), doc.views.map((v) => [v.id, v.name]), doc.units, doc.materials, doc.layerSets, (doc.overrides ?? []).length]);
  if (key === app.browserKey) return;
  app.browserKey = key;
  // Keep the focus on the same button across the rebuild.
  const focused = document.activeElement instanceof HTMLElement && shell.browser.contains(document.activeElement) ? [...shell.browser.querySelectorAll('button')].indexOf(document.activeElement as HTMLButtonElement) : -1;
  renderBrowser(app, shell.browser, () => app.openLevels(), () => app.openWallTypes(), () => app.openMaterials());
  if (focused >= 0) shell.browser.querySelectorAll('button')[focused]?.focus();
}

export function renderChrome(app: App): void {
  const { ui, shell, store } = app;
  const doc = store.get();
  shell.panelToggle.setAttribute('aria-pressed', String(!shell.panel.hidden));
  const projectName = doc.name || t('app.untitled');
  if (shell.projectName.textContent !== projectName) shell.projectName.textContent = projectName;
  // Where the project is kept: in this browser's database, else in its local storage.
  shell.savedNote.textContent = t(app.db ? 'top.savedHere' : 'top.savedLocal');
  document.title = `${projectName} · cad2`;
  shell.undo.disabled = !store.canUndo();
  shell.redo.disabled = !store.canRedo();
  shell.view3d.setAttribute('aria-pressed', String(ui.view === '3d'));
  shell.viewPlan.setAttribute('aria-pressed', String(ui.view === 'plan'));
  renderRibbon(app);
  shell.lang.textContent = getLang().toUpperCase();
  // Rewritten only when it changes: replacing the icon under the pointer between press and release
  // would cancel the click.
  const themeIcon = ui.theme === 'dark' ? 'sun' : 'moon';
  if (shell.theme.dataset.icon !== themeIcon) {
    shell.theme.innerHTML = icon(themeIcon);
    shell.theme.dataset.icon = themeIcon;
  }
  shell.snapBtn.setAttribute('aria-pressed', String(ui.snaps));
  shell.collideBtn.setAttribute('aria-pressed', String(ui.collisions));
  if (shell.snapParts.dataset.lang !== getLang()) {
    shell.snapParts.dataset.lang = getLang();
    shell.snapParts.replaceChildren(...SNAP_PARTS.map((n) => new Option(t('foot.parts', { n }), String(n))));
    shell.snapParts.title = t('foot.partsTip');
    shell.snapParts.setAttribute('aria-label', t('foot.partsTip'));
  }
  shell.snapParts.value = String(ui.snapParts);
  shell.snapParts.disabled = !ui.snaps;
  // The view's control bar: the 3D's groups in 3D, the plan's scale in plan; visibility in both.
  shell.only3d.hidden = ui.view !== '3d';
  shell.onlyPlan.hidden = ui.view === '3d';
  if (shell.planScale.select.dataset.lang !== getLang()) {
    shell.planScale.select.dataset.lang = getLang();
    shell.planScale.caption.textContent = t('vcb.scale');
    shell.planScale.box.title = t('vcb.scaleTip');
    shell.planScale.select.replaceChildren(...SCALES.map((d) => new Option(`1:${d}`, String(d))));
    shell.visBtn.querySelector('.label')!.textContent = t('vcb.visibility');
    shell.visBtn.title = t('vis.title');
    shell.shownReset.querySelector('.label')!.textContent = t('vcb.showAll');
    shell.shownReset.title = t('temp.reset');
  }
  shell.planScale.select.value = String(drawingOf(doc).scale);
  // The Visibility popover, drawn again only when what it shows changes (not on every pointer move).
  shell.visBtn.setAttribute('aria-expanded', String(!shell.visPanel.hidden));
  if (!shell.visPanel.hidden) {
    const visKey = JSON.stringify([getLang(), [...ui.hidden], ui.refLines, ui.openingTags, ui.overridesOn, doc.layerSets ?? [], (doc.overrides ?? []).length + (doc.roomOverrides ?? []).length]);
    if (shell.visPanel.dataset.key !== visKey) {
      shell.visPanel.dataset.key = visKey;
      renderVisibility(app, shell.visPanel);
    }
  } else delete shell.visPanel.dataset.key;
  shell.shownReset.hidden = ui.temp === null;
  for (const [mode, b] of Object.entries(shell.levelsShown)) b.setAttribute('aria-pressed', String(ui.view3d.levels === mode));
  // Pressed only while it spreads something: with one level shown it is off, and says why when clicked.
  const spread = exploding(doc.levels, ui.levelId, ui.view3d);
  const alone = shownLevels(doc.levels, ui.levelId, ui.view3d.levels).size < 2;
  shell.explode.setAttribute('aria-pressed', String(spread));
  shell.xray.setAttribute('aria-pressed', String(ui.view3d.xray));
  shell.box.setAttribute('aria-pressed', String(ui.view3d.box !== null));
  shell.ortho.setAttribute('aria-pressed', String(ui.view3d.ortho));
  shell.explode.setAttribute('aria-disabled', String(alone));
  shell.cut.setAttribute('aria-pressed', String(ui.view3d.cut));
  // The visual style and the quality: their lists filled in the interface's language, set to the view's.
  const { style, quality } = shell.look;
  if (style.select.dataset.lang !== getLang()) {
    style.select.dataset.lang = getLang();
    style.caption.textContent = t('view3d.styleLabel');
    quality.caption.textContent = t('view3d.qualityLabel');
    style.box.title = t('view3d.styleTip');
    quality.box.title = t('view3d.qualityTip');
    // Named on their own: on a narrow bar the captions go (styles.css, .view-bar).
    style.select.setAttribute('aria-label', t('view3d.styleLabel'));
    quality.select.setAttribute('aria-label', t('view3d.qualityLabel'));
    style.select.replaceChildren(...VISUAL_STYLES.map((v) => new Option(t(`view3d.style.${v}` as MessageKey), v)));
    quality.select.replaceChildren(...RENDER_QUALITIES.map((v) => new Option(t(`view3d.quality.${v}` as MessageKey), v)));
  }
  style.select.value = ui.view3d.style;
  quality.select.value = ui.view3d.quality;
  // The light's sliders, their captions and values (%), the panel open or not.
  const { light } = shell;
  light.button.querySelector('.label')!.textContent = t('view3d.light');
  light.button.title = t('view3d.lightTip');
  light.brightness.caption.textContent = t('view3d.brightness');
  light.sun.caption.textContent = t('view3d.sunStrength');
  for (const [s, v] of [[light.brightness, ui.view3d.brightness], [light.sun, ui.view3d.sun]] as const) {
    if (document.activeElement !== s.input) s.input.value = String(v);
    s.value.textContent = `${Math.round(v * 100)} %`;
  }
  light.button.setAttribute('aria-expanded', String(!light.panel.hidden));
  const levelKey = JSON.stringify([getLang(), doc.levels.map((l) => [l.id, l.name, l.elevation])]);
  if (shell.level.dataset.key !== levelKey) {
    const sorted = [...doc.levels].sort((a, b) => b.elevation - a.elevation);
    shell.level.replaceChildren(...sorted.map((l) => new Option(name(l.name), l.id)), new Option(t('levels.edit'), EDIT_LEVELS));
    shell.level.dataset.key = levelKey;
  }
  if (!doc.levels.some((l) => l.id === ui.levelId)) ui.levelId = doc.levels[0]!.id;
  shell.level.value = ui.levelId;
  // Gone once the wall tool is on: "press W" no longer applies, and the footer says what to click.
  // Only on an empty project: a column, a roof or a note drawn first is under it otherwise.
  shell.emptyHint.hidden = doc.walls.length > 0 || elementIds(doc).size > 0 || ui.tool !== 'select';
  // Hidden or isolated for a while: the drawing framed, and a way back, as Revit's cyan frame says.
  shell.viewport.classList.toggle('temp-view', ui.temp !== null);
  shell.tempChip.hidden = ui.temp === null;
  if (ui.temp) shell.tempLabel.textContent = t(ui.temp.mode === 'hide' ? 'temp.hidden' : 'temp.isolated', { n: ui.temp.ids.size });

  renderFooter(app);
  shell.coords.textContent = ui.cursor ? `x ${lengthText(ui.cursor.x)}  y ${lengthText(ui.cursor.y)}` : '';
  shell.fitFoot();
  shell.fitViewBar();
  app.placeFloatBar();
}
