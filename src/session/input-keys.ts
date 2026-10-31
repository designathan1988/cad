// The drawing's keys (input.ts): shortcuts, the tools' keys, the arrows, Escape, Enter, Delete, Alt for
// a guide. What the pointer side shares with them comes in `k`.

import { comboOf } from './keymap';
import { t } from '../i18n/messages';
import { viewKey } from './view-keys';
import type { App } from './app';
import { selectGestures } from './drag';
import { arrowStep } from '../tools/nudge';
import { guideBaseAt } from '../elements/guide/tool';
import { nudgeSelection } from './selection';
import { keyView } from './view-ui';
import { cancelGuide, startGuide } from '../elements/guide/tool-ui';
import { seriesReady } from './modify';
import { dropPress, type PointerState } from './pointer-state';
import * as appPlacing from './app-placing';
import * as appEdit from './app-edit';
import { fromOf } from '../elements/tool-draft';
import { pointTool } from './point-tools';
import { pointBusy } from './point-tools';
import { eventTool } from './event-tools';
import { actionOfKey } from './keymap';

/** What the keys share with the pointer (input.ts). */
export interface KeyContext {
  /** The pointer's state, shared with input.ts (pointer-state.ts). */
  pointer: PointerState;
  readonly gestures: ReturnType<typeof selectGestures>;
  guideTools(): boolean;
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
    k.pointer.shift = e.shiftKey;
    // Tab, drawing: what is under the pointer besides the snap offered (a wall's end under a door's).
    if (key === 'tab' && !ctrl && !e.altKey && !e.shiftKey && k.nextSnap()) {
      e.preventDefault();
      return;
    }
    // An action's key, as the user has it now (the action list, app/actions.ts, the one place keys are
    // written; keymap.ts): it runs the action, even greyed out, which then says why it cannot
    // (hint.modifyNothing, hint.copyNothing). An action's own key, once it has another or none, runs nothing.
    const byKey = (): boolean => {
      const combo = comboOf(e);
      const action = combo ? actionOfKey(combo, app.actionList()) : undefined;
      if (!action) return false;
      e.preventDefault();
      action.run();
      return true;
    };
    // Ctrl keys before the drawing's own (Ctrl+Z while a wall is being drawn); the rest after them.
    if (ctrl && byKey()) return;
    // The view by keyboard (view-keys.ts): + and − zoom, Shift+arrows move or turn it (the tester's K4).
    const typingNow = ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'room' || ui.tool === 'measure' || ui.tool === 'dimension' || ui.tool === 'grid' || ui.tool === 'modify' || app.openingKind() !== null;
    const view = viewKey(e.key, { shift: e.shiftKey, ctrl, alt: e.altKey, typing: typingNow });
    if (view) {
      e.preventDefault();
      return keyView(app, view);
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
      k.pointer.altAt = app.pointer;
      k.pointer.altMoved = false;
      return startGuide(app, base, at);
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
      return nudgeSelection(app, step);
    }
    // Esc cancels a drag whatever is held: with Alt (a wall dragged alone) it never got below, and
    // letting go of the button then kept the move.
    if (e.key === 'Escape' && ui.drag?.kind === 'handle') {
      ui.drag = null;
      return app.refresh();
    }
    if (e.key === 'Escape' && k.gestures.cancel()) {
      dropPress(k.pointer);
      return k.showMarquee();
    }
    if (ctrl || e.altKey) return;
    // Typing a number goes straight to the measure field, as in Revit and SketchUp, while a measure is
    // being asked for: drawing a wall or aiming an opening. A selection is edited by clicking its
    // temporary dimensions or in the panel, so 1 and 2 keep switching the view.
    // In the door and window tools a digit is always a measure, aimed or not: it never switches the view
    // (the tester's K2: "1" turned to 3D).
    const tool = eventTool(app);
    const typing = tool?.typing === true || ui.tool === 'dimension' || (ui.tool === 'guide' && fromOf(ui.draft, 'guide') !== null);
    // Right after a copy, its series is typed there: "3x", "/3".
    if (/^[\d/]$/.test(e.key) && ui.tool === 'select' && seriesReady(app)) {
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
      if (ui.guide) return cancelGuide(app);
      // The tool's own Esc (event-tools.ts, point-tools.ts): Modify's before a drag under way.
      if (tool?.first) return tool.escape(app);
      if (k.gestures.cancel()) {
        dropPress(k.pointer);
        return k.showMarquee();
      }
      if (tool) return tool.escape(app);
      // The tools drawn by points: a beam, a roof, an axis, a section, a guide… (point-tools.ts).
      const drawing = pointTool(app);
      if (drawing) return !pointBusy(app, drawing) ? app.setTool('select') : drawing.escape(app);
      ui.selection.clear();
      return app.refresh();
    }
    if (e.key === 'Enter' && ui.guide) return app.placeGuide();
    // Enter: the tool's own (a wall chain, a floor outline, a measure chain, an opening aimed, Modify's
    // centre), or ends what is being drawn by points (a roof's outline, a guardrail's path, a beam chain).
    if (e.key === 'Enter' && tool?.enter) return tool.enter(app);
    const drawing = pointTool(app);
    if (e.key === 'Enter' && drawing?.enter && drawing.points(app).length > 0) return drawing.enter(app);
    // Backspace while drawing a chain takes its last wall back and goes on from its start (ArchiCAD).
    if (e.key === 'Backspace' && appEdit.undoChainStep(app)) return;
    // The tools' own keys, not actions: they mean something only in that tool, before the actions' keys.
    if (!e.shiftKey) {
      if (tool?.key?.(app, key, e)) return;
      // A selected door, flipped from the keyboard: Space sends the leaf to the other side, as in Revit
      // (H, the hinge to the other jamb, is the edit.flipHinge action).
      if (e.key === ' ' && ui.tool === 'select' && appPlacing.flipDoor(app, 'swing')) return e.preventDefault();
      // And the door about to be placed, the same keys: chosen before the click, seen in its preview.
      if (e.key === ' ' && appPlacing.flipPlacing(app, 'swing')) return e.preventDefault();
      if (key === 'h' && appPlacing.flipPlacing(app, 'hinge')) return;
    }
    // Every other key is an action's (tools, Modify, views, N / Shift+N through the level's elements,
    // Del and Backspace, Home, ?, snaps, collisions, 1 and 2).
    byKey();
  });
}
