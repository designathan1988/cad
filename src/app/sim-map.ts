// A simulation as a colour map over the plan (docs/plano-de-escopo.md, phase 14: "resultados como mapas
// de cor"): the Wi-Fi signal cell by cell (sim/wifi.ts), or each room in the colour of its daylight
// factor or of its hours of sun on the June solstice. A grid of colours the plan draws under the walls
// (render/plan-view.ts: heat); kept while the document, the level and the map are the same.

import type { Doc } from './document';
import type { DerivedGeometry } from './geometry';
import { DEFAULT_SITE } from './sun';
import { insideRing } from '../elements/room/derive';
import { daylightOf, roomSun } from '../sim/exposure';
import { DEFAULT_SIM } from '../sim/settings';
import { wifiColor, wifiGrid } from '../sim/wifi';

export type SimMap = 'none' | 'wifi' | 'daylight' | 'sun';
export const SIM_MAPS: readonly SimMap[] = ['none', 'wifi', 'daylight', 'sun'];

export interface HeatLayer {
  /** The top left corner of the first cell, in plan. */
  readonly origin: { readonly x: number; readonly y: number };
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  /** RGBA, row by row from the top. */
  readonly rgba: Uint8ClampedArray;
}

type Rgba = [number, number, number, number];

/** A value between stops of colour. */
function ramp(v: number, stops: readonly [number, readonly [number, number, number]][]): Rgba {
  if (v <= stops[0]![0]) return [...stops[0]![1], 140];
  for (let i = 1; i < stops.length; i++) {
    const [v1, c1] = stops[i]!;
    const [v0, c0] = stops[i - 1]!;
    if (v <= v1) {
      const k = (v - v0) / (v1 - v0);
      return [Math.round(c0[0] + (c1[0] - c0[0]) * k), Math.round(c0[1] + (c1[1] - c0[1]) * k), Math.round(c0[2] + (c1[2] - c0[2]) * k), 140];
    }
  }
  return [...stops[stops.length - 1]![1], 140];
}

/** The daylight factor (%): red under 1, orange to 2, green over. */
export const daylightColor = (f: number): Rgba => ramp(f, [[0, [220, 38, 38]], [1, [249, 115, 22]], [2, [22, 163, 74]], [5, [21, 128, 61]]]);
/** Hours of sun: grey-blue with none, yellow with six or more. */
export const sunColor = (h: number): Rgba => ramp(h, [[0, [100, 116, 139]], [2, [147, 197, 253]], [4, [253, 224, 71]], [6, [234, 179, 8]]]);

let kept: { doc: Doc; levelId: string; map: SimMap; layer: HeatLayer | null } | null = null;

export function simHeat(doc: Doc, g: DerivedGeometry, map: SimMap, levelId: string): HeatLayer | null {
  if (map === 'none') return null;
  if (kept && kept.doc === doc && kept.levelId === levelId && kept.map === map) return kept.layer;
  const layer = build(doc, g, map, levelId);
  kept = { doc, levelId, map, layer };
  return layer;
}

function build(doc: Doc, g: DerivedGeometry, map: SimMap, levelId: string): HeatLayer | null {
  if (map === 'wifi') {
    const grid = wifiGrid(doc, g, doc.simulation ?? DEFAULT_SIM, levelId);
    if (!grid || !doc.mepPoints.some((p) => p.kind === 'accessPoint')) return null;
    const rgba = new Uint8ClampedArray(grid.cols * grid.rows * 4);
    grid.values.forEach((v, i) => rgba.set(wifiColor(v), i * 4));
    return { origin: grid.origin, cell: grid.cell, cols: grid.cols, rows: grid.rows, rgba };
  }
  // A room's value painted over its cells.
  const rooms = [...g.rooms.values()].filter((r) => r.room.levelId === levelId && r.enclosed);
  if (rooms.length === 0) return null;
  const value = new Map<string, Rgba>(
    map === 'daylight'
      ? daylightOf(doc, g).map((d) => [d.roomId, daylightColor(d.factor)])
      : roomSun(doc, g, doc.site ?? DEFAULT_SITE).map((r) => [r.roomId, sunColor(r.hours[0] ?? 0)]),
  );
  const pts = rooms.flatMap((r) => r.outline);
  const cell = 0.2;
  const x0 = Math.min(...pts.map((p) => p.x));
  const y1 = Math.max(...pts.map((p) => p.y));
  const cols = Math.ceil((Math.max(...pts.map((p) => p.x)) - x0) / cell);
  const rows = Math.ceil((y1 - Math.min(...pts.map((p) => p.y))) / cell);
  const rgba = new Uint8ClampedArray(cols * rows * 4);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p = { x: x0 + (c + 0.5) * cell, y: y1 - (r + 0.5) * cell };
      const room = rooms.find((x) => insideRing(x.outline, p));
      const colour = room && value.get(room.room.id);
      if (colour) rgba.set(colour, (r * cols + c) * 4);
    }
  return { origin: { x: x0, y: y1 }, cell, cols, rows, rgba };
}
