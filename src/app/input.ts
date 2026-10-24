// Mouse and keyboard. Plan: wheel zooms at the cursor, middle button pans. 3D: wheel zooms at the
// cursor, middle pans, Shift + middle or right rotates (OrbitControls). Left button is the tool's.

import type { Point2 } from '../core/vector';
import { snap } from '../tools/snap';
import { getLang, t } from '../ui/i18n';
import { el } from '../ui/controls';
import { openingAt, wallAt } from './geometry';
import { aimAt, OPENING_PREVIEW_ID } from './opening-ui';
import type { App } from './app';
import { levelOf } from './document';
import { selectGestures } from './select-drag';
import { insideRing } from '../elements/room/derive';
import { EDIT_LEVELS } from './app';
import { showLevels } from '../ui/levels-dialog';
import { showPalette } from '../ui/palette';
import { offerTour, startTour } from '../ui/tour';
import { appActions, type Openers } from './actions';
import { contextEntries } from './context-menu';
import { showMenu } from '../ui/menu';
import type { WallId } from '../elements/wall/schema';

export function wireInput(app: App): void {
  const { shell, ui } = app;
  const openers: Openers = {
    help: () => showHelp(app),
    levels: () => showLevels(app),
    tour: () => startTour(app),
    openFile: () => shell.fileInput.click(),
  };
  const palette = () => showPalette(appActions(app, openers));
  app.openCommands = palette;
  offerTour(app);
  let panning: { x: number; y: number } | null = null;
  let downAt: { x: number; y: number } | null = null;
  let rightAt: { x: number; y: number } | null = null;
  /** The menu for what is under the pointer: it becomes the selection, unless it is already in it. */
  const contextMenu = (e: PointerEvent) => {
    if (ui.tool !== 'select') app.setTool('select');
    const hit = pickAt(e, worldAt(e));
    if (hit && !ui.selection.has(hit)) ui.selection = new Set([hit]);
    if (!hit) ui.selection.clear();
    app.refresh();
    const entries = contextEntries(app, palette);
    showMenu(
      entries.map((x, i) => ({ label: x.label, ...(x.keys ? { keys: x.keys } : {}), separated: x.id === 'delete' && i > 0, run: x.run })),
      { x: e.clientX, y: e.clientY },
      t(ui.selection.size > 0 ? 'ctx.label' : 'ctx.labelEmpty'),
    );
  };
  let shift = false;
  const gestures = selectGestures(app);
  const marquee = el('div', { class: 'marquee' });
  marquee.hidden = true;
  shell.viewport.append(marquee);
  const showMarquee = () => {
    const d = ui.drag;
    marquee.hidden = d?.kind !== 'marquee';
    if (d?.kind !== 'marquee') return;
    marquee.classList.toggle('crossing', d.b.x < d.a.x);
    marquee.style.left = `${Math.min(d.a.x, d.b.x)}px`;
    marquee.style.top = `${Math.min(d.a.y, d.b.y)}px`;
    marquee.style.width = `${Math.abs(d.b.x - d.a.x)}px`;
    marquee.style.height = `${Math.abs(d.b.y - d.a.y)}px`;
  };
  const local = (e: PointerEvent): Point2 => {
    const r = shell.viewport.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  /** Snap for grips: like drawing, without the wall being stretched. */
  const snapAt = (p: Point2, exclude: ReadonlySet<WallId>) =>
    snap({
      cursor: p,
      mpp: ui.view === 'plan' ? 1 / app.plan.scale : app.scene.metresPerPixel(p, 0),
      segments: app.store.get().walls.filter((x) => x.levelId === ui.levelId && !exclude.has(x.id)),
      from: null,
      chainStart: null,
      enabled: ui.snaps,
      orthogonal: false,
    });

  const worldAt = (e: PointerEvent | MouseEvent): { p: Point2; mpp: number } | null => {
    if (ui.view === 'plan') {
      const r = shell.planCanvas.getBoundingClientRect();
      return { p: app.plan.toWorld({ x: e.clientX - r.left, y: e.clientY - r.top }), mpp: 1 / app.plan.scale };
    }
    const z = levelOf(app.store.get(), ui.levelId)?.elevation ?? 0;
    const p = app.scene.groundPoint(e.clientX, e.clientY, z);
    return p ? { p, mpp: app.scene.metresPerPixel(p, z) } : null;
  };

  const snapped = (e: PointerEvent | MouseEvent) => {
    const at = worldAt(e);
    if (!at) return null;
    const w = ui.wall;
    return snap({
      cursor: at.p,
      mpp: at.mpp,
      segments: app.store.get().walls.filter((x) => x.levelId === ui.levelId),
      from: w.kind === 'drawing' ? w.last : null,
      chainStart: (w.kind === 'drawing' && w.count >= 2) || w.kind === 'bend' ? w.start : null,
      enabled: ui.snaps,
      orthogonal: shift,
    });
  };

  /** The element under the pointer: an opening before the wall that hosts it. */
  const pickAt = (e: PointerEvent, at: { p: Point2 } | null) =>
    ui.view === 'plan' ? (at ? planPick(at.p) : null) : app.scene.pick(e.clientX, e.clientY);
  /** In plan: an opening, else a wall, else a room, else a floor under the point. */
  const planPick = (p: Point2): string | null => {
    const g = app.visibleGeometry();
    return (
      openingAt(g, p) ??
      wallAt(g, p) ??
      [...g.rooms.values()].find((r) => r.enclosed && insideRing(r.outline, p))?.room.id ??
      [...g.floors.values()].find((f) => f.outline.length >= 3 && insideRing(f.outline, p))?.floor.id ??
      null
    );
  };

  const onMove = (e: PointerEvent) => {
    shift = e.shiftKey;
    if (panning && ui.view === 'plan') {
      app.plan.panBy(e.clientX - panning.x, e.clientY - panning.y);
      panning = { x: e.clientX, y: e.clientY };
      app.render();
      return;
    }
    const at = worldAt(e);
    ui.cursor = at?.p ?? null;
    // Only selecting highlights what is under the pointer; another tool must not leave it lit.
    if (ui.tool !== 'select') ui.hover = null;
    if (ui.tool === 'wall') {
      const s = snapped(e);
      ui.snap = s;
      if (s && ui.wall.kind !== 'idle') return app.wallEvent({ kind: 'move', point: s.point });
      return app.render();
    }
    if (app.openingKind()) {
      return app.openingEvent({ kind: 'hover', aim: at ? aimAt(app.store.get(), app.geometry, ui.levelId, at.p, at.mpp, OPENING_PREVIEW_ID) : null });
    }
    if (downAt && ui.tool === 'select') {
      gestures.move(local(e), at?.p ?? null, snapAt, e.shiftKey);
      showMarquee();
      return;
    }
    const hover = pickAt(e, at);
    if (hover !== ui.hover) ui.hover = hover;
    app.render();
  };

  const onDown = (e: PointerEvent) => {
    shift = e.shiftKey;
    // What the footer said about the last action is old news once the user acts on the drawing again.
    ui.info = null;
    (e.target as HTMLElement).focus?.();
    if (e.button === 1 && ui.view === 'plan') {
      e.preventDefault();
      panning = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 2) rightAt = { x: e.clientX, y: e.clientY };
    if (e.button !== 0) return;
    downAt = { x: e.clientX, y: e.clientY };
    if (ui.tool === 'select') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const at = worldAt(e);
      gestures.down(local(e), at?.p ?? null, pickAt(e, at), e.shiftKey);
    }
  };

  const onUp = (e: PointerEvent) => {
    if (panning) {
      panning = null;
      return;
    }
    if (e.button === 2 && rightAt) {
      // A right drag orbits the 3D view; only a click opens the menu.
      const moved = Math.hypot(e.clientX - rightAt.x, e.clientY - rightAt.y) > 4;
      rightAt = null;
      if (!moved) contextMenu(e);
      return;
    }
    if (e.button !== 0 || !downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4;
    downAt = null;
    if (ui.tool === 'select') {
      gestures.up(e.shiftKey);
      showMarquee();
      return;
    }
    if (moved) return;
    if (app.openingKind()) return app.openingEvent({ kind: 'click' });
    if (ui.tool === 'room' || ui.tool === 'floor') {
      const at = worldAt(e);
      if (!at) return;
      return ui.tool === 'room' ? app.roomClick(at.p) : app.floorClick(at.p, at.mpp);
    }
    const s = snapped(e);
    if (s) app.wallEvent({ kind: 'click', point: s.point });
  };

  for (const c of [shell.planCanvas, shell.glCanvas]) {
    c.tabIndex = 0;
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointerleave', () => {
      ui.hover = null;
      ui.cursor = null;
      if (app.openingKind()) return app.openingEvent({ kind: 'hover', aim: null });
      app.render();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  shell.planCanvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = shell.planCanvas.getBoundingClientRect();
      app.plan.zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, Math.exp(-e.deltaY * 0.0015));
      app.render();
    },
    { passive: false },
  );

  // Top bar, tools, floating bar, footer.
  shell.undo.addEventListener('click', () => app.undo());
  shell.redo.addEventListener('click', () => app.redo());
  shell.homeBtn.addEventListener('click', () => app.frameAll());
  shell.view3d.addEventListener('click', () => app.setView('3d'));
  shell.viewPlan.addEventListener('click', () => app.setView('plan'));
  shell.level.addEventListener('change', () => {
    if (shell.level.value === EDIT_LEVELS) {
      shell.level.value = ui.levelId;
      return showLevels(app);
    }
    app.setLevel(shell.level.value);
  });
  shell.lang.addEventListener('click', () => app.setLanguage(app.otherLanguage()));
  shell.theme.addEventListener('click', () => app.toggleTheme());
  shell.save.addEventListener('click', () => app.saveFile());
  shell.open.addEventListener('click', () => shell.fileInput.click());
  shell.fileInput.addEventListener('change', () => {
    const file = shell.fileInput.files?.[0];
    shell.fileInput.value = '';
    if (file) void app.openFile(file);
  });
  shell.panelToggle.addEventListener('click', () => app.togglePanel());
  shell.toolSelect.addEventListener('click', () => app.setTool('select'));
  shell.toolWall.addEventListener('click', () => app.setTool('wall'));
  shell.toolDoor.addEventListener('click', () => app.setTool('door'));
  shell.toolWindow.addEventListener('click', () => app.setTool('window'));
  shell.toolRoom.addEventListener('click', () => app.setTool('room'));
  shell.toolFloor.addEventListener('click', () => app.setTool('floor'));
  shell.snapBtn.addEventListener('click', () => app.toggleSnaps());
  shell.shortcuts.addEventListener('click', () => showHelp(app));
  shell.commands.addEventListener('click', () => palette());
  // The preview follows what is typed, before Enter: the wall preview is geometry, so refresh it.
  shell.measure.addEventListener('input', () => app.refresh());
  shell.measure.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const drawing = ui.tool === 'wall' && ui.wall.kind === 'drawing';
    if (e.key === 'Tab' && drawing && !e.shiftKey) {
      // Tab moves from the length to the angle: the field reads "length<angle".
      e.preventDefault();
      if (!shell.measure.value.includes('<')) shell.measure.value += '<';
      return app.render();
    }
    if (e.key === 'Enter') {
      const text = shell.measure.value;
      if (app.submitMeasure(text)) {
        // Done with the field: the keys (A, Esc, W…) go back to the drawing.
        shell.measure.value = '';
        shell.measure.blur();
        app.render();
      } else if (text.trim() === '') {
        shell.measure.blur();
        if (ui.tool === 'wall') app.wallEvent({ kind: 'enter' });
      }
    } else if (e.key === 'Escape') {
      const had = shell.measure.value.trim() !== '';
      shell.measure.value = '';
      ui.error = null;
      shell.measure.blur();
      // An empty field has nothing to cancel: Esc acts on the drawing, as it does outside the field.
      if (!had && ui.tool === 'wall' && ui.wall.kind !== 'idle') return app.wallEvent({ kind: 'escape' });
      app.render();
    }
  });

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, select, textarea') || target.closest('.dialog-back')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    shift = e.shiftKey;
    if (ctrl && key === 'z') {
      e.preventDefault();
      return e.shiftKey ? app.redo() : app.undo();
    }
    if (ctrl && key === 'o') {
      e.preventDefault();
      return shell.fileInput.click();
    }
    if (ctrl && key === 's') {
      e.preventDefault();
      return app.saveFile();
    }
    if (ctrl && key === 'y') {
      e.preventDefault();
      return app.redo();
    }
    if (ctrl && key === 'a') {
      e.preventDefault();
      return app.selectAllWalls();
    }
    if (ctrl && key === 'k') {
      e.preventDefault();
      return palette();
    }
    if (ctrl || e.altKey) return;
    // Typing a number goes straight to the measure field, as in Revit and SketchUp, while a measure is
    // being asked for: drawing a wall or aiming an opening. A selection is edited by clicking its
    // temporary dimensions or in the panel, so 1 and 2 keep switching the view.
    const typing = ui.tool === 'wall' ? ui.wall.kind !== 'idle' : app.openingKind() ? ui.opening.kind === 'aiming' : false;
    if (/^[\d.,]$/.test(e.key) && typing) {
      e.preventDefault();
      shell.measure.focus();
      shell.measure.value = e.key;
      // Set from here, the value fires no input event: refresh the preview for it as typing does.
      return app.refresh();
    }
    if (e.key === 'Escape') {
      if (gestures.cancel()) {
        downAt = null;
        return showMarquee();
      }
      if (app.openingKind()) return app.setTool('select');
      if (ui.tool === 'floor' && ui.floorDraft.length > 0) {
        ui.floorDraft = [];
        return app.render();
      }
      if (ui.tool === 'room' || ui.tool === 'floor') return app.setTool('select');
      if (ui.tool === 'wall') return ui.wall.kind !== 'idle' ? app.wallEvent({ kind: 'escape' }) : app.setTool('select');
      ui.selection.clear();
      return app.refresh();
    }
    if (e.key === 'Enter' && ui.tool === 'wall') return app.wallEvent({ kind: 'enter' });
    if (e.key === 'Enter' && ui.tool === 'floor') return app.floorFinish();
    if (e.key === 'Delete' || e.key === 'Backspace') return app.deleteSelection();
    if (e.key === 'Home') return app.frameAll();
    if (e.key === '?') return showHelp(app);
    if (e.shiftKey && key === 'l') return app.setLanguage(app.otherLanguage());
    if (e.shiftKey && key === 'w') return app.setTool('window');
    if (e.shiftKey) return;
    if (key === 'w') return app.setTool('wall');
    if (key === 'a' && ui.tool === 'wall') return app.wallEvent({ kind: 'arc' });
    if (key === 'd') return app.setTool('door');
    if (key === 'r') return app.setTool('room');
    if (key === 'l') return app.setTool('floor');
    if (key === 'v') return app.setTool('select');
    if (key === 'f') return app.frameSelection();
    if (key === 's') return app.toggleSnaps();
    if (key === '1') return app.setView('3d');
    if (key === '2') return app.setView('plan');
  });
}

