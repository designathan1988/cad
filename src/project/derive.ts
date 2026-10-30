// Document → derived wall geometry, through the join engine. Recomputed when the document changes,
// never stored.

import { separatorStrip } from '../elements/separator/schema';
import { add, insidePolygon, polygonDistance, polylineDistance, type Point2, scale } from '../model/vector';
import { deriveKinds, eachSolid, filterKinds, type KindSolids } from '../elements/registry';
import { deriveOpenings, hostsOf, type OpeningWarning, type PlacedOpening } from '../elements/opening/derive';
import type { Opening, OpeningId } from '../elements/opening/schema';
import { swingRegion, symbolLines } from '../elements/opening/symbol';
import { type Block, cutPlan, cutSolid, type OpeningCut, type OpeningFrame, openingFrame } from '../elements/opening/void';
import { computeWallGeometry, type Piece } from '../elements/wall/geometry/footprint';
import { area, clipHalfPlane, type ConvexPolygon, halfPlaneThrough, overlapArea, toCounterClockwise } from '../elements/wall/geometry/convex';
import { faceOffsets, stationOf, wallLength, wallNormal } from '../elements/wall/geometry/offset';
import { AREA_EPSILON, POINT_TOLERANCE } from '../model/tolerance';

/** How far past the host's faces another wall still counts as meeting it inside an opening (m). */
const JOINT_REACH = 0.01;
import { shapeOf } from '../elements/wall/geometry/shape';
import type { JoinWarning } from '../elements/wall/join/types';
import type { WallId, WallLayer, WallType } from '../elements/wall/schema';
import { layerSeams, type Seam } from '../elements/wall/geometry/seams';
import { deriveRooms, type RoomSolid, type RoomWarning, spacesOf } from '../elements/room/derive';
import type { RoomId } from '../elements/room/schema';
import type { Point2 as P } from '../model/vector';
import { type Material, materialIn } from '../elements/material/schema';
import { CUT_HEIGHT, cutHeightOf, type Doc, type DocWall, levelOf, roofCoversOf, wallHeights, wallTop } from './doc';
import { blocksUnder } from '../elements/wall/geometry/under-roof';

export type PlanCut = 'cut' | 'below' | 'above';

export interface WallSolid {
  readonly wall: DocWall;
  /** Plan pieces, with the openings cut through. */
  readonly pieces: readonly Piece[];
  /**
   * How it shows in plan, a section at its level's cut height: 'cut' when it crosses that height (its
   * pieces there), 'below' or 'above' when it is only seen (its slice nearest to the cut).
   */
  readonly plan: PlanCut;
  /** 3D blocks: the pieces sliced in height around the openings' holes. */
  readonly blocks: readonly Block[];
  readonly bottom: number;
  readonly top: number;
  /** Its type's layers, from the exterior face: what each piece's layerIndex is (none when the type is missing). */
  readonly layers: readonly WallLayer[];
  /** Lines in plan where its pieces meet pieces of another layer (geometry/seams.ts). */
  readonly seams: readonly Seam[];
  /** Each layer's material (the project's materials), in the order of `layers`: what paints it in plan and 3D. */
  readonly materials: readonly Material[];
}

export interface OpeningSolid extends PlacedOpening {
  /** Null when the host is missing or has no valid shape: nothing to draw. */
  readonly frame: OpeningFrame | null;
  /** Absolute heights of the bottom and the head. */
  readonly bottom: number;
  readonly top: number;
  /** Its leaves', frame's and glass's materials where its style sets them (the project's); the scene's otherwise. */
  readonly looks?: { readonly leaf?: Material; readonly frame?: Material; readonly glass?: Material };
}

