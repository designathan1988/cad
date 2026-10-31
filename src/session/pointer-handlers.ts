import { moveHandleDrag, objectHandleAt, startHandleDrag } from './object-handles';
import { dragDistance, moveFace } from '../model/section-box';
import { distance } from '../model/vector';
import type { App } from './app';
import { moveGuide } from '../elements/guide/tool-ui';
import { boxFaceOnScreen, boxHandleAt } from './view-ui';
import { PICK_PX, type pointerAim } from './pointer-aim';
import type { PointerState } from './pointer-state';
import type { SelectGestures } from './drag';
import { pointerRelease } from './pointer-release';
import * as appView from './app-view';
import { pointTool } from './point-tools';
import { eventTool } from './event-tools';


/** What the handlers use of the input wired around them. */
export interface PointerDeps {
  readonly ptr: PointerState;
  readonly aim: ReturnType<typeof pointerAim>;
  readonly gestures: SelectGestures;
  readonly tracker: HTMLElement;
  readonly showTracker: () => void;
  readonly showMarquee: () => void;
  readonly contextMenu: (e: PointerEvent) => void;
  readonly toolMenu: (e: PointerEvent) => void;
}

export function pointerHandlers(app: App, d: PointerDeps) {
  const { ui } = app;
  const { ptr, gestures, tracker, showTracker, showMarquee } = d;
  const { local, pickAt, snapAt, snapped, worldAt } = d.aim;
  const { onUp, endWithRightClick } = pointerRelease(app, d);
  const onMove = (e: PointerEvent) => {
    ptr.lastMove = e;
    if (!tracker.hidden) showTracker();
    // Resting on a point a moment acquires it: the next points align with it across or up.
    window.clearTimeout(ptr.acquireTimer);
    ptr.acquireTimer = window.setTimeout(() => {
      const s = ui.snap;
      if (!s || ui.tool === 'select' || !ACQUIRED.has(s.kind) || ui.acquired.some((p) => distance(p, s.point) < 1e-9)) return;
      ui.acquired = [...ui.acquired, s.point].slice(-3);
      app.render();
    }, ACQUIRE_MS);
    // Moved on from where Tab was pressed: the snaps start over.
    if (ptr.tabAt && Math.hypot(e.clientX - ptr.tabAt.x, e.clientY - ptr.tabAt.y) > 4) {
      ptr.tabAt = null;
      ui.snapSkip = [];
    }
    ptr.shift = e.shiftKey;
    // The right button pressed while the left one is held (a chord) comes as a move, not a down:
    // during a drag it cancels it, as a right click does.
    if (e.button === 2 && (e.buttons & 1) === 1 && endWithRightClick()) return;
    app.pointer = { x: e.clientX, y: e.clientY };
    if (ptr.left?.kind === 'box') {
      const b = ptr.left;
      const d = dragDistance({ x: e.clientX - b.from.x, y: e.clientY - b.from.y }, b.along);
      return appView.setBox(app, moveFace(b.box, b.face, d), false);
    }
    if (ui.view === '3d' && ui.view3d.box && (e.buttons & 1) === 0) {
      const hot = boxHandleAt(app, e.clientX, e.clientY);
      if (hot !== app.boxHot) {
        app.boxHot = hot;
        app.render();
      }
      if (hot) return;
    }
    if (ptr.panning && ui.view === 'plan') {
      app.plan.panBy(e.clientX - ptr.panning.x, e.clientY - ptr.panning.y);
      ptr.panning = { x: e.clientX, y: e.clientY };
      app.render();
      return;
    }
    const at = worldAt(e);
    ui.cursor = at?.p ?? null;
    // Only selecting highlights what is under the pointer; another tool must not leave it lit.
    if (ui.tool !== 'select') ui.hover = null;
    if (ui.guide) {
      if (ptr.altAt && Math.hypot(e.clientX - ptr.altAt.x, e.clientY - ptr.altAt.y) > 4) ptr.altMoved = true;
      if (at) moveGuide(app, at.p);
      return;
    }
    // The tool's move (event-tools.ts); the tools drawn by points (point-tools.ts) snap and draw.
    const tool = eventTool(app);
    if (tool) return tool.move(app, e, d.aim, at, PICK_PX / app.plan.scale);
    if (pointTool(app)) {
      ui.snap = snapped(e);
      return app.render();
    }
    if (ui.drag?.kind === 'handle') {
      ui.drag = moveHandleDrag(app, ui.drag, local(e));
      return app.refresh();
    }
    if (ui.tool === 'select' && !ptr.left) {
      // The handle under the pointer, lit, so it is seen to be taken.
      const hot = objectHandleAt(app, local(e));
      if (hot?.param !== app.hotHandle?.param || hot?.id !== app.hotHandle?.id) {
        app.hotHandle = hot;
        app.render();
      }
    }
    if (ptr.left?.kind === 'press' && ui.tool === 'select') {
      gestures.move(local(e), at?.p ?? null, snapAt, e.shiftKey, e.altKey);
      showMarquee();
      return;
    }
    const hover = pickAt(e, at);
    if (hover !== ui.hover) ui.hover = hover;
    app.render();
  };

  const onDown = (e: PointerEvent) => {
    ptr.shift = e.shiftKey;
    // What the footer said about the last action is old news once the user acts on the drawing again.
    ui.info = null;
    (e.target as HTMLElement).focus?.();
    if (e.button === 1 && ui.view === 'plan') {
      e.preventDefault();
      ptr.panning = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 2) ptr.rightAt = { x: e.clientX, y: e.clientY };
    if (e.button !== 0) return;
    // A section box handle: its face goes with the pointer, along the face's axis on screen.
    const face = boxHandleAt(app, e.clientX, e.clientY);
    if (face && ui.view3d.box) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      ptr.left = { kind: 'box', face, box: ui.view3d.box, from: { x: e.clientX, y: e.clientY }, along: boxFaceOnScreen(app, face) };
      app.boxHot = face;
      return app.render();
    }
    // A selected object's handle (object-handles.ts), in plan or 3D: its parameter goes with the pointer.
    const handle = ui.tool === 'select' ? objectHandleAt(app, local(e)) : null;
    if (handle) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      ui.drag = startHandleDrag(app, handle, local(e));
      return app.refresh();
    }
    ptr.left = { kind: 'press', x: e.clientX, y: e.clientY };
    if (ui.tool === 'select') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const at = worldAt(e);
      const hit = pickAt(e, at);
      ptr.again = ui.view === 'plan' && !e.shiftKey && hit !== null && ui.selection.size === 1 && ui.selection.has(hit) ? hit : null;
      gestures.down(local(e), at?.p ?? null, hit, e.shiftKey);
    }
  };

  return { onMove, onDown, onUp, endWithRightClick };
}

/** What a rest on the pointer acquires: a point of something, not a place on a line or the grid. */
export const ACQUIRED = new Set(['endpoint', 'corner', 'midpoint', 'division', 'center', 'node', 'intersection']);

/** How long the pointer rests on a point to acquire it (ms). */
export const ACQUIRE_MS = 450;
