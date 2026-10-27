// Wi-Fi over the plan (docs/plano-de-escopo.md, phase 14: "mapa de calor do sinal em cada pavimento"):
// the signal from the access points (elements/mep: accessPoint) at every quarter metre of a level, a
// metre above its floor. ITU-R P.1238's indoor model, L = 20·log f + N·log d + Pf(n) − 28, with N = 20
// (free space) and each wall crossed counted by its material (sim/physics.ts: the loss of the layer
// that takes the most; a door or a window where the way passes one), the multi-wall way; floors by
// P.1238 (4 dB a floor at 2.4 GHz in a residence, 16 at 5 GHz, adopted from its office line). Pure.

import type { Doc } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { materialIn } from '../elements/material/schema';
import { insideRing } from '../elements/room/derive';
import { distance, type Point2 } from '../core/vector';
import { physicsOf } from './physics';
import type { SimSettings } from './settings';

/** dBm thresholds: good for video calls, usable, weak. */
export const GOOD = -67;
export const USABLE = -75;
export const WEAK = -85;

/** A receiver's height above its floor (m). */
const RECEIVER = 1.0;
/** dB of a wall whose materials have no physics (adopted), a door's leaf and a window's glass. */
const UNKNOWN_WALL = 5;
const DOOR = 4;
const WINDOW = 3;

export interface WifiGrid {
  readonly levelId: string;
  /** The corner of the first cell (lowest x, highest y: the first row is the top of the plan). */
  readonly origin: Point2;
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  /** dBm, row by row from the top; -Infinity with no access point. */
  readonly values: Float64Array;
}

const freq = (s: SimSettings) => (s.wifi.band === '5' ? 5200 : 2440);
const bandFactor = (s: SimSettings) => (s.wifi.band === '5' ? 1.5 : 1);
const floorLoss = (s: SimSettings, n: number) => (s.wifi.band === '5' ? 16 : 4) * n;

interface Barrier {
  readonly a: Point2;
  readonly b: Point2;
  readonly loss: number;
  /** Its doors and windows: stations along a → b (m) and their loss. */
  readonly holes: readonly { readonly from: number; readonly to: number; readonly loss: number }[];
}

function barriers(doc: Doc, g: DerivedGeometry, levelId: string, s: SimSettings): Barrier[] {
  return doc.walls
    .filter((w) => w.levelId === levelId && !w.bulge && g.solids.has(w.id))
    .map((w) => {
      const type = doc.wallTypes.find((t) => t.id === w.wallTypeId);
      const losses = (type?.layers ?? []).map((l) => physicsOf(materialIn(doc.materials, l.materialId))?.wifiLoss ?? UNKNOWN_WALL);
      const holes = [...g.openings.values()]
        .filter((o) => o.opening.wallId === w.id && o.valid)
        .map((o) => ({ from: o.start, to: o.end, loss: (o.opening.kind === 'door' ? DOOR : WINDOW) * bandFactor(s) }));
      return { a: w.start, b: w.end, loss: (losses.length > 0 ? Math.max(...losses) : UNKNOWN_WALL) * bandFactor(s), holes };
    });
}

/** What the walls between p and q take (dB): each one crossed once. */
function wallLoss(walls: readonly Barrier[], p: Point2, q: Point2): number {
  let total = 0;
  const r = { x: q.x - p.x, y: q.y - p.y };
  for (const w of walls) {
    const d = { x: w.b.x - w.a.x, y: w.b.y - w.a.y };
    const den = r.x * d.y - r.y * d.x;
    if (Math.abs(den) < 1e-12) continue;
    const o = { x: w.a.x - p.x, y: w.a.y - p.y };
    const t = (o.x * d.y - o.y * d.x) / den;
    const u = (o.x * r.y - o.y * r.x) / den;
    if (t <= 0 || t >= 1 || u < 0 || u > 1) continue;
    const station = u * Math.hypot(d.x, d.y);
    const hole = w.holes.find((h) => station >= h.from && station <= h.to);
    total += hole ? hole.loss : w.loss;
  }
  return total;
}

/** The signal (dBm) at a point of a level from one access point. */
export function signalAt(doc: Doc, g: DerivedGeometry, s: SimSettings, ap: { at: Point2; z: number; levelId: string }, p: Point2, levelId: string, walls?: readonly Barrier[]): number {
  const level = doc.levels.find((l) => l.id === levelId);
  const z = (level?.elevation ?? 0) + RECEIVER;
  const d = Math.max(1, Math.hypot(distance(ap.at, p), ap.z - z));
  const order = (id: string) => [...doc.levels].sort((a, b) => a.elevation - b.elevation).findIndex((l) => l.id === id);
  const floors = Math.abs(order(levelId) - order(ap.levelId));
  const loss = 20 * Math.log10(freq(s)) + 20 * Math.log10(d) - 28 + floorLoss(s, floors) + wallLoss(walls ?? barriers(doc, g, levelId, s), ap.at, p);
  return s.wifi.power - loss;
}