export interface DerivedGeometry {
  readonly solids: ReadonlyMap<WallId, WallSolid>;
  readonly warnings: readonly JoinWarning[];
  readonly openings: ReadonlyMap<OpeningId, OpeningSolid>;
  readonly openingWarnings: readonly OpeningWarning[];
  readonly rooms: ReadonlyMap<RoomId, RoomSolid>;
  readonly roomWarnings: readonly RoomWarning[];
  /** A level's spaces, the ones its walls close in (room/derive.ts): where the room tool can put a room. Found when asked. */
  readonly spaces: (levelId: string) => readonly (readonly P[])[];
  /** Each level's wall pieces before doors and windows are cut: what the building covers (app/lot-areas.ts). */
  readonly levelPieces: ReadonlyMap<string, readonly (readonly P[])[]>;
  /** The registry's kinds (elements/registry.ts), derived: by kind, then id. */
  readonly kinds: KindSolids;
}

/**
 * `extra` are walls being drawn: joined with the rest so the preview shows the real corner.
 * `extraOpenings` are openings being placed, cut and checked like the others.
 */
export function deriveGeometry(doc: Doc, extra: readonly DocWall[] = [], extraOpenings: readonly Opening[] = []): DerivedGeometry {
  const walls = [...doc.walls, ...extra];
  const types = new Map(doc.wallTypes.map((t) => [t.id, t]));
  const { pieces, plan, slices, warnings } = wallPieces(walls, types, (w) => wallHeights(doc, w), (w) => planCutHeight(doc, w));
  const placed = deriveOpenings([...doc.openings, ...extraOpenings], hostsOf(doc, walls, jointsIn(walls, types, pieces), endsIn(walls, types, pieces)), doc.openingGroups);
  const byId = new Map(walls.map((w) => [w.id, w]));
  const openings = new Map<OpeningId, OpeningSolid>();
  const cuts = new Map<WallId, OpeningCut[]>();
  for (const p of placed.placed.values()) {
    const wall = byId.get(p.opening.wallId);
    const shape = wall && shapeOf(wall, types.get(wall.wallTypeId));
    const base = wall ? wallHeights(doc, wall).bottom : 0;
    const bottom = base + p.opening.sill;
    const top = bottom + p.opening.height;
    const frame = wall && shape && typeof shape !== 'string' ? openingFrame(shape, p.start, p.end) : null;
    const st = p.opening.style;
    const looks = st && (st.leafMaterial || st.frameMaterial || st.glazing === 'frosted')
      ? {
          ...(st.leafMaterial ? { leaf: materialIn(doc.materials, st.leafMaterial) } : {}),
          ...(st.frameMaterial ? { frame: materialIn(doc.materials, st.frameMaterial) } : {}),
          ...(st.glazing === 'frosted' ? { glass: materialIn(doc.materials, 'frostedGlass') } : {}),
        }
      : undefined;
    openings.set(p.opening.id, { ...p, frame, bottom, top, ...(looks ? { looks } : {}) });
    // One that does not fit in its wall cuts nothing: it would open the wall past its end and undo the
    // joint there. It is drawn with its warning until it is fixed.
    if (frame && wall && !p.warnings.includes('openingOutside')) cuts.set(wall.id, [...(cuts.get(wall.id) ?? []), { region: frame.region, bottom, top }]);
  }
  // An opening over another wall's joint (a wall meeting its host inside the opening's span): the
  // other wall's pieces touch the opening across the host's thickness, a hair beyond its faces.
  const jointWarnings: OpeningWarning[] = [];
  for (const [id, o] of openings) {
    const host = o.frame && byId.get(o.opening.wallId);
    if (!o.frame || !host || o.warnings.includes('openingOutside')) continue;
    const f = o.frame;
    const at = (p: Point2, offset: number) => add(p, scale(f.normal, offset));
    const lo = Math.min(...f.faces) - JOINT_REACH;
    const hi = Math.max(...f.faces) + JOINT_REACH;
    const span = toCounterClockwise([at(f.start, lo), at(f.end, lo), at(f.end, hi), at(f.start, hi)]);
    const touched = walls.some(
      (w) => w.id !== host.id && w.levelId === host.levelId && (pieces.get(w.id) ?? []).some((p) => overlapArea(p.polygon, span) > AREA_EPSILON),
    );
    if (!touched) continue;
    openings.set(id, { ...o, valid: false, warnings: [...o.warnings, 'openingAtJoint'] });
    jointWarnings.push({ kind: 'openingAtJoint', openings: [id] });
  }
  // Two doors of a level whose leaves sweep the same floor: both warned. A door put beside another
  // could open into it, with nothing said.
  const doors = [...openings.values()].flatMap((o) => {
    const region = swingRegion(o, o.frame);
    const levelId = byId.get(o.opening.wallId)?.levelId;
    return region && levelId ? [{ id: o.opening.id, levelId, region: toCounterClockwise(region) }] : [];
  });
  for (let i = 0; i < doors.length; i++) {
    for (let j = i + 1; j < doors.length; j++) {
      const a = doors[i]!;
      const b = doors[j]!;
      if (a.levelId !== b.levelId || overlapArea(a.region, b.region) <= AREA_EPSILON) continue;
      for (const id of [a.id, b.id]) {
        const o = openings.get(id)!;
        if (!o.warnings.includes('openingSwingClash')) openings.set(id, { ...o, valid: false, warnings: [...o.warnings, 'openingSwingClash'] });
      }
      jointWarnings.push({ kind: 'openingSwingClash', openings: [a.id, b.id] });
    }
  }
  const solids = new Map<WallId, WallSolid>();
  const planPieces = new Map<WallId, Piece[]>();
  for (const wall of walls) planPieces.set(wall.id, cutPlan(pieces.get(wall.id) ?? [], cuts.get(wall.id) ?? []));
  // Seams per level: walls on two levels can lie over each other in plan without meeting. Only cut
  // walls have them: a wall only seen is drawn as its outline.
  const seams = new Map<WallId, Seam[]>();
  for (const levelId of new Set(walls.map((w) => w.levelId))) {
    const list = walls
      .filter((w) => w.levelId === levelId && plan.get(w.id) === 'cut')
      .flatMap((w) => {
        const layers = types.get(w.wallTypeId)?.layers ?? [];
        // A finish is one kind of layer on either face: a wall drawn the other way from its neighbour in
        // line has its finish1 where the neighbour's finish2 is, the same plaster, and no line between.
        const kind = (k: number) => (layers[k]?.function === 'finish2' ? 'finish1' : layers[k]?.function);
        return (planPieces.get(w.id) ?? []).map((p) => ({ wallId: w.id, polygon: p.polygon, key: `${kind(p.layerIndex)}|${layers[p.layerIndex]?.materialId}` }));
      });
    for (const [id, s] of layerSeams(list)) seams.set(id, s);
  }
  for (const wall of walls) {
    const { bottom, top } = wallHeights(doc, wall);
    const mine = cuts.get(wall.id) ?? [];
    const layers = types.get(wall.wallTypeId)?.layers ?? [];
    const cut = (slices.get(wall.id) ?? []).flatMap((sl) => cutSolid(sl.pieces, sl.bottom, sl.top, mine));
    // Under the roof: each block cut by the roof's faces, its top on their slope (under-roof.ts).
    const covers = wallTop(doc, wall).kind === 'roof' ? roofCoversOf(doc, wall.levelId) : [];
    const level = levelOf(doc, wall.levelId);
    const bare = level ? level.elevation + level.height : top;
    const blocks = covers.length > 0 ? cut.flatMap((b) => blocksUnder(b, covers, bare)) : cut;
    const materials = layers.map((l) => materialIn(doc.materials, l.materialId));
    solids.set(wall.id, { wall, pieces: planPieces.get(wall.id)!, plan: plan.get(wall.id)!, blocks, bottom, top, layers, seams: seams.get(wall.id) ?? [], materials });
  }
  // Rooms see the walls before doors and windows are cut: a door does not open a room.
  const piecesByLevel = new Map<string, P[][]>();
  for (const wall of doc.walls) {
    const list = piecesByLevel.get(wall.levelId) ?? [];
    for (const piece of pieces.get(wall.id) ?? []) list.push([...piece.polygon]);
    piecesByLevel.set(wall.levelId, list);
  }
  // Separators bound rooms as walls of no thickness (elements/separator): the rooms and the spaces a room can go in.
  const roomPieces = new Map(piecesByLevel);
  for (const sep of doc.separators) roomPieces.set(sep.levelId, [...(roomPieces.get(sep.levelId) ?? []), separatorStrip(sep)]);
  const roomResult = deriveRooms(doc.rooms, roomPieces);
  const found = new Map<string, P[][]>();
  const spaces = (levelId: string): P[][] => {
    if (!found.has(levelId)) found.set(levelId, spacesOf(roomPieces.get(levelId) ?? []));
    return found.get(levelId)!;
  };
  const base = { solids, warnings, openings, openingWarnings: [...placed.warnings, ...jointWarnings], rooms: roomResult.solids, roomWarnings: roomResult.warnings, spaces, levelPieces: piecesByLevel };
  // The registry's kinds last: a dimension is placed from the walls and doors.
  return { ...base, kinds: deriveKinds(doc, base) };
}

