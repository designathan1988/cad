// Construction quantities out of the layers (docs/plano-de-escopo.md, diferenciais, 6: "modulação de
// alvenaria e quantitativo de obra saindo das camadas: blocos, argamassa, reboco por face, revestimento
// por peça, descontando vãos"). Each wall layer over the wall's net area (its doors' and windows'
// holes taken off, as the walls schedule takes them): its area and volume; its pieces where its
// material is laid in pieces (its surface pattern, pattern.ts: a brick's or a tile's size and joint,
// the same the 3D shows), and for a masonry layer the mortar of its joints. The rooms' finishes: the
// floor's and the ceiling's area, the walls' as the room's perimeter by its height less its doors and
// windows. Pieces are whole ones, counted per wall face or per room; no allowance for waste is added.
// Lengths are the walls' reference lengths, as in the walls schedule: the corner of two joined walls
// is counted as far as their lines meet. Pure.

import { add, scale } from '../core/vector';
import { referenceLength } from '../elements/opening/derive';
import { materialIn, type Material } from '../elements/material/schema';
import { insideRing } from '../elements/room/derive';
import type { Room } from '../elements/room/schema';
import { type Doc, type DocWall, levelOf, wallHeights } from './document';
import type { DerivedGeometry } from './geometry';

/** The enclosed rooms on the two sides of a door or window, just off each face (null: outside). */
export function roomsBeside(g: DerivedGeometry, id: string, levelId: string): readonly [Room | null, Room | null] {
  const frame = g.openings.get(id)?.frame;
  if (!frame) return [null, null];
  const middle = scale(add(frame.start, frame.end), 0.5);
  // Just off each face, 5 cm out: in the room on that side, if one is there.
  const at = (offset: number) => {
    const p = add(middle, scale(frame.normal, offset));
    return [...g.rooms.values()].find((r) => r.room.levelId === levelId && r.enclosed && insideRing(r.outline, p))?.room ?? null;
  };
  return [at(frame.faces[0] - 0.05), at(frame.faces[1] + 0.05)];
}

/** One piece and its joint, along the surface and up it (m): its module is the piece and one joint. */
export interface PieceSize {
  readonly length: number;
  readonly width: number;
  readonly joint: number;
}

/** What a material is laid in, if in pieces: its surface pattern's piece (bricks, tiles, boards). */
export function pieceOf(m: Material): PieceSize | null {
  const p = m.pattern;
  return p ? { length: p.length, width: p.width, joint: p.joint } : null;
}

/** Whole pieces to cover an area, each with its joint. */
export const piecesFor = (area: number, p: PieceSize): number => (area <= 1e-9 ? 0 : Math.ceil(area / ((p.length + p.joint) * (p.width + p.joint)) - 1e-9));

/** The mortar of a masonry layer's joints (m³): its volume less its pieces'. */
export const mortarFor = (area: number, thickness: number, p: PieceSize): number =>
  area * thickness * (1 - (p.length * p.width) / ((p.length + p.joint) * (p.width + p.joint)));

/** A wall's height (as the walls schedule reads it) and its net area, its holes taken off. */
export function wallAreas(doc: Doc, g: DerivedGeometry, w: DocWall): { length: number; height: number; gross: number; holes: number; net: number } {
  const length = referenceLength(w);
  const { bottom, top } = wallHeights(doc, w);
  const height = Math.max(0, top - bottom);
  // An opening's hole: as wide as it is, from its sill up to its head or the wall's top.
  const holes = doc.openings.filter((o) => o.wallId === w.id && g.openings.get(o.id)?.valid).reduce((s, o) => s + o.width * Math.max(0, Math.min(o.height, height - o.sill)), 0);
  const gross = length * height;
  return { length, height, gross, holes, net: Math.max(0, gross - holes) };
}

/** Where a layer is: on the exterior face, on the interior one, or between them. */
export type LayerPlace = 'exterior' | 'interior' | 'inner';

export interface LayerQuantity {
  readonly wallId: string;
  readonly index: number;
  readonly place: LayerPlace;
  readonly function: string;
  readonly materialId: string;
  readonly thickness: number;
  /** m², the wall's net area. */
  readonly area: number;
  /** m³. */
  readonly volume: number;
  /** Whole pieces, where the material is laid in pieces. */
  readonly pieces: number | null;
  /** The mortar of its joints (m³), for a masonry layer: a structure or substrate one laid in bricks. */
  readonly mortar: number | null;
}

