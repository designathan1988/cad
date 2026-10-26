// The window layout: top bar, tool bar, viewport, properties panel, footer. Builds the DOM once and
// exposes the parts the app updates; texts are refreshed by relabel() when the language changes.

import { el } from './controls';
import { t, type MessageKey } from './i18n';
import { icon, type IconName } from './icons';
import type { MenuItem } from './menu';

/** `modify`: Move, Copy, Rotate, Scale or Mirror on the selection (tools/modify-tool.ts), a button each. */
export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'room' | 'floor' | 'grid' | 'measure' | 'dimension' | 'modify' | 'split' | 'corner';
export type ViewId = '3d' | 'plan';


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
  center.append(levelBox, views);

  const right = el('div', { class: 'right' });
  const commands = iconButton('command');
  const shortcuts = iconButton('keyboard', 'icon-btn needs-keyboard');
  const lang = el('button', { type: 'button', class: 'icon-btn text-btn' });
  const theme = iconButton('moon');
  const newFile = iconButton('fileNew');
  const open = iconButton('folder');
  const save = iconButton('download');
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  const panelToggle = iconButton('panel');
  // What the right side has no room for (fitTop, below); commands and the panel always stay.
  const moreApp = iconButton('menu');
  moreApp.setAttribute('aria-haspopup', 'menu');
  moreApp.hidden = true;
  right.append(commands, shortcuts, lang, theme, newFile, open, save, moreApp, panelToggle, fileInput);
  top.append(left, center, right);

  // The side bar holds what draws; what changes or measures the drawing is in the top bar (below).
  const tools = el('nav', { class: 'tools', 'aria-label': 'Tools' });
  const toolSelect = iconButton('pointer', 'icon-btn tool');
  const toolWall = iconButton('wall', 'icon-btn tool');
  const toolDoor = iconButton('door', 'icon-btn tool');
  const toolWindow = iconButton('window', 'icon-btn tool');
  const toolFloor = iconButton('slab', 'icon-btn tool');
  const toolRoom = iconButton('room', 'icon-btn tool');
  const toolGrid = iconButton('hash', 'icon-btn tool');
  // Every tool its own button and icon, one click away, in families parted by a line: building
  // (wall, floor), openings (door, window), spaces (room). A tool kept in another's submenu was not
  // found (the user's request: "cada uma das 4 deve ter o seu ícone").
  const sep = () => el('div', { class: 'group-sep' });
  tools.append(toolSelect, sep(), toolWall, toolFloor, sep(), toolDoor, toolWindow, sep(), toolRoom, sep(), toolGrid);

  // The tools that change or measure what is drawn, in the top bar beside undo and redo, as the Modify
  // tab of Revit's ribbon and the top tool bars of SketchUp and ArchiCAD (the user's request: "essas
  // ferramentas deveriam ficar na barra superior e não na barra de ferramentas lateral").
  const editTools = el('div', { class: 'edit-tools', role: 'group' });
  const editIcons = new Map<HTMLButtonElement, IconName>();
  const editTool = (name: IconName) => {
    const b = iconButton(name, 'icon-btn tool');
    editIcons.set(b, name);
    return b;
  };
  // Move, Copy, Rotate, Mirror and Scale on the selection (tools/modify-tool.ts), as Revit's Modify panel.
  const modifyTools = {
    move: editTool('move'),
    copy: editTool('copy'),
    rotate: editTool('rotate'),
    mirror: editTool('mirror'),
    scale: editTool('scale'),
    offset: editTool('offset'),
  };
  // On walls under the pointer, without a selection first: divide one, make two meet at a corner.
  const toolSplit = editTool('split');
  const toolCorner = editTool('corner');
  // Measuring and dimensioning, together: the tape (nothing kept) and the dimension (kept, held by the walls).
  const toolMeasure = editTool('ruler');
  const toolDimension = editTool('dimension');
  const moreTools = iconButton('more');
  moreTools.setAttribute('aria-haspopup', 'menu');
  moreTools.hidden = true;
  const editItems: HTMLElement[] = [
    ...Object.values(modifyTools),
    el('span', { class: 'sep' }),
    toolSplit,
    toolCorner,
    el('span', { class: 'sep' }),
    toolMeasure,
    toolDimension,
  ];
  editTools.append(...editItems, moreTools);
  left.append(el('span', { class: 'sep edit-sep' }), editTools);

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
  const xray = barButton(togglesBox, 'xray');
  const box = barButton(togglesBox, 'box');
  const ortho = barButton(togglesBox, 'ortho');
  viewBar.append(levelsBox, togglesBox);
  viewport.append(planCanvas, glCanvas, overlay3d, dims, floatBar, viewBar, emptyHint, tempChip, walkStick, tourBar, pointCard, toast, browser);

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

  /** The More button pressed while the tool in use is one of those folded into it. */
  const syncMore = () => moreTools.setAttribute('aria-pressed', String(editItems.some((x) => x.hidden && x.getAttribute('aria-pressed') === 'true')));
  // The right side's buttons that fold into its menu, the first to go first: the keys' help, language
  // and theme, then the project's files. Each one is also in the command palette.
  const appItems: HTMLButtonElement[] = [shortcuts, lang, theme, newFile, open, save];
  /** What is folded at each step: an app button alone (one the window's width has not already taken
   * away: the keys' help on a phone); an edit tool from the last, with the line before it. */
  const appSteps = () => appItems.filter((x) => x.getClientRects().length > 0).map((x) => [x]);
  const editSteps: HTMLElement[][] = [];
  for (let i = editItems.length - 1; i >= 0; i--) {
    // A line with nothing after it goes with what it parted.
    editSteps.push(editItems[i - 1]?.classList.contains('sep') ? [editItems[i]!, editItems[--i]!] : [editItems[i]!]);
  }
  // The top bar keeps to the room it has: what does not fit goes, step by step, to a menu (a tool bar's
  // overflow, as Revit folds its ribbon's panels) — the right side's buttons to its own (☰), then the
  // edit tools, from the last, to More (…). The level and the views stay centred while both sides fit
  // beside them; when they do not, the left side takes what the right one leaves. On a phone the tools
  // share the second row with the level and the views (styles.css), and each row folds on its own.
  const phone = matchMedia('(max-width: 600px)');
  /** A box's buttons past either of its edges: the right side, laid out from its end, spills to the left,
   * over the views, where no scroll width shows it (the 44 px touch buttons at 768 px, before). */
  const spills = (box: HTMLElement) => {
    const b = box.getBoundingClientRect();
    return [...box.children].some((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && (r.left < b.left - 1 || r.right > b.right + 1);
    });
  };
  const firstRowOver = () => top.scrollWidth > top.clientWidth + 1 || spills(left) || spills(right);
  const editOver = () => {
    // Wrapped below the level and the views (centred on one row, they are of other heights), or past the edge.
    const e = editTools.getBoundingClientRect();
    return e.top >= center.getBoundingClientRect().bottom || e.right > top.getBoundingClientRect().right;
  };
  const fold = (steps: readonly HTMLElement[][], over: () => boolean) => {
    for (const step of steps) {
      if (!over()) return;
      for (const x of step) x.hidden = true;
      moreApp.hidden = !appItems.some((x) => x.hidden);
      moreTools.hidden = !editItems.some((x) => x.hidden);
    }
  };
  const fitTop = () => {
    // On a phone the tools are the bar's own item, for its second row; the first row stays as it was.
    if (phone.matches && editTools.parentElement !== top) right.before(editTools);
    if (!phone.matches && editTools.parentElement !== left) left.append(editTools);
    for (const x of [...appItems, ...editItems]) x.hidden = false;
    moreApp.hidden = moreTools.hidden = true;
    left.style.minWidth = right.style.minWidth = phone.matches ? '' : 'max-content';
    if (phone.matches) {
      fold(appSteps(), firstRowOver);
      fold(editSteps, editOver);
    } else fold([...appSteps(), ...editSteps], firstRowOver);
    // Too narrow with everything folded: the project's name gives way, as before the tools came here.
    if (firstRowOver()) left.style.minWidth = right.style.minWidth = '';
    syncMore();
  };
  new ResizeObserver(fitTop).observe(top);
  phone.addEventListener('change', fitTop);
  void document.fonts.ready.then(fitTop);
  /** The folded buttons of one menu as its items: each one's icon, its tip's name and key; choosing it clicks it. */
  const folded = (from: readonly HTMLElement[], icons: (b: HTMLButtonElement) => IconName): MenuItem[] => {
    const items: MenuItem[] = [];
    let line = false;
    for (const x of from) {
      if (!x.hidden) continue;
      if (x.classList.contains('sep')) {
        line = items.length > 0;
        continue;
      }
      const b = x as HTMLButtonElement;
      // Its name as the tip gives it (tooltip.ts takes the title away; the aria-label stays), the
      // trailing "(key)" to the right, as the right-click menu shows keys.
      const [, label, keys] = /^(.*?)(?: \(([^)]+)\))?$/.exec(b.getAttribute('aria-label') ?? '')!;
      // Dimmed on the bar (nothing selected that it takes), not to be chosen in the menu, as in the palette.
      const off = b.disabled || b.getAttribute('aria-disabled') === 'true';
      items.push({ label: label!, ...(keys ? { keys } : {}), icon: icons(b), disabled: off, separated: line, run: () => b.click() });
      line = false;
    }
    return items;
  };
  const foldedTools = () => folded(editItems, (b) => editIcons.get(b)!);
  // The language button shows its code, not an icon; the theme's icon is the one it shows now (app.ts).
  const appIcons = new Map<HTMLButtonElement, IconName>([[shortcuts, 'keyboard'], [lang, 'language'], [newFile, 'fileNew'], [open, 'folder'], [save, 'download']]);
  const foldedApp = () => folded(appItems, (b) => appIcons.get(b) ?? ((b.dataset.icon as IconName | undefined) ?? 'moon'));

  const parts = {
    homeBtn, projectName, undo, redo, level, newFile, open, fileInput, view3d, viewPlan, viewWalk, commands, shortcuts, lang, theme, save,
    panelToggle, toolSelect, toolWall, toolDoor, toolWindow, toolRoom, toolFloor, toolGrid, toolMeasure, toolDimension, viewport, planCanvas, glCanvas, overlay3d, floatBar, viewBar, levelsShown, explode, cut, xray, box, ortho, modifyTools, toolSplit, toolCorner, dims, browser, sidebar,
    emptyHint, tempChip, tempLabel, tempReset, walkStick, walkKnob, tourBar, tourTitle, tourCaption, tourPrev, tourPlay, tourNext, tourStop, pointCard, pointTitle, pointText, pointEdit, pointClose, toast, panel, foot, tools, instr, keys, measureLabel, measure, snapBtn, coords, helpBack, editTools, moreTools, fitTop, syncMore, foldedTools, moreApp, foldedApp, fitFoot,
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
    tip(toolGrid, 'tool.gridKey');
    tip(toolMeasure, 'tool.measureKey');
    tip(modifyTools.move, 'tool.moveKey');
    tip(modifyTools.copy, 'tool.copyKey');
    tip(modifyTools.rotate, 'tool.rotateKey');
    tip(modifyTools.mirror, 'tool.mirrorKey');
    tip(modifyTools.scale, 'tool.scaleKey');
    tip(modifyTools.offset, 'tool.offsetKey');
    tip(toolSplit, 'tool.splitKey');
    tip(toolCorner, 'tool.cornerKey');
    tip(toolDimension, 'tool.dimensionKey');
    tip(sidebar, 'tool.sidebar');
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
    tip(moreTools, 'top.moreTools');
    tip(moreApp, 'top.moreOptions');
    editTools.setAttribute('aria-label', t('aria.editTools'));
    emptyHint.textContent = t('empty.hint');
    tempReset.textContent = t('temp.reset');
    walkStick.setAttribute('aria-label', t('walk.stick'));
    tourBar.setAttribute('aria-label', t('gtour.title'));
    tip(tourPrev, 'gtour.prev');
    tip(tourNext, 'gtour.next');
    tip(tourStop, 'gtour.stop');
    pointEdit.textContent = t('poi.edit');
    tip(pointClose, 'poi.close');
    tools.setAttribute('aria-label', t('aria.tools'));
    planCanvas.setAttribute('aria-label', t('view.plan'));
    glCanvas.setAttribute('aria-label', t('view.3d'));
    panel.setAttribute('aria-label', t('aria.properties'));
    // Another language, other widths: the views' names, the tips the folded tools are named by.
    fitTop();
  };
  return { ...parts, relabel };
}

export type Shell = ReturnType<typeof buildShell>;

/** Footer key hint: a key cap and what it does. */
export function keyHint(key: string, what: string): HTMLElement {
  return el('span', {}, el('span', { class: 'kbd' }, key), what);
}
