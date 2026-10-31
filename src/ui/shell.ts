// The window layout, as the interface model (prototype "barra superior fixa e painel flutuante da ferramenta"):
// the title bar (the Project menu, undo and redo, the project's name, the command search); the fixed bar of
// general commands (ui/command-bar.ts); the drawing, with the tools' rail on its left (ui/tool-rail.ts), the
// view's header (Plan, 3D, the level, the scale), the tool's or the selection's own panel at its top
// (ui/context-panel.ts), the navigation at its right and the view's controls at its foot; the panel on the
// right, one at a time, opened from the icon bar at the window's edge (ui/side-bar.ts); and the status bar.
// Builds the DOM once and exposes the parts the app updates; texts are refreshed by relabel() when the
// language changes.

import { el } from './controls';
import { t, type MessageKey } from '../i18n/messages';
import { icon, type IconName } from '../i18n/icons';

/** `modify`: Move, Copy, Rotate, Scale or Mirror on the selection (tools/modify-tool.ts), a button each. */
export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'room' | 'floor' | 'column' | 'beam' | 'separator' | 'mark' | 'curtain' | 'note' | 'levelMark' | 'roof' | 'stair' | 'railing' | 'grid' | 'object' | 'measure' | 'dimension' | 'modify' | 'split' | 'corner' | 'guide' | 'section' | 'callout' | 'calibrate';
export type ViewId = '3d' | 'plan';

function iconButton(name: IconName, cls = 'icon-btn'): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls });
  b.innerHTML = icon(name, 16);
  return b;
}

/** A button with an icon, a label and, for a menu, a caret: the title bar's Project, the level, the 3D view's display. */
function textButton(cls: string, ic: IconName | null, caret: IconName | null): { button: HTMLButtonElement; label: HTMLElement } {
  const button = el('button', { type: 'button', class: cls });
  if (ic) button.innerHTML = icon(ic, 16);
  const label = el('span', { class: 'label' });
  button.append(label);
  if (caret) button.insertAdjacentHTML('beforeend', icon(caret, 14));
  return { button, label };
}

