import type { PlanView } from './plan-view';
import type { PlanOverlay } from './plan-types';
import { warnSign } from './plan-text';
import type { Point2 } from '../model/vector';
import { arcOf, pointAt } from '../elements/wall/geometry/arc';
import type { DerivedGeometry } from '../project/derive';
import { openingOutline } from '../project/derived-queries';
import type { Handles } from '../session/handles';
import { symbolLines } from '../elements/opening/symbol';


export function drawGrid(view: PlanView, minor: string, major: string, axisX: string, axisY: string): void {
  const { ctx } = view;
  const { w, h } = view.size;
  // The step follows the zoom so the density stays the same: about 24 px between minor lines.
  const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100];
  const step = steps.find((s) => s * view.scale >= 24) ?? 100;
  const majorEvery = step < 1 ? Math.round(1 / step) : 5;
  const a = view.toWorld({ x: 0, y: h });
  const b = view.toWorld({ x: w, y: 0 });
  ctx.lineWidth = 1;
  for (let i = Math.floor(a.x / step); i <= Math.ceil(b.x / step); i++) {
    const x = Math.round(view.toScreen({ x: i * step, y: 0 }).x) + 0.5;
    ctx.strokeStyle = i % majorEvery === 0 ? major : minor;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let j = Math.floor(a.y / step); j <= Math.ceil(b.y / step); j++) {
    const y = Math.round(view.toScreen({ x: 0, y: j * step }).y) + 0.5;
    ctx.strokeStyle = j % majorEvery === 0 ? major : minor;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const o = view.toScreen({ x: 0, y: 0 });
  ctx.strokeStyle = axisX;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(o.y) + 0.5);
  ctx.lineTo(w, Math.round(o.y) + 0.5);
  ctx.stroke();
  ctx.strokeStyle = axisY;
  ctx.beginPath();
  ctx.moveTo(Math.round(o.x) + 0.5, 0);
  ctx.lineTo(Math.round(o.x) + 0.5, h);
  ctx.stroke();
}

