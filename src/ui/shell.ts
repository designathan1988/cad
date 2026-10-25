// The window layout: top bar, tool bar, viewport, properties panel, footer. Builds the DOM once and
// exposes the parts the app updates; texts are refreshed by relabel() when the language changes.

import { el } from './controls';
import { t, type MessageKey } from './i18n';
import { icon, type IconName } from './icons';

export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'room' | 'floor' | 'measure';
export type ViewId = '3d' | 'plan';

const SOON: readonly { icon: IconName; key: MessageKey }[] = [{ icon: 'dimension', key: 'tool.dimension' }];

function iconButton(name: IconName, cls = 'icon-btn'): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls });
  b.innerHTML = icon(name);
  return b;
}

export function buildShell(root: HTMLElement) {
  const top = el('header', { class: 'top' });
  const left = el('div', { class: 'left' });
  const homeBtn = iconButton('home');
  // A button: a click (or Enter) renames the project in place (input.ts).
  const projectName = el('button', { type: 'button', class: 'project-name' });
  const undo = iconButton('undo');
  const redo = iconButton('redo');
  left.append(homeBtn, projectName, el('span', { class: 'sep' }), undo, redo);

  const center = el('div', { class: 'center' });
  const levelBox = el('div', { class: 'select level-select' });
  const level = el('select');
  levelBox.append(level);
  levelBox.insertAdjacentHTML('beforeend', icon('chevronDown', 14));
  const views = el('div', { class: 'segmented', role: 'group' });
  const viewBtn = (id: '3d' | 'plan' | 'walk', ic: IconName) => {
    // With an icon, so narrow screens keep only the icon (controls.ts: segmented), as before 5751448.
    const b = el('button', { type: 'button', 'data-view': id, class: 'has-icon' });
    b.innerHTML = icon(ic, 16);
    b.append(el('span', { class: 'label' }));
    views.append(b);
    return b;
  };
  const view3d = viewBtn('3d', 'cube');
  const viewPlan = viewBtn('plan', 'map');
  const viewWalk = viewBtn('walk', 'walk');
  viewWalk.disabled = true;
  center.append(levelBox, views);

  const right = el('div', { class: 'right' });
  const commands = iconButton('command');
  const shortcuts = iconButton('keyboard', 'icon-btn needs-keyboard');
  const lang = el('button', { type: 'button', class: 'icon-btn text-btn in-palette' });
  const theme = iconButton('moon', 'icon-btn in-palette');
  const newFile = iconButton('fileNew');
  const open = iconButton('folder');
  const save = iconButton('download');
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  const panelToggle = iconButton('panel');
  right.append(commands, shortcuts, lang, theme, newFile, open, save, panelToggle, fileInput);
  top.append(left, center, right);

  const tools = el('nav', { class: 'tools', 'aria-label': 'Tools' });
  const toolSelect = iconButton('pointer', 'icon-btn tool');
  const toolWall = iconButton('wall', 'icon-btn tool');
  const toolDoor = iconButton('door', 'icon-btn tool');
  const toolWindow = iconButton('window', 'icon-btn tool');
  const toolFloor = iconButton('slab', 'icon-btn tool');
  const toolRoom = iconButton('room', 'icon-btn tool');
  const toolMeasure = iconButton('ruler', 'icon-btn tool');
  // Every tool its own button and icon, one click away, in families parted by a line: building
  // (wall, floor), openings (door, window), spaces (room). A tool kept in another's submenu was not
  // found (the user's request: "cada uma das 4 deve ter o seu ícone").
  const sep = () => el('div', { class: 'group-sep' });
  tools.append(toolSelect, sep(), toolWall, toolFloor, sep(), toolDoor, toolWindow, sep(), toolRoom);
  // Measuring and dimensioning, together: the tape works, the dimension is to come.
  tools.append(el('div', { class: 'group-sep' }), toolMeasure);
  const soonButtons: { b: HTMLButtonElement; key: MessageKey }[] = [];
  for (const s of SOON) {
    const b = iconButton(s.icon, 'icon-btn tool');
    b.disabled = true;
    soonButtons.push({ b, key: s.key });
    tools.append(b);
  }
  const sidebar = iconButton('sidebar', 'icon-btn tool');
  tools.append(el('div', { class: 'spacer' }), sidebar);
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
  // The 3D view's own controls (view-3d.ts): which levels show, exploded, cut. In 3D only.
  const viewBar = el('div', { class: 'view-bar', role: 'toolbar' });
  viewBar.hidden = true;
  const levelsBox = el('div', { class: 'segmented', role: 'group' });
  const barButton = (box: HTMLElement, ic: IconName) => {
    const b = el('button', { type: 'button', class: 'has-icon' });
    b.innerHTML = icon(ic, 16);
    b.append(el('span', { class: 'label' }));
    box.append(b);
    return b;
  };
  const levelsShown = { all: barButton(levelsBox, 'levelsAll'), below: barButton(levelsBox, 'levelsBelow'), current: barButton(levelsBox, 'levelsOne') };
  const togglesBox = el('div', { class: 'segmented', role: 'group' });
  const explode = barButton(togglesBox, 'explode');
  const cut = barButton(togglesBox, 'cut');
  viewBar.append(levelsBox, togglesBox);
  viewport.append(planCanvas, glCanvas, overlay3d, dims, floatBar, viewBar, emptyHint, toast, browser);

  const panel = el('aside', { class: 'panel', 'aria-label': 'Properties' });

  const foot = el('footer', { class: 'foot' });
  const instr = el('div', { class: 'instr', 'aria-live': 'polite' });
  const keys = el('div', { class: 'keys' });
  const measureLabel = el('label', { for: 'measure' });
  const measure = el('input', { id: 'measure', type: 'text', autocomplete: 'off', spellcheck: 'false' });
  const measureBox = el('div', { class: 'measure' }, measureLabel, measure);
  const snapBtn = iconButton('magnet');
  const coords = el('div', { class: 'coords' });
  foot.append(instr, keys, measureBox, snapBtn, coords);

  const helpBack = el('div', { class: 'dialog-back' });
  helpBack.hidden = true;
  root.append(top, tools, viewport, panel, foot, helpBack);

  const parts = {
    homeBtn, projectName, undo, redo, level, newFile, open, fileInput, view3d, viewPlan, viewWalk, commands, shortcuts, lang, theme, save,
    panelToggle, toolSelect, toolWall, toolDoor, toolWindow, toolRoom, toolFloor, toolMeasure, viewport, planCanvas, glCanvas, overlay3d, floatBar, viewBar, levelsShown, explode, cut, dims, browser, sidebar,
    emptyHint, toast, panel, foot, tools, instr, keys, measureLabel, measure, snapBtn, coords, helpBack,
  };

  const relabel = () => {
    const tip = (b: HTMLElement, key: MessageKey) => {
      b.title = t(key);
      b.setAttribute('aria-label', t(key));
    };
    tip(homeBtn, 'float.frame');
    projectName.title = t('top.rename');
    tip(undo, 'top.undo');
    tip(redo, 'top.redo');
    tip(commands, 'top.commands');
    tip(shortcuts, 'top.shortcuts');
    tip(lang, 'top.language');
    tip(theme, 'top.theme');
    tip(save, 'top.export');
    tip(newFile, 'top.new');
    tip(open, 'top.open');
    tip(panelToggle, 'top.panel');
    tip(level, 'top.level');
    tip(toolSelect, 'tool.selectKey');
    tip(toolWall, 'tool.wallKey');
    tip(toolDoor, 'tool.doorKey');
    tip(toolWindow, 'tool.windowKey');
    tip(toolRoom, 'tool.roomKey');
    tip(toolFloor, 'tool.floorKey');
    tip(toolMeasure, 'tool.measureKey');
    for (const s of soonButtons) {
      s.b.title = `${t(s.key)}: ${t('tool.soon')}`;
      s.b.setAttribute('aria-label', s.b.title);
    }
    tip(sidebar, 'tool.sidebar');
    browser.setAttribute('aria-label', t('browser.title'));
    view3d.querySelector('.label')!.textContent = t('view.3d');
    viewPlan.querySelector('.label')!.textContent = t('view.plan');
    viewWalk.querySelector('.label')!.textContent = t('view.walk');
    viewWalk.title = t('view.walkSoon');
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
    tip(snapBtn, 'foot.snap');
    emptyHint.textContent = t('empty.hint');
    tools.setAttribute('aria-label', t('aria.tools'));
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