export function buildShell(root: HTMLElement) {
  // Title bar: the app's mark, the Project menu (files, import, settings, elevations, interface), undo and
  // redo, the project's name and where it is kept, the command search.
  const top = el('header', { class: 'top titlebar' });
  const project = textButton('tb project-menu', null, 'chevronDown');
  project.button.setAttribute('aria-haspopup', 'menu');
  project.button.setAttribute('aria-expanded', 'false');
  const undo = iconButton('undo', 'ib');
  const redo = iconButton('redo', 'ib');
  const center = el('div', { class: 'center' });
  // A button: a click (or Enter) renames the project in place (input.ts).
  const projectName = el('button', { type: 'button', class: 'project-name' });
  const savedNote = el('span', { class: 'saved-note' });
  center.append(projectName, el('span', { class: 'saved-dot', 'aria-hidden': 'true' }, '·'), savedNote);
  // The command search, as wide as a field, with its key cap: what the palette finds. The key is the one the
  // user set (ui/chrome.ts writes it from the action list).
  const commands = el('button', { type: 'button', class: 'search-btn' });
  const commandsLabel = el('span', { class: 'search-label' });
  commands.append(el('span', { class: 'search-lead' }), el('span', { class: 'kbd' }));
  commands.firstElementChild!.innerHTML = icon('search', 16);
  commands.firstElementChild!.append(commandsLabel);
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  top.append(el('span', { class: 'app-mark', 'aria-hidden': 'true' }, 'c'), project.button, el('span', { class: 'tsep', 'aria-hidden': 'true' }), undo, redo, center, commands, fileInput);

  // The general commands, always in one place under the title bar (ui/command-bar.ts fills it).
  const commandBar = el('section', { class: 'cmd-bar', role: 'toolbar' });

  const browser = el('aside', { class: 'browser', 'aria-label': 'Project browser' });
  browser.hidden = true;

  const viewport = el('main', { class: 'viewport' });
  const planCanvas = el('canvas', { 'aria-label': 'Plan' });
  const glCanvas = el('canvas', { 'aria-label': '3D' });
  // What a tool shows while it works, over the 3D view (render/overlay-3d.ts); it takes no pointer.
  const overlay3d = el('canvas', { class: 'overlay-3d', 'aria-hidden': 'true' });
  const dims = el('div', { class: 'temp-dims' });
  const emptyHint = el('div', { class: 'empty-hint' });
  const toast = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
  // Hidden or isolated for a while (app.ts, hideTemporarily): what the view leaves out, and the way back.
  const tempChip = el('div', { class: 'temp-chip', role: 'status' });
  tempChip.hidden = true;
  const tempLabel = el('span');
  const tempReset = el('button', { type: 'button', class: 'btn' });
  tempChip.append(tempLabel, tempReset);

  // The tools, icons only, down the drawing's left edge (ui/tool-rail.ts fills it).
  const rail = el('nav', { class: 'rail' });

  // The view's header, top left beside the rail (Rhino's viewport title, Blender's view header): Plan or 3D,
  // the level shown (a menu: the levels, then their editor) and the plan's scale or the 3D's style.
  const views = el('div', { class: 'view-tabs', role: 'group' });
  const viewBtn = (id: ViewId, ic: IconName) => {
    const b = el('button', { type: 'button', 'data-view': id, class: 'tb view-tab' });
    b.innerHTML = icon(ic, 16);
    b.append(el('span', { class: 'label' }));
    views.append(b);
    return b;
  };
  const viewPlan = viewBtn('plan', 'map');
  const view3d = viewBtn('3d', 'cube');
  const level = textButton('tb level-btn', 'levelsAll', 'chevronDown');
  level.button.setAttribute('aria-haspopup', 'menu');
  level.button.setAttribute('aria-expanded', 'false');
  const levelElevation = el('span', { class: 'u' });
  level.label.after(levelElevation);
  const viewNote = el('span', { class: 'view-note' });
  const viewHead = el('div', { class: 'view-head' }, views, level.button, viewNote);

  // The view's controls, under the drawing in its middle: the plan's scale; the 3D view's levels, toggles and
  // display (style, quality and light); both views' visibility.
  const viewBar = el('div', { class: 'view-bar mb', role: 'toolbar' });
  const levelsBox = el('div', { class: 'bar-group', role: 'group' });
  const barButton = (box: HTMLElement, ic: IconName) => {
    const b = el('button', { type: 'button', class: 'ib' });
    b.innerHTML = icon(ic, 16);
    b.append(el('span', { class: 'label' }));
    box.append(b);
    return b;
  };
  const levelsShown = { all: barButton(levelsBox, 'levelsAll'), below: barButton(levelsBox, 'levelsBelow'), current: barButton(levelsBox, 'levelsOne') };
  const togglesBox = el('div', { class: 'bar-group', role: 'group' });
  const explode = barButton(togglesBox, 'explode');
  const cut = barButton(togglesBox, 'cut');
  const xray = barButton(togglesBox, 'xray');
  const box = barButton(togglesBox, 'box');
  const ortho = barButton(togglesBox, 'ortho');
  // The visual style and the quality (view-3d.ts), a list each, in the Display popover.
  const lookSelect = (ic: IconName) => {
    const box = el('label', { class: 'select look-select' });
    box.insertAdjacentHTML('afterbegin', icon(ic, 16));
    const caption = el('span', { class: 'look-caption' });
    const select = el('select');
    box.append(caption, select);
    box.insertAdjacentHTML('beforeend', icon('chevronDown', 14));
    return { box, caption, select };
  };
  const look = { style: lookSelect('cube'), quality: lookSelect('sun'), preparing: el('span', { class: 'look-preparing', role: 'status' }) };
  look.preparing.hidden = true;
  // The 3D view's display: a button opening the style and quality lists over the brightness and the sun's strength.
  const display = textButton('tb light-btn', 'cube', 'chevronUp');
  display.button.setAttribute('aria-expanded', 'false');
  const lightSlider = () => {
    const caption = el('span', { class: 'light-caption' });
    const input = el('input', { type: 'range', min: '0.25', max: '3', step: '0.05' });
    const value = el('span', { class: 'light-value' });
    return { row: el('label', { class: 'light-row' }, caption, input, value), caption, input, value };
  };
  const light = { button: display.button, label: display.label, panel: el('div', { class: 'light-panel', role: 'group' }), brightness: lightSlider(), sun: lightSlider() };
  light.panel.hidden = true;
  light.panel.append(el('div', { class: 'light-lists' }, look.style.box, look.quality.box), look.preparing, light.brightness.row, light.sun.row);
  // The plan's scale (the drawing's, drawing/schema.ts), a list as the model's "1:50".
  const planScale = lookSelect('ruler');
  // Both views: the categories' visibility and overrides (a popover), and everything back after a hide.
  const vis = textButton('tb light-btn', 'eye', 'chevronUp');
  vis.button.setAttribute('aria-expanded', 'false');
  const visBtn = vis.button;
  // The Visibility popover over the bar (ui/visibility-panel.ts fills it while it is open).
  const visPanel = el('div', { class: 'light-panel vis-panel', role: 'group' });
  visPanel.hidden = true;
  // A 3D section's way out, while the view is cut by one (view.sectionOff).
  const sectionOff = textButton('tb section-off', 'close', null);
  sectionOff.button.hidden = true;
  const shown = { reset: textButton('tb', 'close', null) };
  const only3d = el('div', { class: 'view-bar-group view-bar-3d' }, levelsBox, el('span', { class: 'tsep', 'aria-hidden': 'true' }), togglesBox, el('span', { class: 'tsep', 'aria-hidden': 'true' }), el('span', { class: 'light-wrap' }, light.button, light.panel), sectionOff.button);
  const onlyPlan = el('div', { class: 'view-bar-group' }, planScale.box);
  viewBar.append(onlyPlan, only3d, el('span', { class: 'light-wrap' }, visBtn, visPanel), shown.reset.button);

  // The tool in use, or the selection, at the top of the drawing (Revit's options bar, Figma's contextual
  // bar): what only this tool or this element does, a family of ways behind a caret, and the way out.
  const toolBody = el('div', { class: 'tool-strip-body' });
  const toolDone = el('button', { type: 'button', class: 'tb tool-done' });
  toolDone.hidden = true;
  const toolStrip = el('div', { class: 'tool-strip mb', role: 'toolbar' }, toolBody, toolDone);
  toolStrip.hidden = true;

  // The navigation, top right: the view cube (3D; app.ts puts it in) over the frame-all button.
  const frameAll = iconButton('frame', 'ib');
  const viewCorner = el('div', { class: 'view-corner' }, el('div', { class: 'bar-column' }, frameAll));
  viewport.append(planCanvas, glCanvas, overlay3d, dims, emptyHint, tempChip, toast, rail, viewHead, viewCorner, toolStrip, viewBar);

  const panel = el('aside', { class: 'panel', 'aria-label': 'Properties' });
  // The right edge's icon bar: each icon opens its panel (ui/side-bar.ts fills it).
  const sideBar = el('nav', { class: 'side-bar' });

  const foot = el('footer', { class: 'foot' });
  const instr = el('div', { class: 'instr', 'aria-live': 'polite' });
  const keys = el('div', { class: 'keys' });
  const measureLabel = el('label', { for: 'measure' });
  const measure = el('input', { id: 'measure', type: 'text', autocomplete: 'off', spellcheck: 'false' });
  const measureBox = el('div', { class: 'measure' }, measureLabel, measure);
  const snap = textButton('chip', 'magnet', null);
  const snapBtn = snap.button;
  // The snaps' division of segments (app.setSnapParts), beside their toggle.
  const snapParts = el('select', { class: 'chip snap-parts' });
  const collide = textButton('chip', 'collide', null);
  const collideBtn = collide.button;
  const snapBox = el('div', { class: 'snap-box' }, snapBtn, snapParts, collideBtn);
  const coords = el('div', { class: 'coords' });
  foot.append(instr, keys, measureBox, coords, el('span', { class: 'tsep', 'aria-hidden': 'true' }), snapBox);

  const helpBack = el('div', { class: 'dialog-back' });
  helpBack.hidden = true;
  root.append(top, commandBar, viewport, browser, panel, sideBar, foot, helpBack);

  // The footer's tip comes first: the key hints that leave it no room go, the first ones first (Esc,
  // last, is the one most needed). At 1280 px the wall tool's tip was cut after a few words. The keys
  // are rebuilt on every render: measured only when the texts or the footer's width change.
  let footKey = '';
  let footHidden = 0;
  const fitFoot = (force = false) => {
    const items = [...keys.children] as HTMLElement[];
    const key = `${instr.textContent}|${keys.textContent}|${measureLabel.textContent}`;
    if (force || key !== footKey) {
      footKey = key;
      for (const k of items) k.hidden = false;
      footHidden = 0;
      while (footHidden < items.length && instr.scrollWidth > instr.clientWidth + 1) items[footHidden++]!.hidden = true;
    } else items.forEach((k, i) => (k.hidden = i < footHidden));
  };
  new ResizeObserver(() => fitFoot(true)).observe(foot);

  // The view's bar the same way: its steps (viewport.css, .view-bar.fit-N) taken one by one until what it
  // holds fits the drawing's width. Measured when its width changes, and when its contents do (another view,
  // the language, a section's way out shown).
  let barKey = '';
  const fitViewBar = (force = false) => {
    const key = [viewport.clientWidth, ...[...viewBar.querySelectorAll<HTMLElement>(':scope > *, .view-bar-group')].map((x) => (x.hidden ? '0' : '1') + x.textContent)].join('|');
    if (!force && key === barKey) return;
    barKey = key;
    viewBar.classList.remove('fit-1', 'fit-2', 'fit-3');
    for (let step = 1; step <= 3 && viewBar.offsetWidth > viewport.clientWidth - 16; step++) {
      if (step > 1) viewBar.classList.remove(`fit-${step - 1}`);
      viewBar.classList.add(`fit-${step}`);
    }
  };
  new ResizeObserver(() => fitViewBar(true)).observe(viewport);

  const parts = {
    projectMenu: project.button, projectName, savedNote, undo, redo, level: level.button, levelName: level.label, levelElevation, viewNote, fileInput, view3d, viewPlan, commands,
    commandBar, rail, viewport, planCanvas, glCanvas, overlay3d, viewBar, viewCorner, frameAll, toolDone, toolStrip, toolBody, levelsShown, explode, cut, xray, box, ortho, look, light, only3d, onlyPlan, planScale, visBtn, visPanel,
    sectionOff: sectionOff.button, shownReset: shown.reset.button, dims, browser, sideBar,
    emptyHint, tempChip, tempLabel, tempReset, toast, panel, foot, instr, keys, measureLabel, measure, snapBtn, snapParts, collideBtn, coords, helpBack, fitFoot, fitViewBar,
  };

  const relabel = () => {
    const tip = (b: HTMLElement, key: MessageKey) => {
      b.title = t(key);
      b.setAttribute('aria-label', t(key));
    };
    project.label.textContent = t('top.project');
    projectName.title = t('top.rename');
    // Undo, redo, the command search, the snaps and the views: their tips carry the key the user set, so
    // ui/chrome.ts writes them from the action list at every render.
    commandsLabel.textContent = t('top.commands');
    commandBar.setAttribute('aria-label', t('bar.commands'));
    rail.setAttribute('aria-label', t('bar.tools'));
    sideBar.setAttribute('aria-label', t('bar.panels'));
    tip(level.button, 'top.level');
    views.setAttribute('aria-label', t('rib.views'));
    browser.setAttribute('aria-label', t('browser.title'));
    view3d.querySelector('.label')!.textContent = t('view.3d');
    viewPlan.querySelector('.label')!.textContent = t('view.plan');
    viewBar.setAttribute('aria-label', t('view3d.bar'));
    levelsBox.setAttribute('aria-label', t('view3d.levels'));
    const labelled = (b: HTMLElement, label: MessageKey, tipKey: MessageKey) => {
      b.querySelector('.label')!.textContent = t(label);
      b.title = t(tipKey);
      b.setAttribute('aria-label', t(tipKey));
    };
    labelled(levelsShown.all, 'view3d.all', 'view3d.allTip');
    labelled(levelsShown.below, 'view3d.below', 'view3d.belowTip');
    labelled(levelsShown.current, 'view3d.current', 'view3d.currentTip');
    labelled(explode, 'view3d.explode', 'view3d.explodeTip');
    labelled(cut, 'view3d.cut', 'view3d.cutTip');
    labelled(xray, 'view3d.xray', 'view3d.xrayTip');
    labelled(box, 'view3d.box', 'view3d.boxTip');
    labelled(ortho, 'view3d.ortho', 'view3d.orthoTip');
    snap.label.textContent = t('foot.snapChip');
    collide.label.textContent = t('foot.collideChip');
    tip(collideBtn, 'foot.collisions');
    tempReset.textContent = t('temp.reset');
    planCanvas.setAttribute('aria-label', t('view.plan'));
    glCanvas.setAttribute('aria-label', t('view.3d'));
    panel.setAttribute('aria-label', t('aria.properties'));
  };
  return { ...parts, relabel, labels: { vis: vis.label, sectionOff: sectionOff.label, shownReset: shown.reset.label } };
}

export type Shell = ReturnType<typeof buildShell>;

/** Footer key hint: a key cap and what it does. */
export function keyHint(key: string, what: string): HTMLElement {
  return el('span', {}, el('span', { class: 'kbd' }, key), what);
}