/** A height range of a wall, and its plan pieces there: joined only with the walls standing over all of it. */
interface WallSlice {
  readonly bottom: number;
  readonly top: number;
  readonly pieces: readonly Piece[];
}

/**
 * The joined pieces of every wall, by height (spec §7.5). Walls join only within their level: one
 * level's walls never cut, notch or warn about another's. On a level, the walls' bases and tops cut
 * the height into ranges, and each range is joined with only the walls standing over it, so a wall
 * past the top of the one it meets ends there as if alone, and walls whose heights do not overlap do
 * not join (§10). A wall's consecutive ranges with the same pieces are one slice. In plan a wall shows
 * its slice at the cut height (`cutOf`, absolute) when it crosses it, and otherwise the slice nearest
 * to it: its top one below the cut, its lowest above.
 */
function wallPieces(
  walls: readonly DocWall[],
  types: ReadonlyMap<string, WallType>,
  heightOf: (w: DocWall) => { bottom: number; top: number },
  cutOf: (w: DocWall) => number,
): { pieces: Map<WallId, readonly Piece[]>; plan: Map<WallId, PlanCut>; slices: Map<WallId, WallSlice[]>; warnings: JoinWarning[] } {
  const byLevel = new Map<string, DocWall[]>();
  for (const w of walls) byLevel.set(w.levelId, [...(byLevel.get(w.levelId) ?? []), w]);
  const slices = new Map<WallId, WallSlice[]>();
  const warnings = new Map<string, JoinWarning>();
  for (const list of byLevel.values()) {
    const range = new Map(list.map((w) => [w.id, heightOf(w)]));
    const zs: number[] = [];
    for (const z of [...range.values()].flatMap((r) => [r.bottom, r.top]).sort((a, b) => a - b)) {
      if (zs.length === 0 || z > zs[zs.length - 1]! + POINT_TOLERANCE) zs.push(z);
    }
    for (let k = 0; k + 1 < zs.length; k++) {
      const z0 = zs[k]!;
      const z1 = zs[k + 1]!;
      const present = list.filter((w) => range.get(w.id)!.bottom <= z0 + POINT_TOLERANCE && range.get(w.id)!.top >= z1 - POINT_TOLERANCE);
      if (present.length === 0) continue;
      const g = computeWallGeometry(present, types);
      // The same problem at several heights is one warning.
      for (const w of g.warnings) warnings.set(JSON.stringify(w), w);
      for (const w of present) {
        const pieces = g.pieces.get(w.id) ?? [];
        const own = slices.get(w.id) ?? [];
        const last = own[own.length - 1];
        if (last && JSON.stringify(last.pieces) === JSON.stringify(pieces)) own[own.length - 1] = { ...last, top: z1 };
        else own.push({ bottom: z0, top: z1, pieces });
        slices.set(w.id, own);
      }
    }
  }
  const pieces = new Map<WallId, readonly Piece[]>();
  const plan = new Map<WallId, PlanCut>();
  for (const w of walls) {
    const { bottom, top } = heightOf(w);
    const z = cutOf(w);
    // Ending or starting at the cut height is not crossing it.
    const kind: PlanCut = bottom < z - POINT_TOLERANCE && top > z + POINT_TOLERANCE ? 'cut' : top <= z + POINT_TOLERANCE ? 'below' : 'above';
    const own = slices.get(w.id) ?? [];
    const shown = kind === 'cut' ? own.find((sl) => sl.bottom <= z && sl.top > z) : kind === 'below' ? own[own.length - 1] : own[0];
    // A wall with no height stands in no range: in plan, its pieces alone, and nothing in 3D.
    pieces.set(w.id, shown ? shown.pieces : (computeWallGeometry([w], types).pieces.get(w.id) ?? []));
    plan.set(w.id, kind);
  }
  return { pieces, plan, slices, warnings: [...warnings.values()] };
}

