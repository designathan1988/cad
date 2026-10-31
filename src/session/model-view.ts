// The model as the session shows it: the geometry with hidden and temporary views applied (joined as
// shown), the selected walls and openings, a wall made or oriented from two points, framing all, and the
// refresh after a change.

import * as viewing from './view-ui';
import * as walls from '../elements/wall/tool-ui';
import { previewWall } from '../elements/wall/tool-ui';
import type { Point2 } from '../model/vector';
import { isOpeningId } from '../elements/opening/schema';
import { dragTransform } from './drag';
import { type DocWall } from '../project/doc';
import { previewTransform } from './modify-tool';
import { filterKinds, kindLists, levelOfSolid, moveKinds } from '../elements/registry';
import { geometryOf, keepRooms, moveRooms } from '../project/carry';
import { keepOpenings } from '../elements/opening/keep';
import { type DerivedGeometry, deriveGeometry, type OpeningSolid } from '../project/derive';
import { applyTemporary, hideCategories } from '../project/derived-filters';
import { shownLevels } from './view/view-3d';
import { transformSelection } from '../elements/transform';
import { previewObject, previewOpening } from './app-placing';
import type { App } from './app';
import { newWallId } from '../elements/wall/schema';
import type { WallId } from '../elements/wall/schema';

/** Recomputes the derived geometry (with the wall being drawn) and redraws. */
export function refresh(app: App): void {
  const doc = app.store.get();
  const d = app.ui.drag;
  // The Modify tool's result as it would be with the pointer where it is, copies included.
  const m = app.ui.tool === 'modify' ? app.ui.modify : null;
  const t = m ? previewTransform(m.kind, m.state, app.ui.snap?.point ?? app.ui.cursor, m.line) : null;
  if (m && t) {
    let n = 0;
    const previewId = (prefix: string) => `${prefix}_preview${++n}`;
    const shownDoc = transformSelection(doc, app.modifyBefore ?? app.geometry, [...app.ui.selection], t, m.copy, previewId, m.disjoin).doc;
    // Doors and windows, and a room the walls would be moved past, as they will be when the move is made.
    app.geometry = keepRooms(doc, keepOpenings(doc, shownDoc)).geometry;
    return app.render();
  }
  // While dragging, the walls as dragged; the rooms going with a move or a turn go in the preview too,
  // so they never show as open mid-drag. The object tool shows the object under the pointer.
  const placed = previewObject(app, doc);
  const shown = placed ? placed :
    d?.kind === 'move' || d?.kind === 'rotate'
      ? {
          ...doc,
          walls: d.walls,
          rooms: moveRooms(doc.rooms, d.rooms, dragTransform(d)),
              ...(d.kind === 'move' ? kindLists(moveKinds(doc, d.kinds, d.delta)) : {}),
        }
      : d?.kind === 'slide'
        ? { ...doc, openings: d.openings, openingGroups: d.groups }
        : d?.kind === 'dimLine'
          ? // A dimension's line where it is dragged.
            { ...doc, dimensions: doc.dimensions.map((x) => (x.id === d.id ? { ...x, offset: d.offset } : x)) }
          : d && d.kind !== 'marquee' && d.kind !== 'handle'
            ? { ...doc, walls: d.walls }
            : doc;
  // Walls being dragged: doors and windows keep to their faces and a room they pass over keeps its
  // space, as they will when the walls are dropped.
  const drawing = previewWall(app);
  const placing = previewOpening(app);
  app.geometry =
    shown.walls !== doc.walls
      ? keepRooms(doc, keepOpenings(doc, shown)).geometry
      : drawing.length === 0 && placing.length === 0
        ? geometryOf(shown)
        : deriveGeometry(shown, drawing, placing);
  app.render();
}

/** In plan, only the current level's walls and openings; in 3D, the levels the view shows (view-3d.ts). */
export function visibleGeometry(app: App): DerivedGeometry {
  const g = hideCategories(joinedAsShown(app, applyTemporary(app.geometry, app.ui.temp)), app.ui.hidden);
  if (app.ui.view !== 'plan') {
    const doc = app.store.get();
    const shown = shownLevels(doc.levels, app.ui.levelId, app.ui.view3d.levels);
    if (shown.size === doc.levels.length) return g;
    const solids = new Map([...g.solids].filter(([, s]) => shown.has(s.wall.levelId)));
    return {
      ...g,
      solids,
      openings: new Map([...g.openings].filter(([, o]) => solids.has(o.opening.wallId))),
      rooms: new Map([...g.rooms].filter(([, r]) => shown.has(r.room.levelId))),
      kinds: filterKinds(g.kinds, (k, x) => {
        const l = levelOfSolid(k, x);
        return l === null || shown.has(l);
      }),
    };
  }
  const solids = new Map([...g.solids].filter(([, s]) => s.wall.levelId === app.ui.levelId));
  const levelWalls = new Set(app.store.get().walls.filter((w) => w.levelId === app.ui.levelId).map((w) => w.id));
  const openings = new Map([...g.openings].filter(([, o]) => levelWalls.has(o.opening.wallId)));
  const rooms = new Map([...g.rooms].filter(([, r]) => r.room.levelId === app.ui.levelId));
  // An axis (on every level) on each; a text, like the rest, on its own.
  const kinds = filterKinds(g.kinds, (k, x) => {
    const l = levelOfSolid(k, x);
    return l === null || l === app.ui.levelId;
  });
  return { ...g, solids, openings, rooms, kinds };
}

export function selectedOpenings(app: App): OpeningSolid[] {
  return [...app.ui.selection].filter(isOpeningId).flatMap((id) => app.geometry.openings.get(id) ?? []);
}

export function selectedWalls(app: App): DocWall[] {
  return app.store.get().walls.filter((w) => app.ui.selection.has(w.id));
}

/**
 * The wall drawn from `start` to `end`, turned round when Space flipped the side: the same line, the
 * body on its other side (its exterior is on the right of its direction, so the direction is what flips).
 */
export function oriented(app: App, start: Point2, end: Point2, id: WallId, bulge = 0): DocWall {
  return walls.oriented(app, start, end, id, bulge);
}

export function makeWall(app: App, start: Point2, end: Point2, id = newWallId(), bulge = 0): DocWall {
  return walls.makeWall(app, start, end, id, bulge);
}

export function frameAll(app: App): void {
  return viewing.frameAll(app);
}

export function joinedAsShown(app: App, shown: DerivedGeometry): DerivedGeometry {
  const temp = app.ui.temp;
  if (!temp || shown.solids.size === app.geometry.solids.size) return shown;
  const c = app.joinedCache;
  if (c && c.from === app.geometry && c.temp === temp) return c.g;
  const doc = app.store.get();
  const walls = [...shown.solids.values()].map((s) => s.wall);
  const ids = new Set(walls.map((w) => w.id));
  const own = deriveGeometry({ ...doc, walls, openings: doc.openings.filter((o) => ids.has(o.wallId) && shown.openings.has(o.id)) });
  // Doors and windows being placed are not in the document: they stay as they were.
  const openings = new Map([...own.openings, ...[...shown.openings].filter(([id]) => !own.openings.has(id) && !doc.openings.some((o) => o.id === id))]);
  const g = { ...shown, solids: own.solids, openings };
  app.joinedCache = { from: app.geometry, temp, g };
  return g;
}
