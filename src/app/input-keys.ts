// The drawing's keys (input.ts): shortcuts, the tools' keys, the arrows, Escape, Enter, Delete, Alt for
// a guide. What the pointer side shares with them comes in `k`.

import { comboOf, resolveKey } from './keymap';
import type { Point2 } from '../core/vector';
import { t } from '../ui/i18n';
import { viewKey } from './view-keys';
import type { App } from './app';
import { showHelp } from './input';
import { selectGestures } from './select-drag';
import { arrowStep } from '../tools/nudge';
import { guideBaseAt } from '../tools/guide-tool';

/** What the keys share with the pointer (input.ts). */
export interface KeyContext {
  shift: boolean;
  altAt: Point2 | null;
  altMoved: boolean;
  again: string | null;
  downAt: { x: number; y: number } | null;
  readonly gestures: ReturnType<typeof selectGestures>;
  guideTools(): boolean;
  palette(): void;
  showMarquee(): void;
  /** Tab: the next snap under the pointer; false when no tool is snapping there. */
  nextSnap(): boolean;
  /** An arrow while drawing: a direction lock (snap.ts, lock); false when nothing is being drawn. */
  lock(key: string): boolean;
  /** Shift pressed while drawing along a snapped direction: held to it. */
  shiftLock(): void;
}