/**
 * Where other walls meet each straight wall inside its length (a T or an X): the stations along its
 * reference line that their pieces cover within its faces (a hair beyond, as for an opening over a
 * joint). Corners at the wall's ends are not inside it.
 */
function jointsIn(
  walls: readonly DocWall[],
  types: ReadonlyMap<string, WallType>,
  pieces: ReadonlyMap<WallId, readonly Piece[]>,
): Map<WallId, Map<WallId, { lo: number; hi: number }>> {
  const out = new Map<WallId, Map<WallId, { lo: number; hi: number }>>();
  for (const host of walls) {
    if (host.bulge) continue;
    const shape = shapeOf(host, types.get(host.wallTypeId));
    if (typeof shape === 'string') continue;
    const n = wallNormal(shape);
    const [f0, f1] = faceOffsets(shape);
    const band = [
      halfPlaneThrough(add(shape.start, scale(n, f0 - JOINT_REACH)), n),
      halfPlaneThrough(add(shape.start, scale(n, f1 + JOINT_REACH)), scale(n, -1)),
    ];
    const length = wallLength(shape);
    const mine = new Map<WallId, { lo: number; hi: number }>();
    for (const other of walls) {
      if (other.id === host.id || other.levelId !== host.levelId) continue;
      const stations = (pieces.get(other.id) ?? [])
        .map((p) => band.reduce<ConvexPolygon>((poly, h) => (poly.length > 0 ? clipHalfPlane(poly, h) : poly), p.polygon))
        .filter((poly) => poly.length > 0 && area(poly) > AREA_EPSILON)
        .flatMap((poly) => poly.map((v) => stationOf(shape, v)));
      if (stations.length === 0) continue;
      const lo = Math.min(...stations);
      const hi = Math.max(...stations);
      if (lo > POINT_TOLERANCE && hi < length - POINT_TOLERANCE) mine.set(other.id, { lo, hi });
    }
    if (mine.size > 0) out.set(host.id, mine);
  }
  return out;
}

