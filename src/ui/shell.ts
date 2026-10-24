// The window layout: top bar, tool bar, viewport, properties panel, footer. Builds the DOM once and
// exposes the parts the app updates; texts are refreshed by relabel() when the language changes.

import { el } from './controls';
import { t, type MessageKey } from './i18n';
import { icon, type IconName } from './icons';

export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'room' | 'floor';
export type ViewId = '3d' | 'plan';

const SOON: readonly { icon: IconName; key: MessageKey }[][] = [
  [
    { icon: 'dimension', key: 'tool.dimension' },
    { icon: 'ruler', key: 'tool.measure' },
  ],
];

function iconButton(name: IconName, cls = 'icon-btn'): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls });
  b.innerHTML = icon(name);
  return b;
}

export function buildShell(root: HTMLElement) {
  const top = el('header', { class: 'top' });
  const left = el('div', { class: 'left' });
  const homeBtn = iconButton('home');
  const projectName = el('span', { class: 'project-name' });
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
  const open = iconButton('folder');
  const save = iconButton('download');
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  const panelToggle = iconButton('panel');
  right.append(commands, shortcuts, lang, theme, open, save, panelToggle, fileInput);
  top.append(left, center, right);

  const tools = el('nav', { class: 'tools', 'aria-label': 'Tools' });
  const toolSelect = iconButton('pointer', 'icon-btn tool');
  const toolWall = iconButton('wall', 'icon-btn tool');
  const toolDoor = iconButton('door', 'icon-btn tool');
  const toolWindow = iconButton('window', 'icon-btn tool');
  const toolFloor = iconButton('slab', 'icon-btn tool');
  const toolRoom = iconButton('room', 'icon-btn tool');
  // Groups of several tools take one place in the bar: the last one used shows, the others are in
  // its submenu (ref/chat.txt:204). The input layer opens the submenu and keeps the shown one.
  const groupOf = (name: MessageKey, ...members: HTMLButtonElement[]) => {
    const box = el('div', { class: 'tool-group', 'data-group': name });
    members.forEach((b, i) => {
      b.classList.toggle('shown', i === 0);
      b.setAttribute('aria-haspopup', 'menu');
    });
    box.append(...members);
    return box;
  };
  const construction = groupOf('group.construction', toolWall, toolFloor);
  const openings = groupOf('group.openings', toolDoor, toolWindow);
  tools.append(toolSelect, el('div', { class: 'group-sep' }), construction, el('div', { class: 'group-sep' }), openings, el('div', { class: 'group-sep' }), toolRoom);
  const toolGroups = [
    { name: 'group.construction' as MessageKey, members: [toolWall, toolFloor] },
    { name: 'group.openings' as MessageKey, members: [toolDoor, toolWindow] },
  ];
  const soonButtons: { b: HTMLButtonElement; key: MessageKey }[] = [];
  for (const group of SOON) {
    tools.append(el('div', { class: 'group-sep' }));
    for (const s of group) {
      const b = iconButton(s.icon, 'icon-btn tool');
      b.disabled = true;
      soonButtons.push({ b, key: s.key });
      tools.append(b);
    }
  }
  const sidebar = iconButton('sidebar', 'icon-btn tool');
  tools.append(el('div', { class: 'spacer' }), sidebar);
  const browser = el('aside', { class: 'browser', 'aria-label': 'Project browser' });
  browser.hidden = true;

  const viewport = el('main', { class: 'viewport' });
  const planCanvas = el('canvas', { 'aria-label': 'Plan' });
  const glCanvas = el('canvas', { 'aria-label': '3D' });
  const floatBar = el('div', { class: 'float-bar', role: 'toolbar' });
  floatBar.hidden = true;
  const dims = el('div', { class: 'temp-dims' });
  const emptyHint = el('div', { class: 'empty-hint' });
  const toast = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
  viewport.append(planCanvas, glCanvas, dims, floatBar, emptyHint, toast, browser);

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
    homeBtn, projectName, undo, redo, level, open, fileInput, view3d, viewPlan, viewWalk, commands, shortcuts, lang, theme, save,
    panelToggle, toolSelect, toolWall, toolDoor, toolWindow, toolRoom, toolFloor, viewport, planCanvas, glCanvas, floatBar, dims, browser, sidebar, toolGroups,
    emptyHint, toast, panel, foot, tools, instr, keys, measureLabel, measure, snapBtn, coords, helpBack,
  };

  const relabel = () => {
    const tip = (b: HTMLElement, key: MessageKey) => {
      b.title = t(key);
      b.setAttribute('aria-label', t(key));
    };
    tip(homeBtn, 'float.frame');
    tip(undo, 'top.undo');
    tip(redo, 'top.redo');
    tip(commands, 'top.commands');
    tip(shortcuts, 'top.shortcuts');
    tip(lang, 'top.language');
    tip(theme, 'top.theme');
    tip(save, 'top.export');
    tip(open, 'top.open');
    tip(panelToggle, 'top.panel');
    tip(level, 'top.level');
    tip(toolSelect, 'tool.selectKey');
    tip(toolWall, 'tool.wallKey');
    tip(toolDoor, 'tool.doorKey');
    tip(toolWindow, 'tool.windowKey');
    tip(toolRoom, 'tool.roomKey');
    tip(toolFloor, 'tool.floorKey');
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
