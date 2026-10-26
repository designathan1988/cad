// A level's plan as DXF (ref/chat.txt:122, l.149), for any CAD program: R12 (AC1009), the version
// every reader opens, in metres, with a layer per kind of line. Read from the derived geometry, as the
// plan draws it at its cut height: the walls' faces, the lines between their layers, doors (leaf and
// swing arc) and windows, the rooms' outlines with their names and areas. Pure: text out, and the bytes
// in the code page an R12 file is read in.

import type { DerivedGeometry } from '../app/geometry';
import type { Point2 } from '../core/vector';
import type { Note } from '../elements/note/schema';
import { eachSolid, KINDS } from '../elements/registry';
import { markPoint } from '../elements/opening/marks';
import { symbolLines } from '../elements/opening/symbol';
import { insideRing } from '../elements/room/derive';
import { outerSides } from '../elements/wall/geometry/seams';

/** The layers, with AutoCAD colour numbers: what each kind of line goes on. */
export const DXF_LAYERS = [
  { name: 'A-WALL', colour: 7 }, // wall faces
  { name: 'A-WALL-PATT', colour: 8 }, // lines between a wall's layers
  { name: 'A-DOOR', colour: 2 }, // door leaves and swings
  { name: 'A-DOOR-IDEN', colour: 2 }, // door type marks
  { name: 'A-GLAZ', colour: 4 }, // window frame and glass lines
  { name: 'A-GLAZ-IDEN', colour: 4 }, // window type marks
  { name: 'A-AREA', colour: 9 }, // room outlines
  { name: 'A-AREA-IDEN', colour: 7 }, // room names and areas
  { name: 'A-ANNO-TEXT', colour: 7 }, // text notes
  { name: 'A-ANNO-DIMS', colour: 3 }, // permanent dimensions
  { name: 'S-GRID', colour: 1 }, // grid axes and their bubbles
  // The registry's kinds bring their own (elements/contract.ts: dxfLayers).
  ...KINDS.flatMap((k) => k.dxfLayers ?? []),
] as const;
type Layer = string;

/** What the room labels say, as the plan says it. */
export interface DxfLabels {
  readonly room: (number: string, name: string) => string;
  readonly area: (m2: number) => string;
  /** Doors' and windows' type marks (opening/marks.ts), as the plan tags them. */
  readonly marks?: ReadonlyMap<string, string>;
  /** The level's text notes (elements/note). */
  readonly notes?: readonly Note[];
  /** The level's permanent dimensions, placed (elements/dimension/anchor.ts: placeDimension). */
  readonly dimensions?: readonly { readonly a: Point2; readonly b: Point2; readonly la: Point2; readonly lb: Point2; readonly length: number }[];
  /** The grid axes, on every level's plan. */
  readonly grids?: readonly { readonly name: string; readonly start: Point2; readonly end: Point2 }[];
  /** A dimension's value, as the plan writes it. */
  readonly length?: (m: number) => string;
}

/** Text height of the room labels and of the type marks (m). */
const TEXT_H = 0.2;
const MARK_H = 0.15;
const DIM_H = 0.12;
/** A grid bubble's radius (m). */
const BUBBLE_R = 0.35;

/** A text's angle (°) along a direction, kept upright: within ±90°. */
function angleOf(ux: number, uy: number): number {
  let a = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (a > 90) a -= 180;
  if (a <= -90) a += 180;
  return a;
}