/** Every wall's layers with their quantities: the walls to be built (one existing or to be demolished is not built). */
export function layerQuantities(doc: Doc, g: DerivedGeometry): LayerQuantity[] {
  const out: LayerQuantity[] = [];
  for (const w of doc.walls) {
    if (w.phase) continue;
    const type = doc.wallTypes.find((t) => t.id === w.wallTypeId);
    if (!type) continue;
    const { net } = wallAreas(doc, g, w);
    const last = type.layers.length - 1;
    type.layers.forEach((l, i) => {
      const m = materialIn(doc.materials, l.materialId);
      const piece = pieceOf(m);
      const masonry = (l.function === 'structure' || l.function === 'substrate') && m.pattern?.kind === 'brick';
      // A finish on a face; the one layer of a single-layer wall is its body, not a face.
      const place: LayerPlace = last > 0 && i === 0 && l.function.startsWith('finish') ? 'exterior' : last > 0 && i === last && l.function.startsWith('finish') ? 'interior' : 'inner';
      out.push({
        wallId: w.id,
        index: i,
        place,
        function: l.function,
        materialId: l.materialId,
        thickness: l.thickness,
        area: net,
        volume: net * l.thickness,
        pieces: piece ? piecesFor(net, piece) : null,
        mortar: masonry && piece ? mortarFor(net, l.thickness, piece) : null,
      });
    });
  }
  return out;
}

/** The walls to be demolished in a renovation: each one's type, net area and volume (its type's thickness). */
export interface DemolitionQuantity {
  readonly wallId: string;
  readonly typeId: string;
  readonly area: number;
  readonly volume: number;
}

export function demolitionQuantities(doc: Doc, g: DerivedGeometry): DemolitionQuantity[] {
  return doc.walls.flatMap((w) => {
    if (w.phase !== 'demolish') return [];
    const type = doc.wallTypes.find((t) => t.id === w.wallTypeId);
    const { net } = wallAreas(doc, g, w);
    return [{ wallId: w.id, typeId: w.wallTypeId, area: net, volume: net * (type?.layers.reduce((s, l) => s + l.thickness, 0) ?? 0) }];
  });
}

/** The rooms' finishes: floor, walls and ceiling, each with its material, area and pieces. */
export interface FinishQuantity {
  readonly roomId: string;
  readonly surface: 'floor' | 'wall' | 'ceiling';
  readonly materialId: string;
  readonly area: number;
  readonly pieces: number | null;
}

export function finishQuantities(doc: Doc, g: DerivedGeometry): FinishQuantity[] {
  // The doors and windows on each room's walls: their area off its walls' finish, once per side.
  const holesIn = new Map<string, number>();
  for (const o of doc.openings) {
    const wall = doc.walls.find((w) => w.id === o.wallId);
    if (!wall || !g.openings.get(o.id)?.valid) continue;
    const sides = roomsBeside(g, o.id, wall.levelId);
    for (const r of new Set(sides.flatMap((x) => (x ? [x.id] : [])))) holesIn.set(r, (holesIn.get(r) ?? 0) + o.width * o.height);
  }
  const out: FinishQuantity[] = [];
  for (const r of doc.rooms) {
    const s = g.rooms.get(r.id);
    if (!s?.enclosed || !r.finishes) continue;
    const height = r.height ?? levelOf(doc, r.levelId)?.height ?? 0;
    const areas = { floor: s.area, ceiling: s.area, wall: Math.max(0, s.perimeter * height - (holesIn.get(r.id) ?? 0)) };
    for (const surface of ['floor', 'wall', 'ceiling'] as const) {
      const id = r.finishes[surface];
      if (!id) continue;
      const piece = pieceOf(materialIn(doc.materials, id));
      out.push({ roomId: r.id, surface, materialId: id, area: areas[surface], pieces: piece ? piecesFor(areas[surface], piece) : null });
    }
  }
  return out;
}

/** A wall's masonry by its pieces: how many along it and how many courses up it, and what is left. */
export interface Modulation {
  readonly module: number;
  readonly count: number;
  /** What is left past the last whole module (m): 0 when the wall closes on the module. */
  readonly rest: number;
  readonly course: number;
  readonly courses: number;
  readonly courseRest: number;
}

/** Tolerance for a wall to close on its module: 5 mm. */
const CLOSES = 0.005;

/**
 * A wall's modulation, for its first masonry layer (a structure or substrate one laid in bricks): its
 * length and height in modules (a piece and its joint), and what is left of each; null for a wall
 * that is not masonry.
 */
export function modulation(doc: Doc, w: DocWall): Modulation | null {
  const type = doc.wallTypes.find((t) => t.id === w.wallTypeId);
  const layer = type?.layers.find((l) => (l.function === 'structure' || l.function === 'substrate') && materialIn(doc.materials, l.materialId).pattern?.kind === 'brick');
  const piece = layer ? pieceOf(materialIn(doc.materials, layer.materialId)) : null;
  if (!piece) return null;
  const split = (size: number, module: number) => {
    const n = Math.floor(size / module + CLOSES / module);
    const rest = size - n * module;
    return { n, rest: Math.abs(rest) < CLOSES ? 0 : rest };
  };
  const { bottom, top } = wallHeights(doc, w);
  const module = piece.length + piece.joint;
  const course = piece.width + piece.joint;
  const along = split(referenceLength(w), module);
  const up = split(Math.max(0, top - bottom), course);
  return { module, count: along.n, rest: along.rest, course, courses: up.n, courseRest: up.rest };
}
