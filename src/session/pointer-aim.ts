import { geometryOf } from '../project/carry';
import { distance, normalize, type Point2, sub } from '../model/vector';
import { snap } from './snap';
import type { App } from './app';
import { levelOf } from '../project/doc';
import type { WallId } from '../elements/wall/schema';
import { eachSolid, kindsNear } from '../elements/registry';
import type { PickOrder } from '../elements/contract';
import { outerSides } from '../elements/wall/geometry/seams';
import { guideShapes, levelGuides } from '../elements/guide/tool-ui';
import { shownGrids } from './annotation-tools';
import * as sceneCamera from '../render/scene-camera';
import * as appView from './app-view';


export function pointerAim(app: App, isShift: () => boolean) {
  const { shell, ui } = app;
  const local = (e: PointerEvent): Point2 => {
    const r = shell.viewport.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  /** Snap for grips: like drawing, without the wall being stretched. */
  const snapAt = (p: Point2, exclude: ReadonlySet<WallId>) =>
    snap({
      cursor: p,
      mpp: ui.view === 'plan' ? 1 / app.plan.scale : sceneCamera.metresPerPixel(app.scene, p, 0),
      segments: app.store.get().walls.filter((x) => x.levelId === ui.levelId && !exclude.has(x.id)),
      from: null,
      chainStart: null,
      enabled: ui.snaps,
      orthogonal: false,
      guides: levelGuides(app),
      parts: ui.snapParts,
    });
  /**
   * A guide (guide-tool.ts), in the tools that draw by points, in plan: Alt over a wall or a guide
   * starts it. Held, moved and let go, it is placed where it was let go; tapped, it stays until a
   * click, Enter or a typed distance (or Alt again) places it, or Esc drops it.
   */
  const guideTools = () => ui.view === 'plan' && (ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'measure') && !ui.drag;

  const worldAt = (e: PointerEvent | MouseEvent): { p: Point2; mpp: number } | null => {
    if (ui.view === 'plan') {
      const r = shell.planCanvas.getBoundingClientRect();
      return { p: app.plan.toWorld({ x: e.clientX - r.left, y: e.clientY - r.top }), mpp: 1 / app.plan.scale };
    }
    const z = (levelOf(app.store.get(), ui.levelId)?.elevation ?? 0) + appView.lift(app, ui.levelId);
    const p = sceneCamera.groundPoint(app.scene, e.clientX, e.clientY, z);
    return p ? { p, mpp: sceneCamera.metresPerPixel(app.scene, p, z) } : null;
  };

  /**
   * The point a drawing tool or an opening aims at. In 3D it is the one seen under the pointer, on the
   * level's walls, doors, windows and floors (or the level below's, which upper walls stand on): the top
   * of a wall is where its end is, not the floor far behind it. Elsewhere, and for dragging (whose
   * moves must stay on one plane), worldAt.
   */
  const aimAt3d = (e: PointerEvent | MouseEvent): { p: Point2; mpp: number } | null => {
    if (ui.view === 'plan') return worldAt(e);
    const doc = app.store.get();
    const levels = new Set([ui.levelId, appView.levelBelow(app)]);
    const onLevel = new Set([
      ...doc.walls.filter((w) => levels.has(w.levelId)).map((w) => w.id),
      // The registry's surfaces (a floor) on those levels.
      ...[...eachSolid(app.geometry.kinds)].filter((x) => x.kind.surface && x.levelId !== null && levels.has(x.levelId)).map((x) => x.id),
    ]);
    const walls = new Set(doc.walls.filter((w) => levels.has(w.levelId)).map((w) => w.id));
    for (const o of doc.openings) if (walls.has(o.wallId)) onLevel.add(o.id);
    const hit = app.scene.surfacePoint(e.clientX, e.clientY, (id) => onLevel.has(id));
    return hit ? { p: hit.p, mpp: sceneCamera.metresPerPixel(app.scene, hit.p, hit.height) } : worldAt(e);
  };

  // The walls' faces on the level, for the tape: the outline of their pieces, once per geometry. Every
  // piece's side was one before, and the line between a wall's plaster and its core caught the tape
  // first (a room of 4,35 m measured 4,38 m, core to core).
  let faceCache: { geometry: typeof app.geometry; levelId: string; faces: { start: Point2; end: Point2; face: true }[] } | null = null;
  const levelFaces = () => {
    if (!faceCache || faceCache.geometry !== app.geometry || faceCache.levelId !== ui.levelId) {
      const polygons = [...app.geometry.solids.values()].filter((s) => s.wall.levelId === ui.levelId).flatMap((s) => s.pieces.map((p) => p.polygon));
      faceCache = { geometry: app.geometry, levelId: ui.levelId, faces: outerSides(polygons).map((s) => ({ start: s.a, end: s.b, face: true as const })) };
    }
    return faceCache.faces;
  };
  // The faces of the level below's walls, for a wall drawn on its exterior or interior face: snapped
  // onto them, it stands flush on the wall below (a wall drawn on its axis has the axes below).
  let belowCache: { geometry: unknown; levelId: string; faces: { start: Point2; end: Point2; face: true }[] } | null = null;
  const belowFaces = (levelId: string) => {
    if (!belowCache || belowCache.geometry !== app.geometry || belowCache.levelId !== levelId) {
      const polygons = [...app.geometry.solids.values()].filter((s) => s.wall.levelId === levelId).flatMap((s) => s.pieces.map((p) => p.polygon));
      belowCache = { geometry: app.geometry, levelId, faces: outerSides(polygons).map((s) => ({ start: s.a, end: s.b, face: true as const })) };
    }
    return belowCache.faces;
  };
  // The elements' own points on the level, to snap to: a door's or a window's jambs and middle, an
  // object's or a column's corners and centre. Of the document as it is (not a preview: an object
  // being placed would catch its own centre), on the level shown. Once per document and level.
  let pointCache: { doc: unknown; levelId: string; points: { point: Point2; kind: 'center' | 'node' }[] } | null = null;
  const elementPoints = () => {
    const doc = app.store.get();
    if (!pointCache || pointCache.doc !== doc || pointCache.levelId !== ui.levelId) {
      const g = geometryOf(doc);
      const points: { point: Point2; kind: 'center' | 'node' }[] = [];
      const walls = new Set(doc.walls.filter((w) => w.levelId === ui.levelId).map((w) => w.id));
      for (const o of g.openings.values()) {
        const f = o.frame;
        if (!f || !walls.has(o.opening.wallId)) continue;
        points.push({ point: f.start, kind: 'node' }, { point: f.end, kind: 'node' }, { point: { x: (f.start.x + f.end.x) / 2, y: (f.start.y + f.end.y) / 2 }, kind: 'center' });
      }
      for (const x of eachSolid(g.kinds)) {
        if ((x.kind.key !== 'objects' && x.kind.key !== 'columns') || x.levelId !== ui.levelId) continue;
        for (const ring of x.kind.outlines(x.solid)) {
          if (ring.length === 0) continue;
          for (const v of ring) points.push({ point: v, kind: 'node' });
          points.push({ point: { x: ring.reduce((t, v) => t + v.x, 0) / ring.length, y: ring.reduce((t, v) => t + v.y, 0) / ring.length }, kind: 'center' });
        }
      }
      pointCache = { doc, levelId: ui.levelId, points };
    }
    return pointCache.points;
  };
  /** Half a wall's thickness: its ends snap from anywhere on its body near them (snap.ts: reach). */
  const halfOf = (id: string) => (app.geometry.solids.get(id)?.layers.reduce((t, l) => t + l.thickness, 0) ?? 0) / 2;
  const snapped = (e: PointerEvent | MouseEvent) => {
    const at = aimAt3d(e);
    if (!at) return null;
    const w = ui.wall;
    // A floor's outline snaps as a wall chain does: from its last corner, closing on its first once
    // it has three (its corners were free points, off the walls and the grid).
    const draft = ui.tool === 'floor' ? ui.floorDraft : null;
    // The tape snaps from its start, and onto the walls' faces and corners too: one measures a room
    // from wall to wall, not from axis to axis.
    const tape =
      ui.tool === 'measure' && ui.measure.kind === 'from'
        ? ui.measure.a
        : ui.tool === 'measure' && ui.measure.kind === 'chain'
          ? ui.measure.points.at(-1)!
        : ui.tool === 'dimension' && ui.dimension.kind === 'from'
          ? ui.dimension.a
          : ui.tool === 'grid'
            ? ui.gridFrom
            : ui.tool === 'guide'
              ? ui.guideFrom
            : ui.tool === 'beam' || ui.tool === 'separator' || ui.tool === 'curtain'
              ? ui.beamFrom
              : ui.tool === 'roof'
                ? (ui.roofDraft.at(-1) ?? null)
                : ui.tool === 'stair'
                  ? ui.stairFrom
                  : ui.tool === 'railing'
                    ? (ui.railingDraft.at(-1) ?? null)
                    : null;
    const measuring = ui.tool === 'measure' || ui.tool === 'dimension';
    const modifyFrom = ui.tool === 'modify' && ui.modify && ui.modify.state.step !== 'base' ? ui.modify.state.base : null;
    const faces = measuring ? levelFaces() : [];
    // The level below's walls too, without their numbers (those are the other level's): drawing an
    // upper floor snaps onto the walls it stands on.
    const below = ui.hidden.has('walls') ? null : appView.levelBelow(app);
    const walls = app.store.get().walls;
    const onFace = ui.tool === 'wall' && ui.defaults.referenceLine !== 'centerline' && below !== null;
    const from = tape ?? modifyFrom ?? (draft ? (draft.at(-1) ?? null) : w.kind === 'drawing' ? w.last : null);
    // Point and circle guides: points to snap to, circles to snap onto.
    const guideShape = guideShapes(app);
    ui.drawFrom = from;
    // A lock holds while the point is drawn from where it was set; a new point lets it go.
    if (ui.lock && (!from || distance(ui.lock.at, from) > 1e-9)) ui.lock = null;
    return snap({
      cursor: at.p,
      mpp: at.mpp,
      // Measuring, the faces come first and an axis catches only near itself: on a wall's body the
      // tape takes the face, not the axis the body otherwise stands for.
      segments: [
        ...faces,
        ...(onFace ? belowFaces(below) : []),
        ...walls.filter((x) => x.levelId === ui.levelId).map((x) => ({ id: x.id, start: x.start, end: x.end, reach: measuring ? 0 : halfOf(x.id), ...(x.bulge ? { bulge: x.bulge } : {}) })),
        ...walls.filter((x) => x.levelId === below).map((x) => ({ start: x.start, end: x.end, reach: measuring ? 0 : halfOf(x.id), ...(x.bulge ? { bulge: x.bulge } : {}) })),
      ],
      // Modifying, snapped from the base point: right angles and 15° steps from it, as a wall from its last point.
      from,
      // A chain being measured closes on its first point, as a floor's outline does.
      chainStart:
        ui.tool === 'measure' && ui.measure.kind === 'chain'
          ? ui.measure.points.length >= 3
            ? ui.measure.points[0]!
            : null
          : draft
            ? draft.length >= 3
              ? draft[0]!
              : null
            : (w.kind === 'drawing' && w.count >= 2) || w.kind === 'bend'
              ? w.start
              : null,
      enabled: ui.snaps,
      orthogonal: isShift() && !ui.lock,
      ...(ui.lock ? { lock: ui.lock.dir } : {}),
      acquired: ui.acquired,
      points: [...elementPoints(), ...guideShape.points],
      circles: guideShape.circles,
      parts: ui.snapParts,
      skip: ui.snapSkip,
      // The axes as lines to snap onto, as guides are, and where they cross.
      guides: [...levelGuides(app), ...shownGrids(app).flatMap((g) => (distance(g.start, g.end) > 0 ? [{ point: g.start, dir: normalize(sub(g.end, g.start)) }] : []))],
    });
  };

  /**
   * The Split tool's point: only a snap on a wall's body or its middle. An alignment or an extension
   * names the wall it comes from, away from the point: in the void, aligned with a wall's end, the
   * click went to that wall ("too near an end"), and the guide promised a cut where there is no wall.
   */
  const splitSnap = (e: PointerEvent | MouseEvent) => {
    const s = snapped(e);
    return s && (s.kind === 'onWall' || s.kind === 'midpoint') ? s : null;
  };

  /** The element under the pointer: an opening before the wall that hosts it. */
  const pickAt = (e: PointerEvent, at: { p: Point2 } | null) =>
    ui.view === 'plan' ? (at ? planPick(at.p) : null) : sceneCamera.pick(app.scene, e.clientX, e.clientY);
  /** In plan: what is under the point, in the order a click takes it: an opening, its wall, rooms, floors. */
  const planHits = (p: Point2): string[] => {
    const g = app.visibleGeometry();
    // Within a few pixels of a wall, a door or a window, it is taken: aiming inside a thin wall, or at a
    // door's leaf, was the only way before.
    const near = PICK_PX / app.plan.scale;
    // The registry's kinds under the point, by where they come among the rest (contract.ts: pick); of
    // one order, the one drawn last first. A handle (an axis's bubble, over the walls at a corner) first of all.
    // Only those near the point (registry.ts: kindsNear, a spatial index of the whole derivation).
    const nearby = kindsNear(app.geometry.kinds, p, near);
    const solids = [...eachSolid(g.kinds)].filter((x) => nearby.has(x.id)).reverse();
    const grabbed = solids.filter((x) => x.kind.grab?.(x.solid, p, app.plan.scale)).slice(0, 1).map((x) => x.id);
    // Of those hit, the nearest first (a door's leaf over the next door's: contract.ts, distance).
    const kindHits = (order: PickOrder) =>
      solids
        .filter((x) => x.kind.pick === order && x.kind.hit(x.solid, p, near, app.plan.scale))
        .map((x) => ({ id: x.id, d: x.kind.distance?.(x.solid, p) ?? 0 }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.id);
    return [
      ...grabbed,
      // A dimension by its line or its value, before what it measures.
      ...kindHits('first'),
      // A text over everything it is written on (the last kind drawn, so the first here); a door or a
      // window before the wall that hosts it.
      ...kindHits('beforeWalls'),
      ...kindHits('walls'),
      // A guide where the pointer is on it (before the room it runs across), beams, and an axis after
      // the walls on it: a click on a wall over an axis takes the wall.
      ...kindHits('afterWalls'),
      // Last, what lies over everything (a roof: its overhang, outside the walls, is where it is taken first).
      ...kindHits('last'),
    ].filter((id): id is string => id !== null);
  };
  const planPick = (p: Point2): string | null => planHits(p)[0] ?? null;
  return { local, snapAt, guideTools, worldAt, aimAt3d, levelFaces, belowFaces, elementPoints, halfOf, snapped, splitSnap, pickAt, planHits, planPick };
}

/** How near (screen pixels) the pointer must come to a wall, a door or a window to take it. */
export const PICK_PX = 6;
