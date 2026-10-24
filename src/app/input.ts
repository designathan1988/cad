// Mouse and keyboard. Plan: wheel zooms at the cursor, middle button pans. 3D: wheel zooms at the
// cursor, middle pans, Shift + middle or right rotates (OrbitControls). Left button is the tool's.

import type { Point2 } from '../core/vector';
import { snap } from '../tools/snap';
import { getLang, t } from '../ui/i18n';
import { el } from '../ui/controls';
import { wallAt } from './geometry';
import type { App } from './app';
import { levelOf } from './document';

export function wireInput(app: App): void {
  const { shell, ui } = app;
  let panning: { x: number; y: number } | null = null;
  let downAt: { x: number; y: number } | null = null;
  let shift = false;

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
      chainStart: w.kind === 'drawing' && w.count >= 2 ? w.start : null,
      enabled: ui.snaps,
      orthogonal: shift,
    });
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
    if (ui.tool === 'wall') {
      const s = snapped(e);
      ui.snap = s;
      if (s && ui.wall.kind === 'drawing') return app.wallEvent({ kind: 'move', point: s.point });
      return app.render();
    }
    const hover = ui.view === 'plan' ? (at ? wallAt(app.geometry, at.p) : null) : app.scene.pick(e.clientX, e.clientY);
    if (hover !== ui.hover) ui.hover = hover;
    app.render();
  };

  const onDown = (e: PointerEvent) => {
    shift = e.shiftKey;
    (e.target as HTMLElement).focus?.();
    if (e.button === 1 && ui.view === 'plan') {
      e.preventDefault();
      panning = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 0) downAt = { x: e.clientX, y: e.clientY };
  };

  const onUp = (e: PointerEvent) => {
    if (panning) {
      panning = null;
      return;
    }
    if (e.button !== 0 || !downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4;
    downAt = null;
    if (moved) return;
    if (ui.tool === 'wall') {
      const s = snapped(e);
      if (s) app.wallEvent({ kind: 'click', point: s.point });
      return;
    }
    const at = worldAt(e);
    const hit = ui.view === 'plan' ? (at ? wallAt(app.geometry, at.p) : null) : app.scene.pick(e.clientX, e.clientY);
    if (e.shiftKey) {
      if (hit) ui.selection.has(hit) ? ui.selection.delete(hit) : ui.selection.add(hit);
    } else {
      ui.selection.clear();
      if (hit) ui.selection.add(hit);
    }
    ui.error = null;
    app.refresh();
  };

  for (const c of [shell.planCanvas, shell.glCanvas]) {
    c.tabIndex = 0;
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointerleave', () => {
      ui.hover = null;
      ui.cursor = null;
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
    ui.levelId = shell.level.value;
    app.refresh();
  });
  shell.lang.addEventListener('click', () => app.setLanguage(getLang() === 'en' ? 'pt' : 'en'));
  shell.theme.addEventListener('click', () => app.toggleTheme());
  shell.save.addEventListener('click', () => app.saveFile());
  shell.panelToggle.addEventListener('click', () => app.togglePanel());
  shell.toolSelect.addEventListener('click', () => app.setTool('select'));
  shell.toolWall.addEventListener('click', () => app.setTool('wall'));
  shell.floatDelete.addEventListener('click', () => app.deleteSelection());
  shell.floatZoom.addEventListener('click', () => app.frameSelection());
  shell.floatFrame.addEventListener('click', () => app.frameAll());
  shell.snapBtn.addEventListener('click', () => {
    ui.snaps = !ui.snaps;
    app.render();
  });
  shell.shortcuts.addEventListener('click', () => showHelp(app));
  shell.measure.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      if (app.submitMeasure(shell.measure.value)) shell.measure.value = '';
      else if (shell.measure.value.trim() === '' && ui.tool === 'wall') app.wallEvent({ kind: 'enter' });
    } else if (e.key === 'Escape') {
      shell.measure.value = '';
      ui.error = null;
      shell.measure.blur();
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
    if (ctrl && key === 'y') {
      e.preventDefault();
      return app.redo();
    }
    if (ctrl || e.altKey) return;
    // Typing a number goes straight to the measure field, as in Revit and SketchUp.
    if (/^[\d.,]$/.test(e.key) && (ui.tool === 'wall' ? ui.wall.kind === 'drawing' : ui.selection.size === 1)) {
      e.preventDefault();
      shell.measure.focus();
      shell.measure.value = e.key;
      return;
    }
    if (e.key === 'Escape') {
      if (ui.tool === 'wall') return ui.wall.kind === 'drawing' ? app.wallEvent({ kind: 'escape' }) : app.setTool('select');
      ui.selection.clear();
      return app.refresh();
    }
    if (e.key === 'Enter' && ui.tool === 'wall') return app.wallEvent({ kind: 'enter' });
    if (e.key === 'Delete' || e.key === 'Backspace') return app.deleteSelection();
    if (e.key === 'Home') return app.frameAll();
    if (e.key === '?') return showHelp(app);
    if (e.shiftKey && key === 'l') return app.setLanguage(getLang() === 'en' ? 'pt' : 'en');
    if (e.shiftKey) return;
    if (key === 'w') return app.setTool('wall');
    if (key === 'v') return app.setTool('select');
    if (key === 'f') return app.frameSelection();
    if (key === 's') {
      ui.snaps = !ui.snaps;
      return app.render();
    }
    if (key === '1') return app.setView('3d');
    if (key === '2') return app.setView('plan');
  });
}

function showHelp(app: App): void {
  const back = app.shell.helpBack;
  const rows: [string, string][] = getLang() === 'pt'
    ? [['V', 'Selecionar'], ['W', 'Parede'], ['1 / 2', '3D / Planta'], ['Enter', 'Terminar a sequência'], ['Esc', 'Cancelar / limpar seleção'], ['Del', 'Apagar seleção'], ['F / Home', 'Enquadrar seleção / tudo'], ['S', 'Encaixes'], ['Shift', 'Ângulo reto ao desenhar; somar à seleção'], ['Ctrl+Z / Ctrl+Shift+Z', 'Desfazer / refazer'], ['Shift+L', 'Idioma'], ['Rodinha', 'Aproximar no cursor'], ['Botão do meio', 'Mover a vista'], ['Shift + meio', 'Girar (3D)']]
    : [['V', 'Select'], ['W', 'Wall'], ['1 / 2', '3D / Plan'], ['Enter', 'Finish the chain'], ['Esc', 'Cancel / clear selection'], ['Del', 'Delete selection'], ['F / Home', 'Frame selection / all'], ['S', 'Snaps'], ['Shift', 'Right angle while drawing; add to selection'], ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'], ['Shift+L', 'Language'], ['Wheel', 'Zoom at the cursor'], ['Middle button', 'Pan'], ['Shift + middle', 'Orbit (3D)']];
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
  close.focus();
}