export function planDxf(g: DerivedGeometry, levelId: string, labels: DxfLabels): string {
  const out: string[] = [];
  const pair = (code: number, value: string | number) => out.push(String(code), typeof value === 'number' ? fixed(value) : value);
  const line = (layer: Layer, a: Point2, b: Point2) => {
    pair(0, 'LINE');
    pair(8, layer);
    pair(10, a.x);
    pair(20, a.y);
    pair(30, 0);
    pair(11, b.x);
    pair(21, b.y);
    pair(31, 0);
  };
  const polyline = (layer: Layer, points: readonly Point2[], closed: boolean) => {
    pair(0, 'POLYLINE');
    pair(8, layer);
    out.push('66', '1');
    pair(10, 0);
    pair(20, 0);
    pair(30, 0);
    out.push('70', closed ? '1' : '0');
    for (const p of points) {
      pair(0, 'VERTEX');
      pair(8, layer);
      pair(10, p.x);
      pair(20, p.y);
      pair(30, 0);
    }
    pair(0, 'SEQEND');
    pair(8, layer);
  };
  const text = (layer: Layer, at: Point2, height: number, value: string, angle = 0) => {
    pair(0, 'TEXT');
    pair(8, layer);
    pair(10, at.x);
    pair(20, at.y);
    pair(30, 0);
    pair(40, height);
    pair(1, value);
    if (angle !== 0) pair(50, angle);
    // Centred on the point, as the plan centres its labels.
    out.push('72', '1');
    pair(11, at.x);
    pair(21, at.y);
    pair(31, 0);
    out.push('73', '2');
  };

  pair(0, 'SECTION');
  pair(2, 'HEADER');
  pair(9, '$ACADVER');
  pair(1, 'AC1009');
  pair(9, '$DWGCODEPAGE');
  pair(3, 'ANSI_1252');
  // Metres (6): R12 has no units of its own; later readers take them from here.
  pair(9, '$INSUNITS');
  out.push('70', '6');
  pair(0, 'ENDSEC');

  pair(0, 'SECTION');
  pair(2, 'TABLES');
  pair(0, 'TABLE');
  pair(2, 'LTYPE');
  out.push('70', '1');
  pair(0, 'LTYPE');
  pair(2, 'CONTINUOUS');
  out.push('70', '0');
  pair(3, 'Solid line');
  out.push('72', '65', '73', '0');
  pair(40, 0);
  pair(0, 'ENDTAB');
  pair(0, 'TABLE');
  pair(2, 'LAYER');
  out.push('70', String(DXF_LAYERS.length));
  for (const l of DXF_LAYERS) {
    pair(0, 'LAYER');
    pair(2, l.name);
    out.push('70', '0', '62', String(l.colour));
    pair(6, 'CONTINUOUS');
  }
  pair(0, 'ENDTAB');
  pair(0, 'ENDSEC');

  pair(0, 'SECTION');
  pair(2, 'ENTITIES');
  // The walls cut at this level: their outline (the faces, a side shared by two pieces left out) and
  // the lines between their layers.
  const cut = [...g.solids.values()].filter((s) => s.wall.levelId === levelId && s.plan === 'cut');
  for (const side of outerSides(cut.flatMap((s) => s.pieces.map((p) => p.polygon)))) line('A-WALL', side.a, side.b);
  for (const s of cut) for (const seam of s.seams) line('A-WALL-PATT', seam.a, seam.b);
  // Doors and windows of those walls: the window's three lines; the door's leaf and its swing, an arc.
  const walls = new Set(cut.map((s) => s.wall.id));
  const rooms = [...g.rooms.values()].filter((r) => r.room.levelId === levelId && r.enclosed);
  const inRoom = (p: Point2) => rooms.some((r) => insideRing(r.outline, p));
  for (const o of g.openings.values()) {
    if (!walls.has(o.opening.wallId) || !o.frame) continue;
    const lines = symbolLines(o, o.frame);
    const mark = labels.marks?.get(o.opening.id);
    if (mark) text(o.opening.kind === 'door' ? 'A-DOOR-IDEN' : 'A-GLAZ-IDEN', markPoint(o.frame, o.opening, 0.25, inRoom), MARK_H, mark);
    if (o.opening.kind === 'window') {
      for (const l of lines) line('A-GLAZ', l[0]!, l[1]!);
      continue;
    }
    const [leaf, swing] = lines;
    if (!leaf || !swing) continue;
    line('A-DOOR', leaf[0]!, leaf[1]!);
    arc('A-DOOR', leaf[0]!, swing[0]!, swing[swing.length - 1]!, pair);
  }
  // The registry's kinds on this level, each writing itself.
  for (const x of eachSolid(g.kinds)) if (x.levelId === levelId) x.kind.dxf?.(x.solid, { line, polyline });
  // Rooms: the outline, and the name and area at the plan's label point.
  for (const r of g.rooms.values()) {
    if (r.room.levelId !== levelId || !r.enclosed) continue;
    polyline('A-AREA', r.outline, true);
    text('A-AREA-IDEN', { x: r.label.x, y: r.label.y + TEXT_H * 0.7 }, TEXT_H, labels.room(r.room.number, r.room.name));
    text('A-AREA-IDEN', { x: r.label.x, y: r.label.y - TEXT_H * 0.7 }, TEXT_H * 0.8, labels.area(r.area));
  }
  // Dimensions as lines and a text, as R12 readers all draw them: the extension lines, the dimension
  // line, a tick at each end, the value over the middle.
  for (const d of labels.dimensions ?? []) {
    const ux = (d.lb.x - d.la.x) / d.length;
    const uy = (d.lb.y - d.la.y) / d.length;
    const off = Math.hypot(d.la.x - d.a.x, d.la.y - d.a.y);
    const nx = off > 1e-9 ? (d.la.x - d.a.x) / off : -uy;
    const ny = off > 1e-9 ? (d.la.y - d.a.y) / off : ux;
    const past = (p: Point2, k: number) => ({ x: p.x + nx * k, y: p.y + ny * k });
    if (off > 1e-9) {
      line('A-ANNO-DIMS', past(d.a, Math.min(0.05, off)), past(d.la, 0.1));
      line('A-ANNO-DIMS', past(d.b, Math.min(0.05, off)), past(d.lb, 0.1));
    }
    line('A-ANNO-DIMS', d.la, d.lb);
    const t = 0.08;
    for (const p of [d.la, d.lb]) line('A-ANNO-DIMS', { x: p.x - (ux + nx) * t, y: p.y - (uy + ny) * t }, { x: p.x + (ux + nx) * t, y: p.y + (uy + ny) * t });
    text('A-ANNO-DIMS', { x: (d.la.x + d.lb.x) / 2 + nx * DIM_H, y: (d.la.y + d.lb.y) / 2 + ny * DIM_H }, DIM_H, (labels.length ?? ((m: number) => m.toFixed(2)))(d.length), angleOf(ux, uy));
  }
  // Grid axes: the line, and past each end a bubble (a 16-sided circle) with the name.
  for (const g of labels.grids ?? []) {
    const len = Math.hypot(g.end.x - g.start.x, g.end.y - g.start.y);
    if (len === 0) continue;
    const ux = (g.end.x - g.start.x) / len;
    const uy = (g.end.y - g.start.y) / len;
    line('S-GRID', g.start, g.end);
    for (const [p, s] of [
      [g.start, -1],
      [g.end, 1],
    ] as const) {
      const c = { x: p.x + ux * BUBBLE_R * s, y: p.y + uy * BUBBLE_R * s };
      polyline('S-GRID', Array.from({ length: 16 }, (_, i) => ({ x: c.x + BUBBLE_R * Math.cos((i * Math.PI) / 8), y: c.y + BUBBLE_R * Math.sin((i * Math.PI) / 8) })), true);
      text('S-GRID', c, BUBBLE_R, g.name);
    }
  }
  // Text notes: a TEXT a line, centred as the plan draws them (R12's TEXT has one line).
  for (const n of labels.notes ?? []) {
    if (n.levelId !== levelId) continue;
    if (n.elevation) {
      // The level symbol, crossed, and the height to its right.
      const r = n.height * 0.5;
      line('A-ANNO-TEXT', { x: n.at.x - r * 1.4, y: n.at.y }, { x: n.at.x + r * 1.4, y: n.at.y });
      line('A-ANNO-TEXT', { x: n.at.x, y: n.at.y - r * 1.4 }, { x: n.at.x, y: n.at.y + r * 1.4 });
      text('A-ANNO-TEXT', { x: n.at.x + r + n.height * 0.3 + n.text.length * n.height * 0.3, y: n.at.y }, n.height, n.text);
      continue;
    }
    const lines = n.text.split('\n');
    lines.forEach((l, i) => text('A-ANNO-TEXT', { x: n.at.x, y: n.at.y - (i - (lines.length - 1) / 2) * n.height * 1.3 }, n.height, l));
  }
  pair(0, 'ENDSEC');
  pair(0, 'EOF');
  return `${out.join('\r\n')}\r\n`;
}