/** The absolute height where the plan of the wall's level cuts it. */
function planCutHeight(doc: Doc, wall: DocWall): number {
  const level = levelOf(doc, wall.levelId);
  return (level?.elevation ?? 0) + (level ? cutHeightOf(level) : CUT_HEIGHT);
}

/**
 * Each straight wall's length clear of the walls met at its ends (a corner, an end against another
 * wall): from the inner face of the one at its start to that of the one at its end, along its
 * reference line. A distributed group's spaces at the wall's ends are measured to these faces.
 */
function endsIn(
  walls: readonly DocWall[],
  types: ReadonlyMap<string, WallType>,
  pieces: ReadonlyMap<WallId, readonly Piece[]>,
): Map<WallId, { from: number; to: number }> {
  const out = new Map<WallId, { from: number; to: number }>();
  for (const host of walls) {
    if (host.bulge) continue;
    const shape = shapeOf(host, types.get(host.wallTypeId));
    if (typeof shape === 'string') continue;
    const n = wallNormal(shape);
    const [f0, f1] = faceOffsets(shape);
    const band = [
      halfPlaneThrough(add(shape.start, scale(n, f0 - JOINT_REACH)), n),
      halfPlaneThrough(add(shape.start, scale(n, f1 + JOINT_REACH)), scale(n, -1)),
    ];
    const length = wallLength(shape);
    let from = 0;
    let to = length;
    for (const other of walls) {
      if (other.id === host.id || other.levelId !== host.levelId) continue;
      const stations = (pieces.get(other.id) ?? [])
        .map((p) => band.reduce<ConvexPolygon>((poly, h) => (poly.length > 0 ? clipHalfPlane(poly, h) : poly), p.polygon))
        .filter((poly) => poly.length > 0 && area(poly) > AREA_EPSILON)
        .flatMap((poly) => poly.map((v) => stationOf(shape, v)));
      if (stations.length === 0) continue;
      const lo = Math.min(...stations);
      const hi = Math.max(...stations);
      // Over the start or the end, not inside (those are joints): what it covers of the host's length.
      if (lo <= POINT_TOLERANCE && hi < length / 2) from = Math.max(from, hi);
      else if (hi >= length - POINT_TOLERANCE && lo > length / 2) to = Math.min(to, lo);
    }
    if (from > 0 || to < length) out.set(host.id, { from, to });
  }
  return out;
}

