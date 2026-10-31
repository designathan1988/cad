// The pointer let go over the drawing: what a release ends or makes in each tool (a click, a drag, the
// selection box, a menu), and what a right click ends before any menu. Part of the handlers of
// pointer-handlers.ts, with the same state and helpers.

import { endHandleDrag } from './object-handles';
import { wallAt } from '../project/derived-queries';
import type { App } from './app';
import { insideRing } from '../elements/room/derive';
import { cancelGuide, guideClick } from '../elements/guide/tool-ui';
import { gridClick, gridEscape, markClick } from './annotation-tools';
import { wallEvent } from '../elements/wall/tool-ui';
import { floorFinish, roomSpaceAt } from './room-tool';
import { calloutClick, sectionClick, sectionEscape } from './section-tools';
import { addLevelMarkHere, addNoteHere, beamClick, columnClick, curtainClick, objectClick, railingClick, railingFinish, roofClick, roofFinish, separatorClick, stairClick } from './kind-tools';
import { cornerClick, splitAt } from './modify';
import { calibrateClick } from '../ui/reference-tool';
import { PICK_PX } from './pointer-aim';
import type { PointerDeps } from './pointer-handlers';

export function pointerRelease(app: App, d: PointerDeps) {
  const { ui } = app;
  const { ptr, gestures, showMarquee, contextMenu, toolMenu } = d;
  const { aimAt3d, planHits, snapped, splitSnap, worldAt } = d.aim;
  /**
   * What a right click ends before it opens any menu: a wall chain (as Enter: the walls drawn stay), a
   * floor outline (closed from three corners, dropped before), the measure tool's tape, a drag (as
   * Esc). True when it ended something.
   */
  const endWithRightClick = (): boolean => {
    if (ui.tool === 'modify') {
      app.setTool('select');
      return true;
    }
    if (ui.guide) {
      cancelGuide(app);
      return true;
    }
    if (gestures.cancel()) {
      ptr.downAt = null;
      showMarquee();
      return true;
    }
    if (ui.tool === 'wall' && ui.wall.kind !== 'idle') {
      wallEvent(app, { kind: 'enter' });
      return true;
    }
    if (ui.tool === 'floor' && ui.floorDraft.length > 0) {
      if (ui.floorDraft.length >= 3) floorFinish(app);
      else {
        ui.floorDraft = [];
        app.render();
      }
      return true;
    }
    if (ui.tool === 'dimension' && ui.dimension.kind !== 'idle') {
      app.dimensionEvent({ kind: 'escape' });
      return true;
    }
    if (ui.tool === 'grid' && ui.gridFrom) {
      gridEscape(app);
      return true;
    }
    if (ui.tool === 'section' && ui.sectionFrom) {
      sectionEscape(app);
      return true;
    }
    if (ui.tool === 'callout' && ui.calloutFrom) {
      ui.calloutFrom = null;
      app.render();
      return true;
    }
    if ((ui.tool === 'beam' || ui.tool === 'separator' || ui.tool === 'curtain') && ui.beamFrom) {
      ui.beamFrom = null;
      app.render();
      return true;
    }
    if (ui.tool === 'mark' && ui.markDraft.length > 0) {
      ui.markDraft = ui.markDraft.slice(0, -1);
      app.render();
      return true;
    }
    if (ui.tool === 'roof' && ui.roofDraft.length > 0) {
      roofFinish(app);
      return true;
    }
    if (ui.tool === 'railing' && ui.railingDraft.length > 0) {
      railingFinish(app);
      return true;
    }
    if (ui.tool === 'measure' && ui.measure.kind !== 'idle') {
      app.measureEvent({ kind: 'escape' });
      return true;
    }
    return false;
  };

  const onUp = (e: PointerEvent) => {
    if (ptr.boxDrag) {
      ptr.boxDrag = null;
      app.boxHot = null;
      if (ui.view3d.box) app.setBox(ui.view3d.box, true);
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
    if (e.button === 0 && ui.handleDrag) {
      const d = ui.handleDrag;
      ui.handleDrag = null;
      endHandleDrag(app, d);
      return app.refresh();
    }
    if (e.button !== 0 || !ptr.downAt) return;
    const moved = Math.hypot(e.clientX - ptr.downAt.x, e.clientY - ptr.downAt.y) > 4;
    ptr.downAt = null;
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
    if (app.openingKind()) return app.openingEvent({ kind: 'click' });
    if (ui.tool === 'modify') {
      const at = aimAt3d(e);
      if (at) app.modifyEvent({ kind: 'click', point: snapped(e)?.point ?? at.p });
      return;
    }
    if (ui.tool === 'split') {
      const s = splitSnap(e);
      const at = aimAt3d(e);
      if (at) splitAt(app, s?.point ?? at.p, s?.wallId ?? (ui.view === 'plan' ? (wallAt(app.visibleGeometry(), at.p, undefined, PICK_PX / app.plan.scale) ?? undefined) : undefined));
      return;
    }
    if (ui.tool === 'corner') {
      const at = worldAt(e);
      if (at) cornerClick(app, ui.view === 'plan' ? wallAt(app.visibleGeometry(), at.p, undefined, PICK_PX / app.plan.scale) : app.scene.pick(e.clientX, e.clientY));
      return;
    }
    if (ui.tool === 'measure') {
      const at = worldAt(e);
      if (at) app.measureEvent({ kind: 'click', point: snapped(e)?.point ?? at.p });
      return;
    }
    if (ui.tool === 'dimension') {
      const at = worldAt(e);
      if (at) app.dimensionEvent({ kind: 'click', point: snapped(e)?.point ?? at.p });
      return;
    }
    if (ui.tool === 'grid') {
      const at = worldAt(e);
      if (at && ui.view === 'plan') gridClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'section') {
      const at = worldAt(e);
      if (at && ui.view === 'plan') sectionClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'column') {
      const at = aimAt3d(e);
      if (at) columnClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'guide') {
      const at = worldAt(e);
      if (at && ui.view === 'plan') guideClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'object') {
      const at = aimAt3d(e);
      if (at) objectClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'beam') {
      const at = aimAt3d(e);
      if (at) beamClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'separator') {
      const at = worldAt(e);
      if (at) separatorClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'mark') {
      const at = worldAt(e);
      if (at && ui.view === 'plan') markClick(app, ui.markMode === 'radius' ? at.p : (snapped(e)?.point ?? at.p));
      return;
    }
    if (ui.tool === 'curtain') {
      const at = worldAt(e);
      if (at) curtainClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'callout') {
      const at = worldAt(e);
      if (at && ui.view === 'plan') calloutClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'calibrate') {
      const at = worldAt(e);
      if (at && ui.view === 'plan') calibrateClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    // A text or a level mark where the click is; then selected, its text ready to type.
    if (ui.tool === 'note' || ui.tool === 'levelMark') {
      const at = worldAt(e);
      if (!at) return;
      const p = snapped(e)?.point ?? at.p;
      return ui.tool === 'note' ? addNoteHere(app, p) : addLevelMarkHere(app, p);
    }
    if (ui.tool === 'roof') {
      const at = worldAt(e);
      if (at) roofClick(app, snapped(e)?.point ?? at.p, at.mpp);
      return;
    }
    if (ui.tool === 'stair') {
      const at = aimAt3d(e);
      if (at) stairClick(app, snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'railing') {
      const at = aimAt3d(e);
      if (at) railingClick(app, snapped(e)?.point ?? at.p, at.mpp);
      return;
    }
    if (ui.tool === 'room' || ui.tool === 'floor') {
      const at = worldAt(e);
      if (!at) return;
      if (ui.tool === 'room') {
        // A finger does not hover: its first tap in a space shows the room it would make there, as
        // the pointer does before a click, and a second tap in that space makes it. One tap made it
        // unseen.
        if (e.pointerType === 'touch' && ui.view === 'plan') {
          const space = roomSpaceAt(app, at.p);
          if (space && !(ui.tapToConfirm && ui.roomSpace && insideRing(ui.roomSpace, at.p))) {
            ui.roomSpace = space;
            ui.tapToConfirm = true;
            return app.render();
          }
        }
        ui.tapToConfirm = false;
        return app.roomClick(at.p);
      }
      // Inside a room (its floor) as clicked; a corner where it snaps.
      return app.floorClick(at.p, at.mpp, false, snapped(e)?.point ?? at.p);
    }
    const s = snapped(e);
    if (s) wallEvent(app, { kind: 'click', point: s.point });
  };
  return { onUp, endWithRightClick };
}
