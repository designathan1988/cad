// Permanent dimensions in the registry (contract.ts): elements/dimension holds the element and its ends.
// Held by walls, doors and windows: placed from their geometry, deleted with them, and carried, mirrored
// or copied as they are (contract.ts: holders, transformed).

import { finite, isObject, isPoint } from '../../core/guards';
import type { Point2 } from '../../core/vector';
import { num } from '../../ui/i18n';
import type { ElementKind, PlanPaint } from '../contract';
import { placeDimension, resolve, segmentDistance } from '../dimension/anchor';
import { setDimensionDistance } from '../dimension/commands';
import { dimensionFields } from '../dimension/fields';
import { anchorElement, DIM_PREFIX, type DimAnchor, type Dimension } from '../dimension/schema';
import { throughElement } from './paint';

/** Where a dimension is now: its points, its line and its length. */
export interface Placed {
  readonly a: Point2;
  readonly b: Point2;
  readonly la: Point2;
  readonly lb: Point2;
  readonly length: number;
}

/** A dimension as it stands: placed, or null when what held an end is gone. */
export interface DimensionSolid {
  readonly dim: Dimension;
  readonly at: Placed | null;
}

/** Text height of a dimension's value in the DXF (m). */
const DXF_H = 0.12;

const isAnchor = (a: unknown): boolean =>
  isObject(a) &&
  ((a.kind === 'wall' && typeof a.wallId === 'string' && (a.end === 'start' || a.end === 'end') && finite(a.along) && finite(a.offset)) ||
    (a.kind === 'opening' && typeof a.openingId === 'string' && (a.jamb === 'start' || a.jamb === 'end') && finite(a.offset)) ||
    (a.kind === 'point' && isPoint(a.at)));

