// The interface around the views: the bars, the view's header and controls, the footer's hints and keys, the browser. Functions over the app (app.ts delegates).

import { lengthText } from '../i18n/units';
import { getLang, type MessageKey, t } from '../i18n/messages';
import { elementIds } from '../project/doc';
import { savedAs } from '../project/persist';
import { drawingNow } from '../session/app-view';
import { SCALES } from '../elements/drawing/schema';
import { renderBrowser } from './browser';
import { renderVisibility } from './visibility-panel';
import { exploding, RENDER_QUALITIES, shownLevels, VISUAL_STYLES } from '../session/view/view-3d';
import { type App } from '../session/app';
import { renderFooter } from './footer';
import { tipOf } from '../session/actions';
import { renderCommandBar } from './command-bar';
import { renderRail } from './tool-rail';
import { actionsWithContext, renderContextPanel } from './context-panel';
import { renderSideBar, renderViewHeader } from './view-header';

/** The parts the snaps divide a segment into, as the palette's (actions.ts). */
const SNAP_PARTS = [2, 3, 4, 5, 6, 8, 10];

export function renderBrowserDrawer(app: App): void {
  const { ui, shell } = app;
  shell.browser.hidden = !ui.browserOpen;
  if (!ui.browserOpen) return;
  const doc = app.store.get();
  // What the drawer shows: also the units (its Units item) and the materials (the types' thumbnails).
  // The layer combinations and the overrides too (its Layers section).
  const key = JSON.stringify([getLang(), ui.view, ui.levelId, [...ui.hidden], ui.refLines, ui.openingTags, ui.overridesOn, doc.levels, doc.wallTypes.map((x) => [x.id, x.name]), doc.walls.map((w) => w.wallTypeId), doc.views.map((v) => [v.id, v.name]), doc.units, doc.materials, doc.layerSets, (doc.overrides ?? []).length]);
  if (key === app.browserKey) return;
  app.browserKey = key;
  // Keep the focus on the same button across the rebuild.
  const focused = document.activeElement instanceof HTMLElement && shell.browser.contains(document.activeElement) ? [...shell.browser.querySelectorAll('button')].indexOf(document.activeElement as HTMLButtonElement) : -1;
  renderBrowser(app, shell.browser, () => app.openWallTypes());
  if (focused >= 0) shell.browser.querySelectorAll('button')[focused]?.focus();
}

export function renderChrome(app: App): void {
  const { ui, shell, store } = app;
  const doc = store.get();
  const projectName = doc.name || t('app.untitled');
  if (shell.projectName.textContent !== projectName) shell.projectName.textContent = projectName;
  // Where the project is kept: in this browser's database, else in its local storage.
  shell.savedNote.textContent = t(savedAs() ? 'top.savedHere' : 'top.savedLocal');
  document.title = `${projectName} · cad2`;
  shell.undo.disabled = !store.canUndo();
  shell.redo.disabled = !store.canRedo();
  // The title bar's, the view buttons' and the snaps button's tips: each its action's name and key as the
  // user has it (a key changed in the keys dialog shows here as in the palette); the command search's key cap
  // too. Written only when they change.
  const byId = actionsWithContext(app);
  const tipFrom = (b: HTMLElement, id: string, label = true) => {
    const a = byId.get(id);
    if (!a || b.title === tipOf(a)) return;
    b.title = tipOf(a);
    if (label) b.setAttribute('aria-label', tipOf(a));
  };
  tipFrom(shell.undo, 'edit.undo');
  tipFrom(shell.redo, 'edit.redo');
  tipFrom(shell.commands, 'help.commands');
  tipFrom(shell.snapBtn, 'settings.snaps');
  tipFrom(shell.frameAll, 'view.frameAll');
  tipFrom(shell.sectionOff, 'view.sectionOff');
  // Their visible words name them: the key in the tip only.
  tipFrom(shell.view3d, 'view.3d', false);
  tipFrom(shell.viewPlan, 'view.plan', false);
  const commandsKey = byId.get('help.commands')?.keys ?? '';
  const cap = shell.commands.querySelector<HTMLElement>('.kbd');
  if (cap && cap.textContent !== commandsKey) {
    cap.textContent = commandsKey;
    cap.hidden = commandsKey === '';
  }
  // The bars: each drawn again only when what it shows changes (ui/bars.ts).
  renderCommandBar(app, byId);
  renderRail(app, byId);
  renderContextPanel(app, byId);
  renderSideBar(app, byId);
  renderViewHeader(app);
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
    shell.labels.vis.textContent = t('vcb.visibility');
    shell.visBtn.title = t('vis.title');
    shell.labels.shownReset.textContent = t('vcb.showAll');
    shell.shownReset.title = t('temp.reset');
    shell.labels.sectionOff.textContent = t('pal.sectionOff');
  }
  // A 3D section's way out, while the 3D view is cut by one.
  shell.sectionOff.hidden = ui.view !== '3d' || ui.view3d.section === null;
  shell.planScale.select.value = String(drawingNow(app).scale);
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
  // The display's button names the style shown, as the prototype's "Sombreado ▴".
  light.label.textContent = t(`view3d.style.${ui.view3d.style}` as MessageKey);
  light.button.title = t('view3d.lightTip');
  light.brightness.caption.textContent = t('view3d.brightness');
  light.sun.caption.textContent = t('view3d.sunStrength');
  for (const [s, v] of [[light.brightness, ui.view3d.brightness], [light.sun, ui.view3d.sun]] as const) {
    if (document.activeElement !== s.input) s.input.value = String(v);
    s.value.textContent = `${Math.round(v * 100)} %`;
  }
  light.button.setAttribute('aria-expanded', String(!light.panel.hidden));
  // Gone once the wall tool is on: "press W" no longer applies, and the footer says what to click.
  // Only on an empty project: a column, a roof or a note drawn first is under it otherwise.
  shell.emptyHint.hidden = doc.walls.length > 0 || elementIds(doc).size > 0 || ui.tool !== 'select';
  // With the wall tool's key as the user has it.
  if (!shell.emptyHint.hidden) {
    const empty = t('empty.hint', { key: app.keyName('tool.wall') });
    if (shell.emptyHint.textContent !== empty) shell.emptyHint.textContent = empty;
  }
  // Hidden or isolated for a while: the drawing framed, and a way back, as Revit's cyan frame says.
  shell.viewport.classList.toggle('temp-view', ui.temp !== null);
  shell.tempChip.hidden = ui.temp === null;
  if (ui.temp) shell.tempLabel.textContent = t(ui.temp.mode === 'hide' ? 'temp.hidden' : 'temp.isolated', { n: ui.temp.ids.size });

  renderFooter(app);
  shell.coords.textContent = ui.cursor ? `x ${lengthText(ui.cursor.x)}  y ${lengthText(ui.cursor.y)}` : '';
  shell.fitFoot();
  shell.fitViewBar();
}
