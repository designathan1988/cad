// The window layout, as the interface model (Revit's): a dark title bar (the projects, quick access,
// the project's name, the command search), the ribbon's tabs and the ribbon (ui/ribbon.ts, filled by
// app/chrome.ts), the options bar, the views' strip over the drawing (level, Plan, 3D, Walk, the project browser), the
// drawing, the properties on the right and the status bar. Builds the DOM once and exposes the parts the
// app updates; texts are refreshed by relabel() when the language changes.

import { el } from './controls';
import { t, type MessageKey } from './i18n';
import { icon, type IconName } from './icons';

/** `modify`: Move, Copy, Rotate, Scale or Mirror on the selection (tools/modify-tool.ts), a button each. */
export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'room' | 'floor' | 'column' | 'beam' | 'separator' | 'cloud' | 'mark' | 'tag' | 'curtain' | 'note' | 'levelMark' | 'roof' | 'stair' | 'railing' | 'grid' | 'object' | 'measure' | 'dimension' | 'modify' | 'split' | 'corner' | 'guide' | 'section' | 'callout' | 'calibrate' | 'spot' | 'mepPoint' | 'mepRun';
export type ViewId = '3d' | 'plan';


function iconButton(name: IconName, cls = 'icon-btn'): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls });
  b.innerHTML = icon(name);
  return b;
}