export const dimensionKind: ElementKind<Dimension, DimensionSolid> = {
  key: 'dimensions',
  prefix: DIM_PREFIX,
  category: null,
  layer: 'top',
  icon: 'dimension',
  one: 'dim.title',
  many: 'dim.titleMany',
  hint: 'dim.held',
  dropped: 'fix.droppedDimensions',
  exportName: 'dim.title',
  exportColour: 'structure',
  valid: (d): d is Dimension => isObject(d) && typeof d.id === 'string' && typeof d.levelId === 'string' && isAnchor(d.a) && isAnchor(d.b) && finite(d.offset),
  derive: (doc, d, g) => ({ dim: d, at: placeDimension(doc, g, d) }),
  element: (s) => s.dim,
  holders: (d) => [anchorElement(d.a), anchorElement(d.b)].filter((x): x is string => x !== null),
  outlines: (s) => (s.at ? [[s.at.la, s.at.lb]] : []),
  // By its line or its value, before what it measures.
  hit: (s, p, near, scale) => {
    if (!s.at) return false;
    const mid = { x: (s.at.la.x + s.at.lb.x) / 2, y: (s.at.la.y + s.at.lb.y) / 2 };
    return Math.min(segmentDistance(p, s.at.la, s.at.lb), Math.hypot(p.x - mid.x, p.y - mid.y) - 10 / scale) <= near;
  },
  pick: 'first',
  // Its free ends go; an end held by a wall or an opening stays with it.
  moved: (d, v) => {
    const free = (a: DimAnchor): DimAnchor => (a.kind === 'point' ? { kind: 'point', at: { x: a.at.x + v.x, y: a.at.y + v.y } } : a);
    return d.a.kind === 'point' || d.b.kind === 'point' ? { ...d, a: free(d.a), b: free(d.b) } : d;
  },
  mapped: (d, t, id) => {
    const free = (a: DimAnchor): DimAnchor => (a.kind === 'point' ? { kind: 'point', at: t.map(a.at) } : a);
    return { ...d, id, a: free(d.a), b: free(d.b), offset: d.offset * t.factor * (t.mirror ? -1 : 1) };
  },
  // An end held by a wall that goes (or a door or window on one) goes with it; mirrored, that wall's ends
  // trade places (edit.ts: swap), so the end is counted from the other one, the jamb the other.
  transformed: (d, c) => {
    const { t } = c;
    const goes = (a: DimAnchor) => (a.kind === 'point' ? false : c.going(anchorElement(a)!));
    const swapped = (a: DimAnchor): DimAnchor =>
      !t.mirror || !goes(a) ? a : a.kind === 'wall' ? { ...a, end: a.end === 'start' ? 'end' : 'start' } : a.kind === 'opening' ? { ...a, jamb: a.jamb === 'start' ? 'end' : 'start' } : a;
    const freePoint = (a: DimAnchor): DimAnchor => (a.kind === 'point' ? { kind: 'point', at: t.map(a.at) } : a);
    // Taken whole: selected, or with both ends on what goes. Its line keeps its side.
    const wholeOffset = d.offset * t.factor * (t.mirror ? -1 : 1);
    if (!c.copy) {
      const a = swapped(c.selected ? freePoint(d.a) : d.a);
      const b = swapped(c.selected ? freePoint(d.b) : d.b);
      const offset = c.selected || (goes(d.a) && goes(d.b)) ? wholeOffset : d.offset;
      return a === d.a && b === d.b && offset === d.offset ? null : { ...d, a, b, offset };
    }
    // A copy is held by the copies of what held it; an end on something not copied is left where the
    // copy of that point lands, free.
    const end = (a: DimAnchor): DimAnchor | null => {
      if (a.kind === 'point') return freePoint(a);
      if (goes(a)) {
        // Swapped while still held by the original (it is what goes), then held by its copy: swapped
        // after, the copy's id did not go, and a mirrored copy measured from the wrong ends.
        const s = swapped(a);
        return s.kind === 'wall' ? { ...s, wallId: c.to(s.wallId) } : s.kind === 'opening' ? { ...s, openingId: c.to(s.openingId) } : s;
      }
      const p = resolve(c.doc, c.geometry, a);
      return p ? { kind: 'point', at: t.map(p) } : null;
    };
    const a = end(d.a);
    const b = end(d.b);
    return a && b ? { ...d, id: c.id, a, b, offset: wholeOffset } : null;
  },
  plan: (p, s, lit) => {
    if (s.at) drawDimension(p, s.at, num(s.at.length), lit ? p.color('--wall-sel') : p.color('--text-2'));
  },
  keepOut: (p, s) => (s.at ? { boxes: [valueBox(p, s.at, num(s.at.length))], lines: [{ a: p.toScreen(s.at.la), b: p.toScreen(s.at.lb) }] } : null),
  // As lines and a text, as R12 readers all draw them: the extension lines, the dimension line, a tick at
  // each end, the value over the middle.
  dxf: (s, out) => {
    const d = s.at;
    if (!d) return;
    const ux = (d.lb.x - d.la.x) / d.length;
    const uy = (d.lb.y - d.la.y) / d.length;
    const off = Math.hypot(d.la.x - d.a.x, d.la.y - d.a.y);
    const nx = off > 1e-9 ? (d.la.x - d.a.x) / off : -uy;
    const ny = off > 1e-9 ? (d.la.y - d.a.y) / off : ux;
    const past = (q: Point2, k: number) => ({ x: q.x + nx * k, y: q.y + ny * k });
    if (off > 1e-9) {
      out.line('A-ANNO-DIMS', past(d.a, Math.min(0.05, off)), past(d.la, 0.1));
      out.line('A-ANNO-DIMS', past(d.b, Math.min(0.05, off)), past(d.lb, 0.1));
    }
    out.line('A-ANNO-DIMS', d.la, d.lb);
    const k = 0.08;
    for (const q of [d.la, d.lb]) out.line('A-ANNO-DIMS', { x: q.x - (ux + nx) * k, y: q.y - (uy + ny) * k }, { x: q.x + (ux + nx) * k, y: q.y + (uy + ny) * k });
    let angle = (Math.atan2(uy, ux) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle <= -90) angle += 180;
    out.text('A-ANNO-DIMS', { x: (d.la.x + d.lb.x) / 2 + nx * DXF_H, y: (d.la.y + d.lb.y) / 2 + ny * DXF_H }, DXF_H, num(d.length), angle);
  },
  // What each measures now: null when an end's element is gone.
  fields: (items, { dispatch }) =>
    throughElement(
      dimensionFields(
        items.map((s) => s.dim),
        (d) => items.find((s) => s.dim === d)?.at?.length ?? null,
        { setDimensionDistance: (ids, distance) => dispatch(setDimensionDistance(ids, distance)) },
      ),
      (s: DimensionSolid) => s.dim,
    ),
};