function showHelp(app: App): void {
  const back = app.shell.helpBack;
  const rows: [string, string][] = getLang() === 'pt'
    ? [['V', 'Selecionar'], ['W', 'Desenhar parede'], ['A', 'Arco (desenhando parede)'], ['D', 'Colocar porta'], ['Shift+W', 'Colocar janela'], ['R', 'Criar cômodo'], ['L', 'Criar piso'], ['1 / 2', '3D / Planta'], ['Enter', 'Terminar a sequência'], ['Tab', 'Do comprimento para o ângulo (no campo Medida)'], ['Esc', 'Cancelar / limpar seleção'], ['Del', 'Apagar seleção'], ['F / Home', 'Enquadrar seleção / tudo'], ['S', 'Encaixes'], ['Shift', 'Ângulo reto ao desenhar; somar à seleção'], ['Ctrl+A', 'Selecionar todas as paredes do pavimento'], ['Ctrl+Z / Ctrl+Shift+Z', 'Desfazer / refazer'], ['Ctrl+Y', 'Refazer'], ['Ctrl+O / Ctrl+S', 'Abrir / salvar projeto'], ['Shift+L', 'Idioma'], ['Ctrl+K', 'Comandos: achar qualquer ação pelo nome'], ['?', 'Esta ajuda'], ['Rodinha', 'Aproximar no cursor'], ['Botão do meio', 'Mover a vista'], ['Shift + meio', 'Girar (3D)']]
    : [['V', 'Select'], ['W', 'Draw wall'], ['A', 'Arc (while drawing walls)'], ['D', 'Place door'], ['Shift+W', 'Place window'], ['R', 'Add room'], ['L', 'Add floor'], ['1 / 2', '3D / Plan'], ['Enter', 'Finish the chain'], ['Tab', 'From length to angle (in the Measure field)'], ['Esc', 'Cancel / clear selection'], ['Del', 'Delete selection'], ['F / Home', 'Frame selection / all'], ['S', 'Snaps'], ['Shift', 'Right angle while drawing; add to selection'], ['Ctrl+A', 'Select every wall of the level'], ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'], ['Ctrl+Y', 'Redo'], ['Ctrl+O / Ctrl+S', 'Open / save project'], ['Shift+L', 'Language'], ['Ctrl+K', 'Commands: find any action by name'], ['?', 'This help'], ['Wheel', 'Zoom at the cursor'], ['Middle button', 'Pan'], ['Shift + middle', 'Orbit (3D)']];
  const close = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
  const dl = el('dl');
  for (const [k, v] of rows) dl.append(el('dt', {}, el('span', { class: 'kbd' }, k)), el('dd', {}, v));
  const dialog = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('help.title') }, el('h2', {}, t('help.title')), dl, el('div', { class: 'actions' }, close));
  back.replaceChildren(dialog);
  back.hidden = false;
  const hide = () => {
    back.hidden = true;
    app.shell.planCanvas.focus();
  };
  close.addEventListener('click', hide);
  back.onclick = (e) => {
    if (e.target === back) hide();
  };
  back.onkeydown = (e) => {
    if (e.key === 'Escape') hide();
  };
  // The dialog itself takes the focus, so it opens at its title (focusing Close, at the bottom of a
  // long list, scrolled it there); Tab then reaches Close.
  dialog.tabIndex = -1;
  dialog.scrollTop = 0;
  dialog.focus({ preventScroll: true });
}
