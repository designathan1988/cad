// The handles of a selected parametric object (phase 3: GDL's hotspots), and of a selected door or
// window (its two jambs for the width, its head for the height, a window's sill), in plan and in 3D
// alike: each
// one where its definition puts it, with its axis as seen on screen. Dragged, the pointer's motion along
// that axis on screen, in metres, changes the parameter; the object's position follows by the handle's
// share (the opposite face stays). A preview while dragging, one undo step on release. In plan the
// handles of height do not show: their axis is seen end-on.

import type { Point2 } from '../model/vector';
import { setObjectValues } from '../elements/object/commands';
import { updateOpening } from '../elements/opening/commands';
import type { Opening, PositionRule } from '../elements/opening/schema';
import { evaluateObject } from '../elements/object/evaluate';
import { held } from '../elements/object/param-limits';
import { deriveGeometry } from '../project/derive';
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
  /** A door's or window's handle: which of its sizes it changes. */
  readonly opening?: OpeningHandle;
  /** An object's handle: its place in the evaluated handles (to find it again with another value). */
  readonly index?: number;
}

/** A jamb (the width, the other jamb staying), the head (the height) or a window's sill (the head staying). */
export type OpeningHandle = 'start' | 'end' | 'head' | 'sill';

/** A handle's reach from its centre (px); 22 (a 44 px target) on touch. */
const reach = (): number => (matchMedia('(pointer: coarse)').matches ? 22 : 10);

/** The selected object's handles on screen: one object selected with the select tool. */
export function objectHandles(app: App): ScreenHandle[] {
  const { ui } = app;
  if (ui.tool !== 'select' || ui.selection.size !== 1 || ui.drag) return [];
  const id = [...ui.selection][0]!;
  if (app.geometry.openings.has(id)) return openingHandles(app, id);
  const s = app.geometry.kinds.get('objects')?.get(id) as ObjectSolid | undefined;
  if (!s || s.object.levelId !== ui.levelId) return [];
  const lift = ui.view === '3d' ? app.lift(s.object.levelId) : 0;
  const project = (p: Point2, z: number): Point2 | null => (ui.view === 'plan' ? app.plan.toScreen(p) : app.projectAt(p, s.floor + lift + z));
  return s.eval.handles.flatMap((h, index) => {
    const a = project({ x: h.at.x, y: h.at.y }, h.at.z);
    const b = project({ x: h.at.x + h.dir.x, y: h.at.y + h.dir.y }, h.at.z + h.dir.z);
    if (!a || !b) return [];
    const along = { x: b.x - a.x, y: b.y - a.y };
    // Seen end-on (height in plan) it cannot be dragged: not shown.
    if (Math.hypot(along.x, along.y) < 4) return [];
    return [{ id, param: h.param, at: a, along, shift: h.shift, dir: { x: h.dir.x, y: h.dir.y }, index }];
  });
}

/**
 * A door's or window's handles: at each jamb and at the head, in the middle of the wall's thickness;
 * a window's sill too. The axis is the wall's (a jamb) or up and down (head, sill).
 */
function openingHandles(app: App, id: string): ScreenHandle[] {
  const { ui } = app;
  const o = app.geometry.openings.get(id);
  const f = o?.frame;
  const levelId = o ? app.store.get().walls.find((w) => w.id === o.opening.wallId)?.levelId : undefined;
  if (!o || !f || levelId !== ui.levelId) return [];
  const lift = ui.view === '3d' ? app.lift(levelId) : 0;
  const mid = (f.faces[0] + f.faces[1]) / 2;
  const on = (p: Point2): Point2 => ({ x: p.x + f.normal.x * mid, y: p.y + f.normal.y * mid });
  const centre = on({ x: (f.start.x + f.end.x) / 2, y: (f.start.y + f.end.y) / 2 });
  const project = (p: Point2, z: number): Point2 | null => (ui.view === 'plan' ? app.plan.toScreen(p) : app.projectAt(p, z + lift));
  const half = (o.bottom + o.top) / 2;
  const make = (which: OpeningHandle, p: Point2, z: number, d: { x: number; y: number; z: number }): ScreenHandle[] => {
    const a = project(p, z);
    const b = project({ x: p.x + d.x, y: p.y + d.y }, z + d.z);
    if (!a || !b) return [];
    const along = { x: b.x - a.x, y: b.y - a.y };
    if (Math.hypot(along.x, along.y) < 4) return [];
    return [{ id, param: which, at: a, along, shift: 0, dir: { x: d.x, y: d.y }, opening: which }];
  };
  const back = { x: -f.dir.x, y: -f.dir.y, z: 0 };
  return [
    ...make('start', on(f.start), half, back),
    ...make('end', on(f.end), half, { x: f.dir.x, y: f.dir.y, z: 0 }),
    ...make('head', centre, o.top, { x: 0, y: 0, z: 1 }),
    ...(o.opening.kind === 'window' ? make('sill', centre, o.bottom, { x: 0, y: 0, z: -1 }) : []),
  ];
}