/** Hosts for placing openings, with the joints inside each (which bound a distributed group's stretch). */
export function hostsIn(doc: Doc, walls: readonly DocWall[] = doc.walls) {
  const types = new Map(doc.wallTypes.map((t) => [t.id, t]));
  const pieces = wallPieces(walls, types, (w) => wallHeights(doc, w), (w) => planCutHeight(doc, w)).pieces;
  return hostsOf(doc, walls, jointsIn(walls, types, pieces), endsIn(walls, types, pieces));
}

/** The opening's outline in plan: the jambs across the wall's thickness. */
export function openingOutline(o: OpeningSolid): Point2[] {
  const f = o.frame;
  if (!f) return [];
  const at = (p: Point2, k: number) => add(p, scale(f.normal, f.faces[k]!));
  return [at(f.start, 0), at(f.end, 0), at(f.end, 1), at(f.start, 1)];
}

/** The opening whose outline contains p, last placed first. */
/**
 * The door or window under p: inside its outline in the wall, or within `reach` (m) of it or of its
 * symbol (a door's leaf and swing, a window's panes), the nearest winning. Its symbol is what the plan
 * shows of it: a click on a door's leaf took the room behind it.
 */
export function openingAt(g: DerivedGeometry, p: Point2, reach = 0): OpeningId | null {
  let best: OpeningId | null = null;
  let bestD = reach;
  for (const o of [...g.openings.values()].reverse()) {
    const outline = openingOutline(o);
    if (insidePolygon(outline, p)) return o.opening.id;
    if (reach <= 0) continue;
    const d = Math.min(polygonDistance(outline, p), ...symbolLines(o, o.frame).map((line) => polylineDistance(line, p)));
    if (d <= bestD) {
      best = o.opening.id;
      bestD = d;
    }
  }
  return best;
}

// model/vector is the one copy of these; re-exported for the render and tools layers.
export { polygonDistance, insidePolygon };

/**
 * The wall whose drawn pieces contain p, topmost (last drawn) first; else the one whose pieces come
 * nearest p within `reach` (m): a wall 15 cm thick is a few pixels wide, and missing it by one took
 * the room beside it.
 */