export function wireKeys(app: App, k: KeyContext): void {
  const { shell, ui } = app;
  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    // A dialog open: its keys are its own, wherever the focus is (it fell to the page once, and typed
    // text became the app's shortcuts).
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // The level list keeps the focus once a level is chosen in it: its arrows go on changing the level,
    // but Ctrl+V (paste on the level just chosen), Ctrl+Z, Del and Esc are the drawing's.
    const levelList = target === shell.level && (ctrl || key === 'delete' || key === 'escape');
    // Alt from the measure field (it has just left it): a guide, as anywhere in the drawing.
    const measureAlt = target === shell.measure && e.key === 'Alt';
    if (levelList) shell.level.blur();
    else if (!measureAlt && (target.closest('input, select, textarea') || target.closest('.dialog-back') || !shell.helpBack.hidden)) return;
    k.shift = e.shiftKey;
    // Tab, drawing: what is under the pointer besides the snap offered (a wall's end under a door's).
    if (key === 'tab' && !ctrl && !e.altKey && !e.shiftKey && k.nextSnap()) {
      e.preventDefault();
      return;
    }
    // The user's keys first (app/keymap.ts): a key given to an action runs it; an action's own key,
    // once it has another or none, does nothing.
    const combo = Object.keys(app.keymap).length > 0 ? comboOf(e) : null;
    if (combo) {
      const found = resolveKey(combo, app.actionList(), app.keymap);
      if (found.run) {
        e.preventDefault();
        if (found.run.enabled) found.run.run();
        return;
      }
      if (found.blocked) return;
    }
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
    if (ctrl && key === 'c' && !e.shiftKey && ui.selection.size > 0) {
      e.preventDefault();
      return app.copySelection();
    }
    if (ctrl && key === 'v') {
      e.preventDefault();
      return app.paste();
    }
    if (ctrl && key === 'a') {
      e.preventDefault();
      return app.selectAll();
    }
    if (ctrl && key === 'k') {
      e.preventDefault();
      return k.palette();
    }
    // The view by keyboard (view-keys.ts): + and − zoom, Shift+arrows move or turn it (the tester's K4).
    const typingNow = ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'room' || ui.tool === 'measure' || ui.tool === 'dimension' || ui.tool === 'grid' || ui.tool === 'modify' || app.openingKind() !== null;
    const view = viewKey(e.key, { shift: e.shiftKey, ctrl, alt: e.altKey, typing: typingNow });
    if (view) {
      e.preventDefault();
      return app.keyView(view);
    }
    // Alt is the drawing's (a guide, a wall dragged alone): the browser's menu must not take the keys
    // typed after it is let go.
    if (e.key === 'Alt') e.preventDefault();
    if (e.key === 'Alt' && k.guideTools()) {
      // Kept from the browser, whose menu would take the keys typed next.
      e.preventDefault();
      if (e.repeat) return;
      if (ui.guide) return app.placeGuide();
      const at = app.pointer && ui.cursor;
      const base = at ? guideBaseAt(app.store.get(), ui.levelId, at, 1 / app.plan.scale, { walls: !ui.hidden.has('walls'), guides: !ui.hidden.has('guides') }) : null;
      if (!base || !at) {
        ui.info = t('hint.guideNoBase');
        return app.render();
      }
      k.altAt = app.pointer;
      k.altMoved = false;
      return app.startGuide(base, at);
    }
    // A distance for the guide being set, Alt held or not.
    if (ui.guide && /^[\d.,]$/.test(e.key) && !ctrl) {
      e.preventDefault();
      shell.measure.focus();
      shell.measure.value = e.key;
      return app.refresh();
    }
    // Arrows while drawing lock the direction (→ x, ↑ y, ← along a wall, ↓ square to it).
    if (!ctrl && !e.altKey && !e.shiftKey && (key === 'arrowright' || key === 'arrowleft' || key === 'arrowup' || key === 'arrowdown') && k.lock(key)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Shift' && !e.repeat) k.shiftLock();
    // Arrows, with or without Alt, before Alt shortcuts are left to the browser.
    const step = !ctrl && !e.shiftKey && ui.selection.size > 0 && ui.view === 'plan' ? arrowStep(e.key, e.altKey) : null;
    if (step) {
      e.preventDefault();
      return app.nudgeSelection(step);
    }
    // Esc cancels a drag whatever is held: with Alt (a wall dragged alone) it never got below, and
    // letting go of the button then kept the move.
    if (e.key === 'Escape' && ui.handleDrag) {
      ui.handleDrag = null;
      return app.refresh();
    }
    if (e.key === 'Escape' && k.gestures.cancel()) {
      k.downAt = null;
      return k.showMarquee();
    }
    if (ctrl || e.altKey) return;
    // Typing a number goes straight to the measure field, as in Revit and SketchUp, while a measure is
    // being asked for: drawing a wall or aiming an opening. A selection is edited by clicking its
    // temporary dimensions or in the panel, so 1 and 2 keep switching the view.
    // In the door and window tools a digit is always a measure, aimed or not: it never switches the view
    // (the tester's K2: "1" turned to 3D).
    const typing = ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'room' || ui.tool === 'measure' || ui.tool === 'dimension' || ui.tool === 'modify' || (ui.tool === 'guide' && ui.guideFrom !== null) || app.openingKind() !== null;
    // Right after a copy, its series is typed there: "3x", "/3".
    if (/^[\d/]$/.test(e.key) && ui.tool === 'select' && app.seriesReady()) {
      e.preventDefault();
      shell.measure.focus();
      shell.measure.value = e.key;
      return app.refresh();
    }
    // "@" starts a point from the last one (@dx;dy), "=" a measure by a variable's name (=pd-0,10):
    // what follows goes to the field, not to the shortcuts.
    if (/^[\d.,\-@=]$/.test(e.key) && typing) {
      e.preventDefault();
      shell.measure.focus();
      shell.measure.value = e.key;
      // Set from here, the value fires no input event: refresh the preview for it as typing does.
      return app.refresh();
    }
    if (e.key === 'Escape') {
      // An error about something typed is over, and so is what was typed.
      if (ui.error !== null) {
        ui.error = null;
        shell.measure.value = '';
      }
      if (ui.guide) return app.cancelGuide();
      if (ui.tool === 'modify') return app.modifyEvent({ kind: 'escape' });
      if (k.gestures.cancel()) {
        k.downAt = null;
        return k.showMarquee();
      }
      if (app.openingKind()) return app.setTool('select');
      if (ui.tool === 'floor' && ui.floorDraft.length > 0) {
        ui.floorDraft = [];
        return app.render();
      }
      if (ui.tool === 'room' || ui.tool === 'floor') return app.setTool('select');
      if (ui.tool === 'measure') return ui.measure.kind !== 'idle' ? app.measureEvent({ kind: 'escape' }) : app.setTool('select');
      if (ui.tool === 'dimension') return ui.dimension.kind !== 'idle' ? app.dimensionEvent({ kind: 'escape' }) : app.setTool('select');
      if (ui.tool === 'grid') return app.gridEscape();
      if (ui.tool === 'section') return app.sectionEscape();
      if (ui.tool === 'calibrate') {
        ui.calibrate = null;
        return app.setTool('select');
      }
      if (ui.tool === 'callout') {
        if (!ui.calloutFrom) return app.setTool('select');
        ui.calloutFrom = null;
        return app.render();
      }
      if (ui.tool === 'column' || ui.tool === 'object' || ui.tool === 'note' || ui.tool === 'levelMark') return app.setTool('select');
      if (ui.tool === 'guide') {
        if (!ui.guideFrom) return app.setTool('select');
        ui.guideFrom = null;
        return app.render();
      }
      if (ui.tool === 'railing') {
        if (ui.railingDraft.length === 0) return app.setTool('select');
        return app.railingFinish();
      }
      if (ui.tool === 'stair') {
        if (!ui.stairFrom) return app.setTool('select');
        ui.stairFrom = null;
        return app.render();
      }
      if (ui.tool === 'roof') {
        if (ui.roofDraft.length === 0) return app.setTool('select');
        ui.roofDraft = [];
        return app.render();
      }
      if (ui.tool === 'beam' || ui.tool === 'separator' || ui.tool === 'curtain') {
        if (!ui.beamFrom) return app.setTool('select');
        ui.beamFrom = null;
        return app.render();
      }
      if (ui.tool === 'mark') {
        if (ui.markDraft.length === 0) return app.setTool('select');
        ui.markDraft = ui.markDraft.slice(0, -1);
        return app.render();
      }
      if (ui.tool === 'wall') return ui.wall.kind !== 'idle' ? app.wallEvent({ kind: 'escape' }) : app.setTool('select');
      if (ui.tool === 'split') return app.setTool('select');
      // The Corner tool lets go of its first wall first (below), then of itself.
      if (ui.tool === 'corner' && ui.selection.size === 0) return app.setTool('select');
      ui.selection.clear();
      return app.refresh();
    }
    if (e.key === 'Enter' && ui.guide) return app.placeGuide();
    // Enter before the first point of a turn, a scale or a mirror: the selection's centre.
    if (e.key === 'Enter' && ui.tool === 'modify' && ui.modify?.state.step === 'base' && ui.modify.kind !== 'offset') {
      const c = app.selectionCentre();
      if (c) return app.modifyEvent({ kind: 'click', point: c });
      return;
    }
    if (e.key === 'Enter' && ui.tool === 'wall') return app.wallEvent({ kind: 'enter' });
    if (e.key === 'Enter' && ui.tool === 'floor') return app.floorFinish();
    // Measuring a chain: Enter ends it open; C switches between two points and a chain.
    if (e.key === 'Enter' && ui.tool === 'measure') return app.measureEvent({ kind: 'enter' });
    if (key === 'c' && !ctrl && !e.shiftKey && ui.tool === 'measure') return app.toggleMeasureMode();
    // Enter ends what is being drawn by points: a roof's outline, a guardrail's path, a beam chain.
    if (e.key === 'Enter' && ui.tool === 'roof' && ui.roofDraft.length > 0) return app.roofFinish();
    if (e.key === 'Enter' && ui.tool === 'railing' && ui.railingDraft.length > 0) return app.railingFinish();
    if (e.key === 'Enter' && (ui.tool === 'beam' || ui.tool === 'separator' || ui.tool === 'curtain') && ui.beamFrom) {
      ui.beamFrom = null;
      return app.render();
    }
    // Enter places the opening where it is aimed, as a click there does.
    if (e.key === 'Enter' && app.openingKind() && ui.opening.kind === 'aiming') return app.openingEvent({ kind: 'click' });
    // Backspace while drawing a chain takes its last wall back and goes on from its start (ArchiCAD).
    if (e.key === 'Backspace' && app.undoChainStep()) return;
    // Delete only: Backspace, pressed to correct typing, deleted the selection (docs/revisao-interface.md, M8).
    if (e.key === 'Delete') return app.deleteSelection();
    if (e.key === 'Home') return app.frameAll();
    if (e.key === '?') return showHelp(app);
    if (e.shiftKey && key === 'l') return app.setLanguage(app.otherLanguage());
    if (e.shiftKey && key === 'w') return app.setTool('window');
    if (e.shiftKey && key === 'n') return app.stepSelection(-1);
    // The Modify tools, on the selection (Revit's MV, CO, RO, SC, MM; SketchUp's M, Q, S).
    if (e.shiftKey && key === 'm') return app.startModify('move');
    if (e.shiftKey && key === 'c') return app.startModify('copy');
    if (e.shiftKey && key === 'r') return app.startModify('rotate');
    if (e.shiftKey && key === 'e') return app.startModify('scale');
    if (e.shiftKey && key === 'x') return app.startModify('mirror');
    if (e.shiftKey && key === 'o') return app.startModify('offset');
    if (e.shiftKey && key === 's') return app.setTool('split');
    if (e.shiftKey && key === 't') return app.setTool('corner');
    if (e.shiftKey && key === 'd') return app.setTool('dimension');
    if (e.shiftKey && key === 'g') return app.setTool('grid');
    if (e.shiftKey && key === 'j') return app.mergeSelection();
    if (e.shiftKey && key === 'h') return app.hideTemporarily('hide');
    if (e.shiftKey && key === 'i') return app.hideTemporarily('isolate');
    if (e.shiftKey) return;
    if (key === 'c' && ui.tool === 'modify') return app.toggleModifyCopy();
    if (key === 'u' && ui.tool === 'modify') return app.toggleModifyDisjoin();
    if (key === 'w') return app.setTool('wall');
    if (key === 'a' && ui.tool === 'wall') return app.wallEvent({ kind: 'arc' });
    // Q: rectangles of four walls, two corners (Revit's and ArchiCAD's rectangle).
    if (key === 'q' && ui.tool === 'wall') return app.wallEvent({ kind: 'rect' });
    // Space while drawing walls: the body to the other side of the line (Revit's flip).
    if (e.key === ' ' && ui.tool === 'wall') {
      e.preventDefault();
      return app.toggleWallFlip();
    }
    // Space with the object tool: the next object a quarter turn on.
    if (e.key === ' ' && ui.tool === 'object') {
      e.preventDefault();
      return app.turnObject();
    }
    // A selected door, flipped from the keyboard: Space sends the leaf to the other side, as in Revit,
    // H the hinge to the other jamb.
    if (e.key === ' ' && ui.tool === 'select' && app.flipDoor('swing')) return e.preventDefault();
    // And the door about to be placed, the same keys: chosen before the click, seen in its preview.
    if (e.key === ' ' && app.flipPlacing('swing')) return e.preventDefault();
    if (key === 'h' && app.flipPlacing('hinge')) return;
    if (key === 'h' && ui.tool === 'select' && app.flipDoor('hinge')) return;
    if (key === 'd') return app.setTool('door');
    if (key === 'r') return app.setTool('room');
    if (key === 'l') return app.setTool('floor');
    if (key === 'm') return app.setTool('measure');
    if (key === 'p') return app.setTool('column');
    if (key === 'b') return app.setTool('beam');
    if (key === 't') return app.setTool('roof');
    if (key === 'e') return app.setTool('stair');
    if (key === 'g') return app.setTool('railing');
    if (key === 'v') return app.setTool('select');
    if (key === 'f') return app.frameSelection();
    // Choosing and moving elements without a mouse: N / Shift+N go through the level's elements;
    // the arrows move the selection by 5 cm (the snap grid), 1 cm with Alt (tools/nudge.ts).
    if (key === 'n') return app.stepSelection(e.shiftKey ? -1 : 1);
    if (key === 's') return app.toggleSnaps();
    if (key === 'k' && !ctrl && !e.shiftKey) return app.toggleCollisions();
    if (key === '1') return app.setView('3d');
    if (key === '2') return app.setView('plan');
  });
}