/** An arc about `centre` from `from` to `to`, the shorter way round, as DXF draws it: counter-clockwise. */
function arc(layer: Layer, centre: Point2, from: Point2, to: Point2, pair: (code: number, value: string | number) => void): void {
  const deg = (p: Point2) => (Math.atan2(p.y - centre.y, p.x - centre.x) * 180) / Math.PI;
  const a = deg(from);
  const b = deg(to);
  // From a to b counter-clockwise when that is the short way (a quarter turn); else from b to a.
  const ccw = (((b - a) % 360) + 360) % 360 <= 180;
  pair(0, 'ARC');
  pair(8, layer);
  pair(10, centre.x);
  pair(20, centre.y);
  pair(30, 0);
  pair(40, Math.hypot(from.x - centre.x, from.y - centre.y));
  pair(50, norm(ccw ? a : b));
  pair(51, norm(ccw ? b : a));
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** Coordinates to the micrometre, no exponent, no -0. */
function fixed(v: number): string {
  const s = (Math.abs(v) < 5e-7 ? 0 : v).toFixed(6);
  return s.replace(/\.?0+$/, '') || '0';
}

/**
 * The text in Windows-1252, the code page the header names: an R12 reader takes its bytes as that.
 * Latin-1 letters (ç, ã, é) are the same byte; the few others of 1252 (€, “ ”, –) are mapped; anything
 * else becomes "?", as a reader of that code page would show it.
 */
export function toCp1252(text: string): Uint8Array {
  const extra: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
    0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
  };
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    bytes[i] = c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : (extra[c] ?? 0x3f);
  }
  return bytes;
}