/** The access points, with their absolute height. */
export function accessPoints(doc: Doc): { id: string; at: Point2; z: number; levelId: string }[] {
  return doc.mepPoints.filter((p) => p.kind === 'accessPoint').map((p) => ({ id: p.id, at: p.at, z: (doc.levels.find((l) => l.id === p.levelId)?.elevation ?? 0) + p.height, levelId: p.levelId }));
}

/** The level's map: over its rooms with a metre around, the best access point's signal at each cell. */
export function wifiGrid(doc: Doc, g: DerivedGeometry, s: SimSettings, levelId: string, cell = 0.25): WifiGrid | null {
  const rooms = [...g.rooms.values()].filter((r) => r.room.levelId === levelId && r.enclosed);
  const pts = rooms.flatMap((r) => r.outline);
  if (pts.length === 0) return null;
  const x0 = Math.min(...pts.map((p) => p.x)) - 1;
  const x1 = Math.max(...pts.map((p) => p.x)) + 1;
  const y0 = Math.min(...pts.map((p) => p.y)) - 1;
  const y1 = Math.max(...pts.map((p) => p.y)) + 1;
  const cols = Math.max(1, Math.ceil((x1 - x0) / cell));
  const rows = Math.max(1, Math.ceil((y1 - y0) / cell));
  const values = new Float64Array(cols * rows).fill(-Infinity);
  const aps = accessPoints(doc);
  const walls = barriers(doc, g, levelId, s);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p = { x: x0 + (c + 0.5) * cell, y: y1 - (r + 0.5) * cell };
      let best = -Infinity;
      for (const ap of aps) best = Math.max(best, signalAt(doc, g, s, ap, p, levelId, walls));
      values[r * cols + c] = best;
    }
  return { levelId, origin: { x: x0, y: y1 }, cell, cols, rows, values };
}

export interface RoomWifi {
  readonly roomId: string;
  /** dBm: the weakest and the mean over its cells. */
  readonly min: number;
  readonly mean: number;
  /** Share of its cells at GOOD or better. */
  readonly covered: number;
}

/** Each room's signal, from its level's map. */
export function roomWifi(doc: Doc, g: DerivedGeometry, s: SimSettings): RoomWifi[] {
  const out: RoomWifi[] = [];
  for (const level of doc.levels) {
    const grid = wifiGrid(doc, g, s, level.id);
    if (!grid) continue;
    for (const r of g.rooms.values()) {
      if (r.room.levelId !== level.id || !r.enclosed) continue;
      const v: number[] = [];
      for (let i = 0; i < grid.rows; i++)
        for (let j = 0; j < grid.cols; j++) {
          const p = { x: grid.origin.x + (j + 0.5) * grid.cell, y: grid.origin.y - (i + 0.5) * grid.cell };
          if (insideRing(r.outline, p)) v.push(grid.values[i * grid.cols + j]!);
        }
      if (v.length === 0) continue;
      out.push({ roomId: r.room.id, min: Math.min(...v), mean: v.reduce((a, b) => a + b, 0) / v.length, covered: v.filter((x) => x >= GOOD).length / v.length });
    }
  }
  return out;
}

/** A signal's colour on the map: green (good) through yellow and orange to red (weak), none without one. */
export function wifiColor(dbm: number): [number, number, number, number] {
  if (!Number.isFinite(dbm)) return [0, 0, 0, 0];
  const stops: [number, [number, number, number]][] = [
    [-55, [22, 163, 74]],
    [GOOD, [132, 204, 22]],
    [USABLE, [234, 179, 8]],
    [-80, [249, 115, 22]],
    [WEAK, [220, 38, 38]],
  ];
  if (dbm >= stops[0]![0]) return [...stops[0]![1], 150];
  for (let i = 1; i < stops.length; i++) {
    const [v1, c1] = stops[i]!;
    const [v0, c0] = stops[i - 1]!;
    if (dbm >= v1) {
      const k = (v0 - dbm) / (v0 - v1);
      return [Math.round(c0[0] + (c1[0] - c0[0]) * k), Math.round(c0[1] + (c1[1] - c0[1]) * k), Math.round(c0[2] + (c1[2] - c0[2]) * k), 150];
    }
  }
  return [...stops[stops.length - 1]![1], 150];
}
