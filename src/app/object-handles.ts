// The handles of a selected parametric object (phase 3: GDL's hotspots), in plan and in 3D alike: each
// one where its definition puts it, with its axis as seen on screen. Dragged, the pointer's motion along
// that axis on screen, in metres, changes the parameter; the object's position follows by the handle's
// share (the opposite face stays). A preview while dragging, one undo step on release. In plan the
// handles of height do not show: their axis is seen end-on.

import type { Point2 } from '../core/vector';
import { setObjectValues } from '../elements/object/commands';
import { held } from '../elements/object/evaluate';
import type { ObjectSolid } from '../elements/kinds/object';
import type { App } from './app';

export interface ScreenHandle {
  readonly id: string;
  readonly param: string;
  /** On screen (px), and the axis on screen: px per metre the parameter grows. */
  readonly at: Point2;
  readonly along: Point2;
  readonly shift: number;
  /** The axis in the plan (x, y): where the position goes with the change. */
  readonly dir: Point2;
}

/** A handle's reach from its centre (px); 22 (a 44 px target) on touch. */
const reach = (): number => (matchMedia('(pointer: coarse)').matches ? 22 : 10);

/** The selected object's handles on screen: one object selected with the select tool, not walking. */
export function objectHandles(app: App): ScreenHandle[] {
  const { ui } = app;
  if (ui.tool !== 'select' || ui.selection.size !== 1 || app.walker || ui.drag) return [];
  const id = [...ui.selection][0]!;
  const s = app.geometry.kinds.get('objects')?.get(id) as ObjectSolid | undefined;
  if (!s || s.object.levelId !== ui.levelId) return [];
  const lift = ui.view === '3d' ? app.lift(s.object.levelId) : 0;
  const project = (p: Point2, z: number): Point2 | null => (ui.view === 'plan' ? app.plan.toScreen(p) : app.projectAt(p, s.floor + lift + z));
  return s.eval.handles.flatMap((h) => {
    const a = project({ x: h.at.x, y: h.at.y }, h.at.z);
    const b = project({ x: h.at.x + h.dir.x, y: h.at.y + h.dir.y }, h.at.z + h.dir.z);
    if (!a || !b) return [];
    const along = { x: b.x - a.x, y: b.y - a.y };
    // Seen end-on (height in plan) it cannot be dragged: not shown.
    if (Math.hypot(along.x, along.y) < 4) return [];
    return [{ id, param: h.param, at: a, along, shift: h.shift, dir: { x: h.dir.x, y: h.dir.y } }];
  });
}

/** The handle under a screen point, nearest first. */
export function objectHandleAt(app: App, p: Point2): ScreenHandle | null {
  let best: ScreenHandle | null = null;
  let d = reach();
  for (const h of objectHandles(app)) {
    const e = Math.hypot(h.at.x - p.x, h.at.y - p.y);
    if (e <= d) {
      best = h;
      d = e;
    }
  }
  return best;
}

/** A handle being dragged: where it was taken and what the object was then. */
export interface HandleDrag {
  readonly handle: ScreenHandle;
  readonly from: Point2;
  readonly start: number;
  readonly startAt: Point2;
  /** The parameter's value and the position as dragged so far (the preview). */
  readonly value: number;
  readonly at: Point2;
}

export function startHandleDrag(app: App, handle: ScreenHandle, from: Point2): HandleDrag | null {
  const s = app.geometry.kinds.get('objects')?.get(handle.id) as ObjectSolid | undefined;
  const start = s?.eval.env[handle.param];
  if (!s || start === undefined) return null;
  return { handle, from, start, startAt: s.object.at, value: start, at: s.object.at };
}

/** The drag with the pointer at `p`: the change in metres along the axis on screen, held to the parameter. */
export function moveHandleDrag(app: App, d: HandleDrag, p: Point2): HandleDrag {
  const s = app.geometry.kinds.get('objects')?.get(d.handle.id) as ObjectSolid | undefined;
  const param = s?.def.params.find((x) => x.name === d.handle.param);
  if (!param) return d;
  const a = d.handle.along;
  const delta = ((p.x - d.from.x) * a.x + (p.y - d.from.y) * a.y) / (a.x * a.x + a.y * a.y);
  // On the 5 mm step with snaps on (or the parameter's own step), within its range.
  const raw = d.start + delta;
  const value = held(param, app.ui.snaps ? Math.round(raw / 0.005) * 0.005 : raw);
  const moved = (value - d.start) * d.handle.shift;
  return { ...d, value, at: { x: d.startAt.x + d.handle.dir.x * moved, y: d.startAt.y + d.handle.dir.y * moved } };
}

/** Let go: one undo step with the value and the position. */
export function endHandleDrag(app: App, d: HandleDrag): void {
  if (Math.abs(d.value - d.start) < 1e-9) return;
  app.store.dispatch(setObjectValues([{ id: d.handle.id, values: { [d.handle.param]: d.value }, at: d.at }]));
}

/** The handles drawn: a disc with an arrow along the axis, out and in. */
export function drawObjectHandles(ctx: CanvasRenderingContext2D, handles: readonly ScreenHandle[], bg: string, line: string, hot: ScreenHandle | null): void {
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const h of handles) {
    const len = Math.hypot(h.along.x, h.along.y) || 1;
    const d = { x: h.along.x / len, y: h.along.y / len };
    const n = { x: -d.y, y: d.x };
    const { x, y } = h.at;
    const isHot = hot !== null && hot.id === h.id && hot.param === h.param && Math.hypot(hot.at.x - x, hot.at.y - y) < 1;
    ctx.fillStyle = isHot ? line : bg;
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // An arrowhead outward along the axis, past the disc.
    ctx.fillStyle = line;
    ctx.beginPath();
    ctx.moveTo(x + d.x * 15, y + d.y * 15);
    ctx.lineTo(x + d.x * 8 + n.x * 4, y + d.y * 8 + n.y * 4);
    ctx.lineTo(x + d.x * 8 - n.x * 4, y + d.y * 8 - n.y * 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