/**
 * The rule that keeps a door's or window's other jamb where it is when one jamb moves by `grow` (the
 * width's change): measured from the side that moves, the distance gives way; from the side that
 * stays, it is kept. Centred, aligned or in a group, the rule is kept (it places the opening itself).
 */
function ruleFor(rule: PositionRule, jamb: 'start' | 'end', grow: number): PositionRule {
  const moving = (from: 'start' | 'end') => from === jamb;
  if (rule.kind === 'fromStart') return moving('start') ? { ...rule, distance: rule.distance - grow } : rule;
  if (rule.kind === 'fromEnd') return moving('end') ? { ...rule, distance: rule.distance - grow } : rule;
  // From another opening: toward 'end', this one lies past it, measured from its start jamb.
  if (rule.kind === 'fromOpening') return moving(rule.toward === 'end' ? 'start' : 'end') ? { ...rule, distance: rule.distance - grow } : rule;
  return rule;
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
  /** A door's or window's change as dragged so far. */
  readonly patch?: Partial<Pick<Opening, 'width' | 'height' | 'sill' | 'rule'>>;
  /** The door or window as it was when taken: the preview changes the one in the geometry. */
  readonly base?: Opening;
  /** How tall it can go: up to its wall's top. */
  readonly most?: number;
  /**
   * How far the handle goes along its axis for each metre (or unit) the value grows: 1 for a face that
   * moves with it, ½ for a centred door's jamb or a diameter's edge. The pointer's motion over it is the
   * value's, so the handle stays under the pointer.
   */
  readonly rate: number;
}

/** A small step to measure how the handle goes with its value. */
const PROBE = 0.01;

/** The rate, kept from nothing: 1 when the handle does not move at all with its value (it cannot follow then). */
const usable = (r: number): number => (Number.isFinite(r) && Math.abs(r) > 0.05 ? r : 1);

/** An object's handle's rate: its definition evaluated with the value a step on, the handle found again, and the object's own shift. */
function objectRate(app: App, s: ObjectSolid, handle: ScreenHandle, start: number): number {
  const param = s.def.params.find((x) => x.name === handle.param);
  const at = handle.index === undefined ? undefined : s.eval.handles[handle.index];
  if (!param || !at) return 1;
  // A step up, or down when the value is at its most.
  const step = held(param, start + PROBE, s.def) !== start ? PROBE : -PROBE;
  const doc = app.store.get();
  const ev = evaluateObject(s.def, { ...s.object, values: { ...s.object.values, [handle.param]: start + step } }, { definitions: doc.definitions, materials: doc.materials });
  const next = ev.handles[handle.index!];
  if (!next) return 1;
  const len = Math.hypot(at.dir.x, at.dir.y, at.dir.z) || 1;
  const moved = ((next.at.x - at.at.x) * at.dir.x + (next.at.y - at.at.y) * at.dir.y + (next.at.z - at.at.z) * at.dir.z) / len;
  return usable(moved / step + handle.shift);
}

