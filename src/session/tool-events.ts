// What the tools' events do to the session and the project: choosing a tool, an opening, a room or a floor
// click, a guide placed, the modify, measure and dimension tools' events, and a series copied.

import * as viewing from './view-ui';
import * as modify from './modify';
import * as roomsUi from './room-tool';
import { addFloorToRoom } from './room-tool';
import * as guides from '../elements/guide/tool-ui';
import { guideOffset } from '../elements/guide/tool-ui';
import * as annotationTools from './annotation-tools';
import type { Point2 } from '../model/vector';
import { addOpening, placementProblem, wallRule } from '../elements/opening/commands';
import { newOpening } from '../elements/opening/schema';
import { aimAlong, OPENING_PREVIEW_ID } from '../elements/opening/aim';
import { t } from '../i18n/messages';
import { type ToolId } from '../ui/shell';
import { OPENING_IDLE, type OpeningToolEvent, openingTransition } from '../elements/opening/tool';
import { MEASURE_IDLE, type MeasureEvent, measureTransition } from '../elements/measure/tool';
import { IDLE } from '../elements/wall/tool';
import { DIMENSION_IDLE, type DimensionToolEvent } from '../tools/dimension-tool';
import { type ModifyEvent } from './modify-tool';
import { referenceLength } from '../elements/opening/derive';
import { afterColon } from './app-placing';
import type { App } from './app';
import { newOpeningId } from '../elements/opening/schema';
import { NO_DRAFT } from '../elements/tool-draft';

export function setTool(app: App, tool: ToolId): void {
  // The floor tool with one room selected floors that room at once: the keyboard's way to it, as a
  // click inside the room is the mouse's (the tester's K3).
  const room = tool === 'floor' && app.ui.selection.size === 1 ? app.store.get().rooms.find((r) => app.ui.selection.has(r.id)) : undefined;
  // The door and window tools with one wall selected aim at its middle: a typed distance or Enter
  // places the opening there without the pointer (the tester's K2).
  const host = (tool === 'door' || tool === 'window') && app.ui.selection.size === 1 ? app.store.get().walls.find((w) => app.ui.selection.has(w.id)) : undefined;
  app.ui.tool = tool;
  app.ui.wall = IDLE;
  // A lock and the points rested on belong to what was being drawn.
  app.ui.lock = null;
  // What the last tool was drawing goes with it (tool-draft.ts).
  app.ui.draft = NO_DRAFT;
  app.ui.acquired = [];
  app.ui.roomSpace = null;
  app.ui.tapToConfirm = false;
  // A side flipped for some walls is not left for later ones, drawn another time.
  app.ui.wallFlip = false;
  app.ui.opening = OPENING_IDLE;
  app.ui.measure = MEASURE_IDLE;
  app.ui.dimension = DIMENSION_IDLE;
  app.ui.guide = null;
  app.ui.modify = null;
  app.modifyBefore = null;
  app.ui.snap = null;
  app.ui.hover = null;
  app.ui.error = null;
  app.ui.info = null;
  app.shell.measure.value = '';
  if (tool !== 'select') app.ui.selection.clear();
  if (room) {
    const has = app.store.get().floors.find((f) => f.source.kind === 'room' && f.source.roomId === room.id);
    if (!has) return addFloorToRoom(app, room.id);
    app.ui.selection = new Set([has.id]);
    app.ui.info = t('hint.floorExists');
  }
  if (host) {
    const aim = aimAlong(app.store.get(), app.geometry, host.id, referenceLength(host) / 2, 1 / app.plan.scale, OPENING_PREVIEW_ID);
    if (aim) return openingEvent(app, { kind: 'hover', aim });
  }
  app.refresh();
}

export function openingEvent(app: App, event: OpeningToolEvent): void {
  const kind = app.openingKind();
  if (!kind) return;
  const r = openingTransition(app.ui.opening, event, app.ui.openingDefaults[kind].width);
  app.ui.opening = r.state;
  if (r.place) {
    const size = app.ui.openingDefaults[kind];
    const made = newOpening(newOpeningId(), r.place.wallId, kind, r.place.rule, { ...size, ...app.placedSides(kind, r.place.swing) });
    // Where it was aimed, held by its wall: measured from a neighbour, it moved whenever that one did.
    const opening = { ...made, rule: wallRule(app.store.get(), made) };
    const problem = placementProblem(app.store.get(), opening);
    if (problem) {
      app.ui.error = t('hint.openingRefused', { reason: afterColon(t(`warn.${problem}`)) });
      return app.refresh();
    }
    app.ui.error = null;
    // Placed: no preview until the pointer aims again. Left aiming at the same spot, the preview lay
    // over the opening just placed, red, with "overlaps another opening", as if it had been refused.
    app.ui.opening = OPENING_IDLE;
    app.store.dispatch(addOpening(opening));
  } else app.refresh();
}

/** The room tool: a click inside closed walls makes a room there, unless one is there already. */
export function roomClick(app: App, p: Point2): void {
  return roomsUi.roomClick(app, p);
}

/**
 * The floor tool: a click in a room floors it; elsewhere it adds a corner to an outline. A typed
 * point is always a corner, as the footer says: typing inside a room draws an outline there.
 */
export function floorClick(app: App, p: Point2, mpp: number, typed = false, corner = p): void {
  return roomsUi.floorClick(app, p, mpp, typed, corner);
}

/** Places the guide being set, as one undo step; the drawing tool goes on as it was. */
export function placeGuide(app: App, offset = guideOffset(app)): void {
  return guides.placeGuide(app, offset);
}

/** A click, a typed value or Esc in a Modify tool (modify-tool.ts); the transform, when done, is one undo step. */
export function modifyEvent(app: App, event: ModifyEvent): void {
  return modify.modifyEvent(app, event);
}

/**
 * The last copy made a series, as SketchUp's Move-copy and Revit's Array: `n` copies one after
 * another at its step ("3x"), or, `divide`, `n` copies spread evenly from the original to where the
 * copy went ("/3"). It replaces the copy: one undo step, the last copy of the series selected.
 */
export function copySeries(app: App, n: number, divide: boolean): boolean {
  return modify.copySeries(app, n, divide);
}

/** The measure tool: a click, Enter or Esc (measure-tool.ts). Nothing is added to the drawing. */
export function measureEvent(app: App, event: MeasureEvent): void {
  app.ui.measure = measureTransition(app.ui.measure, event, app.ui.measureMode);
  if (event.kind === 'escape') app.ui.snap = null;
  app.shell.measure.value = '';
  app.render();
}

/** The dimension tool: a click or Esc (dimension-tool.ts). The third click makes the dimension. */
export function dimensionEvent(app: App, event: DimensionToolEvent): void {
  return annotationTools.dimensionEvent(app, event);
}

/** The plan's zoom and position, kept for the next visit once they have been still for a moment. */
export function keepPlanView(app: App): void {
  return viewing.keepPlanView(app);
}
