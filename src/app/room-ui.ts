// Rooms and floors from the plan: the room tool, the floor tool, holes, a room's floor and ceiling. Functions over the app (app.ts delegates).

import { distance, type Point2 } from '../core/vector';
import { defaultName, name, t } from '../ui/i18n';
import { LEVEL_HEIGHT, levelOf } from './document';
import { made, nextOf } from './next-element';
import type { Floor, Room } from '../elements/room/schema';
import { deriveGeometry } from './geometry';
import { newId } from '../core/id';
import { addFloor, addFloorHole, addRoom } from '../elements/room/commands';
import { insideRing, signedArea } from '../elements/room/derive';
import type { App } from './app';

/** The smallest space the level's walls close in around p, when no room is in it: where the room tool would make one. */
export function roomSpaceAt(app: App, p: Point2): readonly Point2[] | null {
  const g = app.visibleGeometry();
  if ([...g.rooms.values()].some((r) => r.enclosed && insideRing(r.outline, p))) return null;
  const around = g.spaces(app.ui.levelId).filter((s) => insideRing(s, p));
  return around.sort((a, b) => Math.abs(signedArea(a)) - Math.abs(signedArea(b)))[0] ?? null;
}

/** The room tool: a click inside closed walls makes a room there, unless one is there already. */
export function roomClick(app: App, p: Point2): void {
  const doc = app.store.get();
  const existing = [...app.visibleGeometry().rooms.values()].find((r) => r.enclosed && insideRing(r.outline, p));
  if (existing) {
    app.ui.selection = new Set([existing.room.id]);
    app.ui.error = null;
    app.ui.info = t('hint.roomExists');
    return app.refresh();
  }
  const n = doc.rooms.filter((r) => r.levelId === app.ui.levelId).length + 1;
  // Its use, height and finishes as the next room is set (next-element.ts); its name and number its own.
  const room = made<Room>(app, 'rooms', { id: newId('room'), seed: p, name: defaultName.room(n), number: String(n) });
  const probe = deriveGeometry({ ...doc, rooms: [room] }).rooms.get(room.id);
  if (!probe?.enclosed) {
    app.ui.error = t('hint.roomNotEnclosed');
    return app.renderChrome();
  }
  app.ui.error = null;
  app.store.dispatch(addRoom(room));
  // Said and selected at once, as a new floor is: its name and number are in the panel to change.
  app.ui.selection = new Set([room.id]);
  app.ui.info = t('hint.roomAdded', { room: name(room.name) });
  app.refresh();
}

/**
 * The floor tool: a click in a room floors it; elsewhere it adds a corner to an outline. A typed
 * point is always a corner, as the footer says: typing inside a room draws an outline there.
 */
export function floorClick(app: App, p: Point2, mpp: number, typed = false, corner = p): void {
  const draft = app.ui.floorDraft;
  if (draft.length === 0 && !typed && !app.ui.holeFor) {
    const room = [...app.visibleGeometry().rooms.values()].find((r) => r.enclosed && insideRing(r.outline, p));
    // Making ceilings: the room's ceiling, or the one it has selected.
    if (room && app.ui.ceilingTool) {
      const has = app.store.get().floors.find((f) => f.kind === 'ceiling' && f.source.kind === 'room' && f.source.roomId === room.room.id);
      if (has) {
        app.ui.selection = new Set([has.id]);
        app.ui.info = t('hint.ceilingExists');
        return app.refresh();
      }
      return addCeilingToRoom(app, room.room.id);
    }
    if (room) {
      const has = app.store.get().floors.find((f) => f.kind !== 'ceiling' && f.source.kind === 'room' && f.source.roomId === room.room.id);
      if (has && !app.ui.holeFor) {
        app.ui.selection = new Set([has.id]);
        app.ui.error = null;
        app.ui.info = t('hint.floorExists');
        return app.refresh();
      }
      app.ui.error = null;
      return app.addFloorToRoom(room.room.id);
    }
  }
  // Clicking the first corner again (within 10 px) closes the outline.
  if (draft.length >= 3 && distance(corner, draft[0]!) <= 10 * mpp) return app.floorFinish();
  // A corner (where the pointer snapped): the outline is what the footer is about now, not a room's
  // floor said before.
  app.ui.info = null;
  app.ui.floorDraft = [...draft, corner];
  app.render();
}