/** A door's or window's jamb's rate: the wall's openings derived with it a step wider, its rule as the drag keeps it. */
function jambRate(app: App, o: Opening, which: 'start' | 'end'): number {
  const before = app.geometry.openings.get(o.id)?.frame;
  const doc = app.store.get();
  const wider = { ...o, width: o.width + PROBE, rule: ruleFor(o.rule, which, PROBE) };
  const after = deriveGeometry({ ...doc, openings: doc.openings.map((x) => (x.id === o.id ? wider : x)) }).openings.get(o.id)?.frame;
  if (!before || !after) return 1;
  const a = which === 'start' ? before.start : before.end;
  const b = which === 'start' ? after.start : after.end;
  // Outward along the wall: back from its start, on from its end.
  const sign = which === 'start' ? -1 : 1;
  return usable((((b.x - a.x) * before.dir.x + (b.y - a.y) * before.dir.y) * sign) / PROBE);
}

export function startHandleDrag(app: App, handle: ScreenHandle, from: Point2): HandleDrag | null {
  if (handle.opening) {
    const placed = app.geometry.openings.get(handle.id);
    const o = placed?.opening;
    if (!o || !placed) return null;
    const wallTop = app.geometry.solids.get(o.wallId)?.top;
    const most = wallTop !== undefined ? wallTop - placed.bottom : undefined;
    const start = handle.opening === 'head' ? o.height : handle.opening === 'sill' ? o.sill : o.width;
    const rate = handle.opening === 'start' || handle.opening === 'end' ? jambRate(app, o, handle.opening) : 1;
    return { handle, from, start, startAt: { x: 0, y: 0 }, value: start, at: { x: 0, y: 0 }, patch: {}, base: o, rate, ...(most !== undefined ? { most } : {}) };
  }
  const s = app.geometry.kinds.get('objects')?.get(handle.id) as ObjectSolid | undefined;
  const start = s?.eval.env[handle.param];
  if (!s || start === undefined) return null;
  return { handle, from, start, startAt: s.object.at, value: start, at: s.object.at, rate: objectRate(app, s, handle, start) };
}

/** The drag with the pointer at `p`: the change in metres along the axis on screen, held to the parameter. */
export function moveHandleDrag(app: App, d: HandleDrag, p: Point2): HandleDrag {
  const which = d.handle.opening;
  if (which) {
    // Measured from the opening as taken: the geometry already shows the drag so far.
    const o = d.base;
    if (!o) return d;
    const a = d.handle.along;
    const delta = ((p.x - d.from.x) * a.x + (p.y - d.from.y) * a.y) / (a.x * a.x + a.y * a.y) / d.rate;
    // On the centimetre with snaps on; never under 20 cm, a sill never below the floor.
    const snap = (v: number) => (app.ui.snaps ? Math.round(v / 0.01) * 0.01 : v);
    if (which === 'head') {
      const value = Math.min(d.most ?? Infinity, Math.max(0.2, snap(d.start + delta)));
      return { ...d, value, patch: { height: value } };
    }
    if (which === 'sill') {
      // Dragged down (the axis points down) the sill goes down and the window grows: its head stays.
      const value = Math.min(Math.max(0, snap(d.start - delta)), d.start + o.height - 0.2);
      return { ...d, value, patch: { sill: value, height: o.height + (d.start - value) } };
    }
    const value = Math.max(0.2, snap(d.start + delta));
    return { ...d, value, patch: { width: value, rule: ruleFor(o.rule, which, value - d.start) } };
  }
  const s = app.geometry.kinds.get('objects')?.get(d.handle.id) as ObjectSolid | undefined;
  const param = s?.def.params.find((x) => x.name === d.handle.param);
  if (!param) return d;
  const a = d.handle.along;
  const delta = ((p.x - d.from.x) * a.x + (p.y - d.from.y) * a.y) / (a.x * a.x + a.y * a.y) / d.rate;
  // On the 5 mm step with snaps on (or the parameter's own step), within its range.
  const raw = d.start + delta;
  const value = held(param, app.ui.snaps ? Math.round(raw / 0.005) * 0.005 : raw, s!.def);
  const moved = (value - d.start) * d.handle.shift;
  return { ...d, value, at: { x: d.startAt.x + d.handle.dir.x * moved, y: d.startAt.y + d.handle.dir.y * moved } };
}

/** Let go: one undo step with the value and the position. */
export function endHandleDrag(app: App, d: HandleDrag): void {
  if (Math.abs(d.value - d.start) < 1e-9) return;
  if (d.handle.opening) {
    if (d.patch) app.store.dispatch(updateOpening(d.handle.id, d.patch));
    return;
  }
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
