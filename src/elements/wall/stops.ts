// Where the other walls meet a wall: the stations, along its reference line, of the faces of every
// wall of its level that touches or crosses it. A door is measured from these, as one measures it on
// site: from the face of the wall beside it, not from the far corner of a long wall the partitions
// run into (the tester's run of 2026-10-25: "4,05 m do fim da parede" across a bathroom wall).

import { add, dot, type Point2, scale, sub } from '../../model/vector';
import { referenceLength } from '../opening/derive';
import { faceOffsets, wallDirection, wallNormal } from './geometry/offset';
import { shapeOf } from './geometry/shape';
import type { Doc } from '../../project/doc';
import type { WallId } from './schema';

/** Below this sine the walls are taken as parallel: they run alongside, they do not meet. */
const MIN_SINE = 0.1;
/** How far past the host's face an end may stop and still be taken as touching it (m). */
const TOUCH = 0.01;

/** A stop and whose face it is: the wall meeting the host, and which of its two faces (0, 1). */
export interface Stop {
  readonly at: number;
  readonly wallId: WallId;
  readonly face: number;
}

/** The stations (sorted, strictly inside the wall) where the faces of the walls meeting it cross its reference line. */
export function wallStops(doc: Doc, wallId: WallId): number[] {
  return wallStopsOf(doc, wallId).map((s) => s.at);
}

/** The stops of a wall with the faces they are (sorted by station). */
export function wallStopsOf(doc: Doc, wallId: WallId): Stop[] {
  const host = doc.walls.find((w) => w.id === wallId);
  if (!host || host.bulge) return [];
  const types = new Map(doc.wallTypes.map((x) => [x.id, x]));
  const hostShape = shapeOf(host, types.get(host.wallTypeId));
  if (typeof hostShape === 'string') return [];
  const length = referenceLength(host);
  const d = wallDirection(hostShape);
  const n = wallNormal(hostShape);
  const [h0, h1] = faceOffsets(hostShape);
  const stops: Stop[] = [];
  for (const w of doc.walls) {
    if (w.id === host.id || w.levelId !== host.levelId || w.bulge) continue;
    const shape = shapeOf(w, types.get(w.wallTypeId));
    if (typeof shape === 'string') continue;
    const u = wallDirection(shape);
    const sine = d.x * u.y - d.y * u.x;
    if (Math.abs(sine) < MIN_SINE) continue;
    const lw = dot(sub(w.end, w.start), u);
    // The other wall must reach the host's body: its run, extended by how far the host's faces lie
    // along it, takes in the line where it crosses the host's reference line.
    const along = (p: Point2): number => {
      // Where the line through p along u crosses the host's line at offset 0: the station on the host and the run on w.
      const off = dot(sub(p, host.start), n);
      const k = -off / dot(u, n);
      return dot(sub(add(p, scale(u, k)), host.start), d);
    };
    const runAt = (offset: number): number => {
      // The run on w where its reference line meets the host's line at that offset.
      const off = dot(sub(w.start, host.start), n);
      return (offset - off) / dot(u, n);
    };
    const runs = [runAt(h0), runAt(h1)];
    const lo = Math.min(...runs) - TOUCH / Math.abs(sine);
    const hi = Math.max(...runs) + TOUCH / Math.abs(sine);
    if (hi < 0 || lo > lw) continue;
    const nw = wallNormal(shape);
    faceOffsets(shape).forEach((o, face) => {
      const s = along(add(w.start, scale(nw, o)));
      if (s > 0 && s < length) stops.push({ at: s, wallId: w.id, face });
    });
  }
  return stops.sort((a, b) => a.at - b.at);
}

/** The nearest stop at or before a station (0, the wall's start, when none). */
export const stopBefore = (stops: readonly number[], at: number): number =>
  stops.reduce((best, s) => (s <= at + 1e-9 && s > best ? s : best), 0);

/** The nearest stop at or after a station (the wall's length when none). */
export const stopAfter = (stops: readonly number[], at: number, length: number): number =>
  stops.reduce((best, s) => (s >= at - 1e-9 && s < best ? s : best), length);