export function wallAt(g: DerivedGeometry, p: Point2, ids?: ReadonlySet<WallId>, reach = 0): WallId | null {
  const list = [...g.solids.values()].reverse().filter((s) => !ids || ids.has(s.wall.id));
  for (const s of list) if (s.pieces.some((piece) => insidePolygon(piece.polygon, p))) return s.wall.id;
  let best: WallId | null = null;
  let bestD = reach;
  for (const s of reach > 0 ? list : []) {
    const d = Math.min(...s.pieces.map((piece) => polygonDistance(piece.polygon, p)));
    if (d <= bestD) {
      best = s.wall.id;
      bestD = d;
    }
  }
  return best;
}

/** Bounding box of the drawn pieces and openings, or null when there is nothing. */
export function boundsOf(g: DerivedGeometry, ids?: ReadonlySet<WallId>): { min: Point2; max: Point2 } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  // Rooms and floors: their outlines.
  const outlines = [
    ...[...g.rooms.values()].filter((r) => !ids || ids.has(r.room.id)).map((r) => r.outline),
    // A guide has no ends: its point only.
    // A guide has no ends: its point only. A door with its swing (contract.ts: extent).
    ...[...eachSolid(g.kinds)]
      .filter((x) => !ids || ids.has(x.id))
      .flatMap((x) => (x.kind.endless ? [x.kind.outlines(x.solid)[0]!.slice(0, 1)] : x.kind.extent ? [x.kind.extent(x.solid)] : x.kind.outlines(x.solid))),
  ];
  for (const v of outlines.flat()) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  return minX === Infinity ? null : { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

/** Categories of elements the project browser can hide from view (not from the document). Guides have no geometry: the plan and the snaps leave them out themselves. */
export type Category = 'walls' | 'openings' | 'rooms' | 'floors' | 'objects' | 'guides';

/** The geometry without the hidden categories; the same object when nothing is hidden. */
/**
 * Elements hidden or isolated for a while (Revit's Temporary Hide/Isolate, HH and HI): the document keeps
 * them, only the views leave them out. Hidden: those elements go, and the doors and windows of a hidden
 * wall with it. Isolated: only those stay, and the doors and windows of an isolated wall with it.
 */
export interface TemporaryView {
  readonly mode: 'hide' | 'isolate';
  readonly ids: ReadonlySet<string>;
}

/** Whether an element shows in a temporary view (its doors and windows go with a wall: applyTemporary). */
export const shownFor = (temp: TemporaryView | null, id: string): boolean => !temp || (temp.mode === 'hide' ? !temp.ids.has(id) : temp.ids.has(id));

export function applyTemporary(g: DerivedGeometry, temp: TemporaryView | null): DerivedGeometry {
  if (!temp) return g;
  const keep = (id: string) => shownFor(temp, id);
  const solids = new Map([...g.solids].filter(([id]) => keep(id)));
  const openings = new Map(
    [...g.openings].filter(([id, o]) => (temp.mode === 'hide' ? keep(id) && solids.has(o.opening.wallId) : keep(id) || solids.has(o.opening.wallId))),
  );
  return {
    ...g,
    solids,
    openings,
    rooms: new Map([...g.rooms].filter(([id]) => keep(id))),
    // One held by a wall (a door) goes with it hidden, and stays with it isolated.
    kinds: filterKinds(g.kinds, (k, x) => {
      const e = k.element(x) as { readonly id: string };
      const held = k.holders?.(e) ?? [];
      return temp.mode === 'hide' ? keep(e.id) && held.every(keep) : keep(e.id) || held.some(keep);
    }),
  };
}

export function hideCategories(g: DerivedGeometry, hidden: ReadonlySet<Category>): DerivedGeometry {
  if (hidden.size === 0) return g;
  return {
    ...g,
    solids: hidden.has('walls') ? new Map() : g.solids,
    openings: hidden.has('openings') ? new Map() : g.openings,
    rooms: hidden.has('rooms') ? new Map() : g.rooms,
    // Each kind with its category (structure with the walls, stairs and guardrails with the floors).
    kinds: filterKinds(g.kinds, (k) => k.category === null || !hidden.has(k.category)),
  };
}