export function buildShell(root: HTMLElement) {
  // Title bar: the projects (the app's mark), quick access, the project's name, the search, settings.
  const top = el('header', { class: 'top titlebar' });
  const left = el('div', { class: 'left' });
  const homeBtn = iconButton('folder', 'icon-btn app-mark');
  const open = iconButton('fileOpen', 'icon-btn quick');
  const save = iconButton('download', 'icon-btn quick');
  const undo = iconButton('undo');
  const redo = iconButton('redo');
  left.append(homeBtn, el('span', { class: 'sep' }), open, save, el('span', { class: 'sep' }), undo, redo);
  const center = el('div', { class: 'center' });
  // A button: a click (or Enter) renames the project in place (input.ts).
  const projectName = el('button', { type: 'button', class: 'project-name' });
  const savedNote = el('span', { class: 'saved-note' });
  center.append(projectName, savedNote);
  const right = el('div', { class: 'right' });
  // The command search, as wide as a field, with its key: what the palette (Ctrl+K) finds.
  const commands = el('button', { type: 'button', class: 'search-btn' });
  commands.innerHTML = icon('command', 16);
  const commandsLabel = el('span', { class: 'search-label' });
  commands.append(commandsLabel, el('span', { class: 'kbd' }, 'Ctrl K'));
  const shortcuts = iconButton('keyboard', 'icon-btn needs-keyboard');
  const lang = el('button', { type: 'button', class: 'icon-btn text-btn' });
  const theme = iconButton('moon');
  const panelToggle = iconButton('panel');
  const fileInput = el('input', { type: 'file', accept: '.json,application/json,.ifc', hidden: '' });
  right.append(commands, shortcuts, lang, theme, panelToggle, fileInput);
  top.append(left, center, right);

  // The ribbon's tabs (File first) and the ribbon: filled by app/chrome.ts from app/ribbon-tabs.ts.
  const tabs = el('nav', { class: 'rb-tabs', role: 'tablist' });
  const fileMenu = el('button', { type: 'button', class: 'rb-tab rb-file' });
  fileMenu.setAttribute('aria-haspopup', 'menu');
  const ribbon = el('div', { class: 'ribbon', role: 'toolbar' });
  // The level, Plan, 3D and Walk, and the project browser: in a small box under the view cube (a strip
  // of their own over the drawing, and an options bar under the ribbon, were two rows for little).
  const levelBox = el('div', { class: 'select level-select' });
  const level = el('select');
  levelBox.append(level);
  levelBox.insertAdjacentHTML('beforeend', icon('chevronDown', 14));
  const views = el('div', { class: 'view-tabs', role: 'group' });
  const viewBtn = (id: '3d' | 'plan' | 'walk', ic: IconName) => {
    const b = el('button', { type: 'button', 'data-view': id, class: 'view-tab has-icon' });
    b.innerHTML = icon(ic, 16);
    b.append(el('span', { class: 'label' }));
    views.append(b);
    return b;
  };
  const viewPlan = viewBtn('plan', 'map');
  const view3d = viewBtn('3d', 'cube');
  const viewWalk = viewBtn('walk', 'walk');
  const sidebar = el('button', { type: 'button', class: 'icon-btn text-btn browser-toggle' });
  sidebar.innerHTML = icon('sidebar', 16);
  const sidebarLabel = el('span', { class: 'label' });
  sidebar.append(sidebarLabel);

  const browser = el('aside', { class: 'browser', 'aria-label': 'Project browser' });
  browser.hidden = true;

  const viewport = el('main', { class: 'viewport' });
  const planCanvas = el('canvas', { 'aria-label': 'Plan' });
  const glCanvas = el('canvas', { 'aria-label': '3D' });
  // What a tool shows while it works, over the 3D view (render/overlay-3d.ts); it takes no pointer.
  const overlay3d = el('canvas', { class: 'overlay-3d', 'aria-hidden': 'true' });
  const floatBar = el('div', { class: 'float-bar', role: 'toolbar' });
  floatBar.hidden = true;
  const dims = el('div', { class: 'temp-dims' });
  const emptyHint = el('div', { class: 'empty-hint' });
  const toast = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
  // Walking (app/walk.ts): a stick to walk with by touch (or a mouse), bottom left of the drawing.
  const walkStick = el('div', { class: 'walk-stick', role: 'application' });
  walkStick.hidden = true;
  const walkKnob = el('div', { class: 'walk-knob' });
  walkStick.append(walkKnob);
  // The guided tour playing (app.ts, playTour): the stop's name and caption, previous, pause, next, stop.
  const tourBar = el('div', { class: 'tour-bar', role: 'region' });
  tourBar.hidden = true;
  const tourText = el('div', { class: 'tour-text' });
  const tourTitle = el('div', { class: 'tour-title' });
  const tourCaption = el('div', { class: 'tour-caption' });
  tourText.append(tourTitle, tourCaption);
  const tourButton = (ic: IconName) => {
    const b = el('button', { type: 'button', class: 'icon-btn' });
    b.innerHTML = icon(ic, 18);
    return b;
  };
  const tourPrev = tourButton('chevronLeft');
  const tourPlay = tourButton('pause');
  const tourNext = tourButton('chevronRight');
  const tourStop = tourButton('close');
  tourBar.append(tourPrev, tourText, tourPlay, tourNext, tourStop);
  // A point of interest's card (app.ts, placePointCard): its title, its text, edit and close.
  const pointCard = el('div', { class: 'point-card', role: 'dialog' });
  pointCard.hidden = true;
  const pointTitle = el('div', { class: 'point-title' });
  const pointText = el('div', { class: 'point-text' });
  const pointEdit = el('button', { type: 'button', class: 'btn' });
  const pointClose = el('button', { type: 'button', class: 'icon-btn' });
  pointClose.innerHTML = icon('close', 16);
  pointCard.append(el('div', { class: 'point-head' }, pointTitle, pointClose), pointText, pointEdit);
  // Hidden or isolated for a while (app.ts, hideTemporarily): what the view leaves out, and the way back.
  const tempChip = el('div', { class: 'temp-chip', role: 'status' });
  tempChip.hidden = true;
  const tempLabel = el('span');
  const tempReset = el('button', { type: 'button', class: 'btn' });
  tempChip.append(tempLabel, tempReset);
  // The view's control bar, under the drawing (the interface model's): the plan's scale; the 3D view's
  // levels, toggles, style, quality and light (view-3d.ts); both views' visibility.
  const viewBar = el('div', { class: 'view-bar', role: 'toolbar' });
  const levelsBox = el('div', { class: 'segmented', role: 'group' });
  const barButton = (box: HTMLElement, ic: IconName) => {
    const b = el('button', { type: 'button', class: 'has-icon' });
    b.innerHTML = icon(ic, 16);
    b.append(el('span', { class: 'label' }));
    box.append(b);
    return b;
  };
  const levelsShown = { all: barButton(levelsBox, 'levelsAll'), below: barButton(levelsBox, 'levelsBelow'), current: barButton(levelsBox, 'levelsOne') };
  const togglesBox = el('div', { class: 'segmented view-toggles', role: 'group' });
  const explode = barButton(togglesBox, 'explode');
  const cut = barButton(togglesBox, 'cut');
  const xray = barButton(togglesBox, 'xray');
  const box = barButton(togglesBox, 'box');
  const ortho = barButton(togglesBox, 'ortho');
  // The visual style and the quality (view-3d.ts), as the model's view control bar has them: a list each.
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
  // The light: a button opening the view's brightness and the sun's strength, a slider each.
  const lightBtn = el('button', { type: 'button', class: 'has-icon light-btn' });
  lightBtn.innerHTML = icon('sun', 16);
  lightBtn.append(el('span', { class: 'label' }));
  lightBtn.setAttribute('aria-expanded', 'false');
  const lightSlider = () => {
    const caption = el('span', { class: 'light-caption' });
    const input = el('input', { type: 'range', min: '0.25', max: '3', step: '0.05' });
    const value = el('span', { class: 'light-value' });
    return { row: el('label', { class: 'light-row' }, caption, input, value), caption, input, value };
  };
  const light = { button: lightBtn, panel: el('div', { class: 'light-panel', role: 'group' }), brightness: lightSlider(), sun: lightSlider() };
  light.panel.hidden = true;
  light.panel.append(light.brightness.row, light.sun.row);
  // The plan's scale (the drawing's, drawing/schema.ts), a list as the model's "Escala 1:100".
  const planScale = lookSelect('scale');
  // Both views: the categories' visibility and overrides (the dialog), and everything back after a hide.
  const visBtn = el('button', { type: 'button', class: 'has-icon light-btn' });
  visBtn.innerHTML = icon('levelsAll', 16);
  visBtn.append(el('span', { class: 'label' }));
  const shown = { reset: el('button', { type: 'button', class: 'has-icon light-btn' }) };
  shown.reset.innerHTML = icon('close', 16);
  shown.reset.append(el('span', { class: 'label' }));
  const only3d = el('div', { class: 'view-bar-group view-bar-3d' }, levelsBox, togglesBox, look.style.box, look.preparing, look.quality.box, el('span', { class: 'light-wrap' }, lightBtn, light.panel));
  const onlyPlan = el('div', { class: 'view-bar-group' }, planScale.box);
  // The way out of the tool in use (it was the options bar's), shown while one is.
  const toolDone = el('button', { type: 'button', class: 'has-icon light-btn tool-done' });
  toolDone.hidden = true;
  viewBar.append(onlyPlan, only3d, el('span', { class: 'view-bar-sep' }), visBtn, shown.reset, el('span', { class: 'spacer' }), toolDone);
  // The drawing's corner, top right, one panel (as a CAD's view cube with its navigation bar under it):
  // the cube and its home (app.ts puts them first; in 3D only); the three views side by side as icons,
  // each named in its tip; the level by its name, a list; the project browser, named (its icon alone
  // says little).
  const viewBox = el('div', { class: 'view-box' }, views, levelBox, sidebar);
  const viewCorner = el('div', { class: 'view-corner' }, viewBox);
  viewport.append(planCanvas, glCanvas, overlay3d, dims, floatBar, emptyHint, tempChip, walkStick, tourBar, pointCard, toast, browser, viewCorner);

  const panel = el('aside', { class: 'panel', 'aria-label': 'Properties' });

  const foot = el('footer', { class: 'foot' });
  const instr = el('div', { class: 'instr', 'aria-live': 'polite' });
  const keys = el('div', { class: 'keys' });
  const measureLabel = el('label', { for: 'measure' });
  const measure = el('input', { id: 'measure', type: 'text', autocomplete: 'off', spellcheck: 'false' });
  const measureBox = el('div', { class: 'measure' }, measureLabel, measure);
  const snapBtn = iconButton('magnet');
  // The snaps' division of segments (app.setSnapParts), beside their toggle.
  const snapParts = el('select', { class: 'snap-parts' });
  const snapBox = el('div', { class: 'snap-box' }, snapBtn, snapParts);
  const coords = el('div', { class: 'coords' });
  foot.append(instr, keys, measureBox, snapBox, coords);

  const helpBack = el('div', { class: 'dialog-back' });
  helpBack.hidden = true;
  root.append(top, tabs, ribbon, viewport, viewBar, panel, foot, helpBack);

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

  // The view's bar the same way: its steps (styles.css, .view-bar.fit-N) taken one by one until what it
  // holds fits. Measured when its width changes, and when its contents do (another view, the language,
  // a tool's way out shown).
  let barKey = '';
  const fitViewBar = (force = false) => {
    // Its width too: a narrower window is noticed when the chrome is drawn, not only by the observer
    // (which waits for a frame, rare while the window is behind others).
    const key = [viewBar.clientWidth, ...[...viewBar.querySelectorAll<HTMLElement>(':scope > *, .view-bar-group')].map((x) => (x.hidden ? '0' : '1') + x.textContent)].join('|');
    if (!force && key === barKey) return;
    barKey = key;
    viewBar.classList.remove('fit-1', 'fit-2', 'fit-3');
    for (let step = 1; step <= 3 && viewBar.scrollWidth > viewBar.clientWidth + 1; step++) {
      if (step > 1) viewBar.classList.remove(`fit-${step - 1}`);
      viewBar.classList.add(`fit-${step}`);
    }
  };
  new ResizeObserver(() => fitViewBar(true)).observe(viewBar);

  const parts = {
    homeBtn, projectName, savedNote, undo, redo, level, open, fileInput, view3d, viewPlan, viewWalk, commands, shortcuts, lang, theme, save,
    panelToggle, tabs, fileMenu, ribbon, viewport, planCanvas, glCanvas, overlay3d, floatBar, viewBar, viewCorner, toolDone, levelsShown, explode, cut, xray, box, ortho, look, light, only3d, onlyPlan, planScale, visBtn, shownReset: shown.reset, dims, browser, sidebar,
    emptyHint, tempChip, tempLabel, tempReset, walkStick, walkKnob, tourBar, tourTitle, tourCaption, tourPrev, tourPlay, tourNext, tourStop, pointCard, pointTitle, pointText, pointEdit, pointClose, toast, panel, foot, instr, keys, measureLabel, measure, snapBtn, snapParts, coords, helpBack, fitFoot, fitViewBar,
  };

  const relabel = () => {
    const tip = (b: HTMLElement, key: MessageKey) => {
      b.title = t(key);
      b.setAttribute('aria-label', t(key));
    };
    tip(homeBtn, 'pal.projects');
    projectName.title = t('top.rename');
    tip(undo, 'top.undo');
    tip(redo, 'top.redo');
    tip(commands, 'top.commands');
    commandsLabel.textContent = t('top.search');
    tip(shortcuts, 'top.shortcuts');
    tip(lang, 'top.language');
    tip(theme, 'top.theme');
    tip(save, 'top.export');
    tip(open, 'top.open');
    tip(panelToggle, 'top.panel');
    tip(sidebar, 'tool.sidebar');
    tip(level, 'top.level');
    sidebarLabel.textContent = t('browser.short');
    fileMenu.textContent = t('rib.file');
    tabs.setAttribute('aria-label', t('rib.tabs'));
    ribbon.setAttribute('aria-label', t('rib.ribbon'));
    views.setAttribute('aria-label', t('rib.views'));
    browser.setAttribute('aria-label', t('browser.title'));
    view3d.querySelector('.label')!.textContent = t('view.3d');
    viewPlan.querySelector('.label')!.textContent = t('view.plan');
    viewWalk.querySelector('.label')!.textContent = t('view.walk');
    viewWalk.title = t('view.walkTip');
    view3d.title = `${t('view.3d')} (1)`;
    viewPlan.title = `${t('view.plan')} (2)`;
    floatBar.setAttribute('aria-label', t('ctx.label'));
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
    tip(snapBtn, 'foot.snap');
    emptyHint.textContent = t('empty.hint');
    tempReset.textContent = t('temp.reset');
    walkStick.setAttribute('aria-label', t('walk.stick'));
    tourBar.setAttribute('aria-label', t('gtour.title'));
    tip(tourPrev, 'gtour.prev');
    tip(tourNext, 'gtour.next');
    tip(tourStop, 'gtour.stop');
    pointEdit.textContent = t('poi.edit');
    tip(pointClose, 'poi.close');
    planCanvas.setAttribute('aria-label', t('view.plan'));
    glCanvas.setAttribute('aria-label', t('view.3d'));
    panel.setAttribute('aria-label', t('aria.properties'));
  };
  return { ...parts, relabel };
}

export type Shell = ReturnType<typeof buildShell>;

/** Footer key hint: a key cap and what it does. */
export function keyHint(key: string, what: string): HTMLElement {
  return el('span', {}, el('span', { class: 'kbd' }, key), what);
}