/** The screen pieces of a dimension: its points, its line, the side it stands on and its value's place. */
function onScreen(p: PlanPaint, d: Placed) {
  const a = p.toScreen(d.a);
  const b = p.toScreen(d.b);
  const la = p.toScreen(d.la);
  const lb = p.toScreen(d.lb);
  const len = Math.hypot(lb.x - la.x, lb.y - la.y);
  const u = len > 0 ? { x: (lb.x - la.x) / len, y: (lb.y - la.y) / len } : { x: 1, y: 0 };
  // Toward the line from the points measured; along u's normal when the line is on them.
  const off = Math.hypot(la.x - a.x, la.y - a.y);
  const n = off > 0.5 ? { x: (la.x - a.x) / off, y: (la.y - a.y) / off } : { x: u.y, y: -u.x };
  const mid = { x: (la.x + lb.x) / 2 + n.x * 9, y: (la.y + lb.y) / 2 + n.y * 9 };
  return { a, b, la, lb, len, u, off, n, mid };
}

/** Where a dimension's value is on screen, for the room tags to keep off. */
function valueBox(p: PlanPaint, d: Placed, text: string): { x: number; y: number; w: number; h: number } {
  const { la, lb, mid } = onScreen(p, d);
  p.ctx.font = p.font('500', '--fs-xs');
  const w = p.ctx.measureText(text).width + 8;
  // Upright or along a slope: the box that holds it either way.
  const vertical = Math.abs(lb.y - la.y) > Math.abs(lb.x - la.x);
  return vertical ? { x: mid.x - 9, y: mid.y - w / 2, w: 18, h: w } : { x: mid.x - w / 2, y: mid.y - 9, w, h: 18 };
}

/** A dimension in plan: its extension lines, its line with a tick at each end, and its value. Also the one being made. */
export function drawDimension(p: PlanPaint, d: Placed, text: string, colour: string): void {
  const { ctx } = p;
  const { a, b, la, lb, len, u, off, n, mid } = onScreen(p, d);
  if (len < 1) return;
  const gap = Math.min(3, off);
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [q, l] of [
    [a, la],
    [b, lb],
  ] as const) {
    if (off > 0.5) {
      ctx.moveTo(q.x + n.x * gap, q.y + n.y * gap);
      ctx.lineTo(l.x + n.x * 4, l.y + n.y * 4);
    }
  }
  ctx.moveTo(la.x - u.x * 4, la.y - u.y * 4);
  ctx.lineTo(lb.x + u.x * 4, lb.y + u.y * 4);
  const tx = (u.x + n.x) * 4;
  const ty = (u.y + n.y) * 4;
  for (const q of [la, lb]) {
    ctx.moveTo(q.x - tx, q.y - ty);
    ctx.lineTo(q.x + tx, q.y + ty);
  }
  ctx.stroke();
  // The value: upright (its angle within ±90°), on the side of the line away from what it measures.
  let angle = Math.atan2(u.y, u.x);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle <= -Math.PI / 2) angle += Math.PI;
  ctx.font = p.font('500', '--fs-xs');
  const tw = ctx.measureText(text).width;
  ctx.translate(mid.x, mid.y);
  ctx.rotate(angle);
  ctx.fillStyle = p.color('--canvas');
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-tw / 2 - 3, -8, tw + 6, 15);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Too short for its value: the value stays, the line shows what it is of.
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