/** Draws a hole in a floor: the floor tool, its outline then going through that floor. */
export function startFloorHole(app: App, floorId: string): void {
  app.setTool('floor');
  app.ui.holeFor = floorId;
  app.ui.info = t('hint.holeStart');
  app.render();
}

/** A ceiling following a room's outline, at the room's ceiling height (its own, or its level's). */
export function addCeilingToRoom(app: App, roomId: string): void {
  const doc = app.store.get();
  const room = doc.rooms.find((r) => r.id === roomId);
  if (!room || doc.floors.some((f) => f.kind === 'ceiling' && f.source.kind === 'room' && f.source.roomId === roomId)) return;
  const height = room.height ?? levelOf(doc, room.levelId)?.height ?? LEVEL_HEIGHT;
  const id = newId('floor');
  // The next ceiling's thickness (next-element.ts), at the room's ceiling height.
  const thickness = (nextOf(app, 'ceilings') as unknown as Floor).thickness;
  app.store.dispatch(addFloor(made<Floor>(app, 'ceilings', { id, levelId: room.levelId, source: { kind: 'room', roomId }, thickness, offset: height + thickness, kind: 'ceiling' })));
  app.ui.selection = new Set([id]);
  app.ui.info = t('hint.ceilingAdded', { room: name(room.name) });
  app.refresh();
}

/** A floor following a room's outline; said and selected at once, so it is seen without another click. */
export function addFloorToRoom(app: App, roomId: string): void {
  const room = app.store.get().rooms.find((r) => r.id === roomId);
  if (!room || app.store.get().floors.some((f) => f.kind !== 'ceiling' && f.source.kind === 'room' && f.source.roomId === roomId)) return;
  const id = newId('floor');
  app.store.dispatch(addFloor(made<Floor>(app, 'floors', { id, levelId: room.levelId, source: { kind: 'room', roomId } })));
  app.ui.selection = new Set([id]);
  app.ui.info = t('hint.floorAdded', { room: name(room.name) });
  app.refresh();
}

export function floorFinish(app: App): void {
  const points = app.ui.floorDraft;
  app.ui.floorDraft = [];
  app.ui.snap = null;
  if (points.length < 3) return app.render();
  // Drawing a hole: the outline goes through the floor it was started from, which stays selected.
  const hole = app.ui.holeFor;
  if (hole) {
    app.ui.holeFor = null;
    app.store.dispatch(addFloorHole(hole, points));
    app.ui.selection = new Set([hole]);
    app.ui.info = t('hint.holeAdded');
    app.setTool('select');
    app.ui.selection = new Set([hole]);
    return app.refresh();
  }
  const id = newId('floor');
  // A ceiling by its outline: at its level's height, as a room's is with none of its own.
  if (app.ui.ceilingTool) {
    app.store.dispatch(addFloor(made<Floor>(app, 'ceilings', { id, source: { kind: 'outline', points }, kind: 'ceiling' })));
    app.ui.selection = new Set([id]);
    app.ui.info = t('hint.ceilingOutlineAdded', { n: points.length });
    return app.refresh();
  }
  app.store.dispatch(addFloor(made<Floor>(app, 'floors', { id, source: { kind: 'outline', points } })));
  app.ui.selection = new Set([id]);
  app.ui.info = t('hint.floorOutlineAdded', { n: points.length });
  app.refresh();
}

/** The floor tool making ceilings: a click in a room or an outline drawn. */
export function startCeiling(app: App): void {
  app.setTool('floor');
  app.ui.ceilingTool = true;
  app.render();
}
