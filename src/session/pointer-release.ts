// The pointer let go over the drawing: what a release ends or makes in each tool (a click, a drag, the
// selection box, a menu), and what a right click ends before any menu. Part of the handlers of
// pointer-handlers.ts, with the same state and helpers.

import { endHandleDrag } from './object-handles';
import type { App } from './app';
import { cancelGuide } from '../elements/guide/tool-ui';
import { PICK_PX } from './pointer-aim';
import type { PointerDeps } from './pointer-handlers';
import * as appView from './app-view';
import { dropPress } from './pointer-state';
import { pointBusy, pointTool } from './point-tools';
import { eventTool } from './event-tools';

export function pointerRelease(app: App, d: PointerDeps) {
  const { ui } = app;
  const { ptr, gestures, showMarquee, contextMenu, toolMenu } = d;
  const { aimAt3d, planHits, snapped, worldAt } = d.aim;
  /**
   * What a right click ends before it opens any menu: a wall chain (as Enter: the walls drawn stay), a
   * floor outline (closed from three corners, dropped before), the measure tool's tape, a drag (as
   * Esc). True when it ended something.
   */
  const endWithRightClick = (): boolean => {
    // The tool's own (event-tools.ts, point-tools.ts); Modify's before a guide or a drag under way.
    const tool = eventTool(app);
    if (tool?.first && tool.rightClick?.(app)) return true;
    if (ui.guide) {
      cancelGuide(app);
      return true;
    }
    if (gestures.cancel()) {
      dropPress(ptr);
      showMarquee();
      return true;
    }
    if (tool && !tool.first && tool.rightClick?.(app)) return true;
    const drawing = pointTool(app);
    if (drawing?.rightClick && pointBusy(app, drawing)) {
      drawing.rightClick(app);
      return true;
    }
    return false;
  };

  const onUp = (e: PointerEvent) => {
    if (ptr.left?.kind === 'box') {
      ptr.left = null;
      app.boxHot = null;
      if (ui.view3d.box) appView.setBox(app, ui.view3d.box, true);
      return;
    }
    if (ptr.panning) {
      ptr.panning = null;
      return;
    }
    if (e.button === 2 && ptr.rightAt) {
      // A right drag orbits the 3D view; only a click opens the menu.
      const moved = Math.hypot(e.clientX - ptr.rightAt.x, e.clientY - ptr.rightAt.y) > 4;
      ptr.rightAt = null;
      if (moved) return;
      // A drawing tool: its own menu (Finish, leave the tool). A Modify tool, a guide or a drag still end at once.
      if (ui.tool !== 'select' && ui.tool !== 'modify' && !ui.guide && !ui.drag) return toolMenu(e);
      if (endWithRightClick()) return;
      contextMenu(e);
      return;
    }
    if (e.button === 0 && ui.drag?.kind === 'handle') {
      const d = ui.drag;
      ui.drag = null;
      endHandleDrag(app, d);
      return app.refresh();
    }
    if (e.button !== 0 || ptr.left?.kind !== 'press') return;
    const moved = Math.hypot(e.clientX - ptr.left.x, e.clientY - ptr.left.y) > 4;
    ptr.left = null;
    // A click places the guide being set; it is no point of the drawing.
    if (ui.guide) return app.placeGuide();
    if (ui.tool === 'select') {
      const clicked = gestures.up(e.shiftKey);
      showMarquee();
      const at = clicked && ptr.again !== null ? worldAt(e) : null;
      if (at) {
        const hits = planHits(at.p);
        const next = hits[(hits.indexOf(ptr.again!) + 1) % hits.length];
        if (next && next !== ptr.again) {
          ui.selection = new Set([next]);
          app.refresh();
        }
      }
      ptr.again = null;
      return;
    }
    if (moved) return;
    // The tool's click: a wall, a room, Modify, a door… (event-tools.ts); the tools drawn by points (a beam,
    // a roof, an axis, a guide…), point-tools.ts's.
    const tool = eventTool(app);
    if (tool) return tool.click(app, e, d.aim, PICK_PX / app.plan.scale);
    const drawing = pointTool(app);
    if (drawing) {
      const at = drawing.aim === '3d' ? aimAt3d(e) : worldAt(e);
      if (at && (drawing.aim !== 'planView' || ui.view === 'plan')) drawing.click(app, snapped(e)?.point ?? at.p, at.mpp, at.p);
    }
  };
  return { onUp, endWithRightClick };
}