/** A reference line along the wall (its arc, for an arc wall), a dot at its start and an arrow at its end. */
export function drawRefLine(view: PlanView, r: { start: Point2; end: Point2; bulge?: number }, colour: string): void {
  const { ctx } = view;
  const arc = r.bulge ? arcOf({ start: r.start, end: r.end, bulge: r.bulge }) : null;
  const pts = arc ? Array.from({ length: 33 }, (_, i) => pointAt(arc, arc.startAngle + (arc.sweep * i) / 32)) : [r.start, r.end];
  const screen = pts.map((p) => view.toScreen(p));
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  screen.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  const a = screen[0]!;
  ctx.beginPath();
  ctx.arc(a.x, a.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // The arrow along the line's last stretch, short of its end, where the end's grip would cover it.
  const end = screen.at(-1)!;
  const p = screen.at(-2)!;
  const len = Math.hypot(end.x - p.x, end.y - p.y);
  if (len > 0) {
    const ux = (end.x - p.x) / len;
    const uy = (end.y - p.y) / len;
    const back = Math.min(14, len / 2);
    const b = { x: end.x - ux * back, y: end.y - uy * back };
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - ux * 9 - uy * 4.5, b.y - uy * 9 + ux * 4.5);
    ctx.lineTo(b.x - ux * 9 + uy * 4.5, b.y - uy * 9 - ux * 4.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A line without ends through `point` along `dir`, dashed across the canvas, its dashes fixed to the plan. */
export function drawLine(view: PlanView, point: Point2, dir: Point2, colour: string, width: number, dash: readonly number[]): void {
  const { ctx } = view;
  const at = view.toScreen(point);
  const b = view.toScreen({ x: point.x + dir.x, y: point.y + dir.y });
  const len = Math.hypot(b.x - at.x, b.y - at.y);
  if (len === 0) return;
  const ux = (b.x - at.x) / len;
  const uy = (b.y - at.y) / len;
  // Level or upright, on the middle of a pixel row (an odd width) or between two (even): a 1 px line
  // between rows was smeared over both, pale, and guides of one colour looked of two.
  const crisp = (v: number) => (width % 2 === 1 ? Math.round(v - 0.5) + 0.5 : Math.round(v));
  const a = { x: Math.abs(ux) < 1e-9 ? crisp(at.x) : at.x, y: Math.abs(uy) < 1e-9 ? crisp(at.y) : at.y };
  const { w, h } = view.size;
  // Past both edges of the canvas from the line's point, wherever that point is.
  const reach = Math.hypot(w, h) + Math.hypot(a.x - w / 2, a.y - h / 2);
  const period = dash.reduce((s, x) => s + x, 0);
  ctx.save();
  ctx.setLineDash([...dash]);
  ctx.lineDashOffset = -(reach % period);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x - ux * reach, a.y - uy * reach);
  ctx.lineTo(a.x + ux * reach, a.y + uy * reach);
  ctx.stroke();
  ctx.restore();
}

/** Squares move an end, arrows stretch along the wall, the arc turns the selection. */
export function drawSelectionHandles(view: PlanView, h: Handles, bg: string, line: string): void {
  drawHandles(view.ctx, h, bg, line);
}

/**
 * Where an opening's warning sign goes: at its middle, or stepped across the wall away from the
 * selection's handles. One at a wall's joint lay under the square of the wall's end, unseen.
 */
export function clearOfHandles(view: PlanView, a: Point2, b: Point2, h: Handles): Point2 {
  const mid = view.toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const marks = [...h.squares.map((s) => s.at), ...h.arrows.map((x) => x.at), ...(h.rotate ? [h.rotate.at] : []), ...(h.bulge ? [h.bulge.at] : [])];
  const clear = (p: Point2) => marks.every((m) => Math.hypot(m.x - p.x, m.y - p.y) >= 16);
  if (clear(mid)) return mid;
  const sa = view.toScreen(a);
  const sb = view.toScreen(b);
  const len = Math.hypot(sb.x - sa.x, sb.y - sa.y) || 1;
  const n = { x: -(sb.y - sa.y) / len, y: (sb.x - sa.x) / len };
  for (const k of [1, -1, 2, -2]) {
    const p = { x: mid.x + n.x * 16 * k, y: mid.y + n.y * 16 * k };
    if (clear(p)) return p;
  }
  return mid;
}

/**
 * Doors and windows as plans draw them, over the cut in the wall. A door: its leaf standing open at
 * 90° from the hinge jamb, on the side it opens to, and the quarter arc its edge sweeps back to the
 * other jamb. A window: the frame lines at both wall faces and the glass line between them. Invalid
 * openings are drawn the same, in the warning colour.
 */
export function drawOpenings(view: PlanView, g: DerivedGeometry, o: PlanOverlay, c: { line: string; sel: string; selFill: string; warn: string; canvas: string }): void {
  const { ctx } = view;
  const path = (pts: readonly Point2[], close = false) => {
    ctx.beginPath();
    pts.forEach((v, i) => {
      const p = view.toScreen(v);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    if (close) ctx.closePath();
  };
  for (const op of g.openings.values()) {
    const f = op.frame;
    if (!f) continue;
    const id = op.opening.id;
    const active = o.selected.has(id) || o.openingPreview === id;
    const colour = !op.valid ? c.warn : active || o.hover === id ? c.sel : c.line;
    if (active) {
      ctx.fillStyle = c.selFill;
      ctx.globalAlpha = 0.5;
      path(openingOutline(op), true);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = view.pen('fine') * (active ? 1.6 : 1);
    for (const line of symbolLines(op, op.frame)) (path(line), ctx.stroke());
    if (!op.valid) warnSign(view, clearOfHandles(view, f.start, f.end, o.handles), c.warn, c.canvas);
  }
}

/** The selection's handles (app/handles.ts) on a 2D canvas, in plan and over the 3D view alike. */
export function drawHandles(ctx: CanvasRenderingContext2D, h: Handles, bg: string, line: string): void {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  for (const s of h.squares) {
    ctx.fillRect(Math.round(s.at.x) - 4.5, Math.round(s.at.y) - 4.5, 9, 9);
    ctx.strokeRect(Math.round(s.at.x) - 4.5, Math.round(s.at.y) - 4.5, 9, 9);
  }
  for (const a of h.arrows) {
    // A triangle pointing outward along the wall.
    const n = { x: -a.dir.y, y: a.dir.x };
    ctx.beginPath();
    ctx.moveTo(a.at.x + a.dir.x * 6, a.at.y + a.dir.y * 6);
    ctx.lineTo(a.at.x - a.dir.x * 4 + n.x * 5, a.at.y - a.dir.y * 4 + n.y * 5);
    ctx.lineTo(a.at.x - a.dir.x * 4 - n.x * 5, a.at.y - a.dir.y * 4 - n.y * 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (h.bulge) {
    // A diamond at the middle of the arc: not a square, which moves an end.
    const { x, y } = h.bulge.at;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  for (const f of h.flips) {
    // A disc with a double arrow along its axis, as Revit's flip controls.
    const { x, y } = f.at;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const d = f.dir;
    const n = { x: -d.y, y: d.x };
    ctx.beginPath();
    ctx.moveTo(x - d.x * 5, y - d.y * 5);
    ctx.lineTo(x + d.x * 5, y + d.y * 5);
    for (const s of [1, -1]) {
      const tip = { x: x + d.x * 5 * s, y: y + d.y * 5 * s };
      ctx.moveTo(tip.x - d.x * 3 * s + n.x * 3, tip.y - d.y * 3 * s + n.y * 3);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(tip.x - d.x * 3 * s - n.x * 3, tip.y - d.y * 3 * s - n.y * 3);
    }
    ctx.stroke();
  }
  if (h.rotate) {
    // A disc with a three-quarter arc and its arrowhead.
    const { x, y } = h.rotate.at;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4.5, -Math.PI * 0.9, Math.PI * 0.6);
    ctx.stroke();
    const tip = { x: x + 4.5 * Math.cos(Math.PI * 0.6), y: y + 4.5 * Math.sin(Math.PI * 0.6) };
    ctx.beginPath();
    ctx.moveTo(tip.x - 3, tip.y - 1);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(tip.x + 1, tip.y - 3);
    ctx.stroke();
  }
  ctx.restore();
}
