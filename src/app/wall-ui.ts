// The wall tool: the wall being drawn and its tags, the measures typed, a chain closing a loop. Functions over the app (app.ts delegates).

import { angleNum, lengthText, typingExamples } from '../ui/units';
import { parseLength, parseLengthAngle, parseNumber, parsePoint, parsePointFrom } from '../core/measure';
import { distance, type Point2 } from '../core/vector';
import { MIN_WALL_LENGTH } from '../core/tolerance';
import { arcOf, pointAt } from '../elements/wall/geometry/arc';
import { addWalls, setWalls } from '../elements/wall/commands';
import { ruleKeepingPosition, updateOpening } from '../elements/opening/commands';
import { hasDistance } from '../elements/opening/schema';
import { t } from '../ui/i18n';
import { arcMiddle } from '../tools/arc-edit';
import { bulgeThrough, rectangle, typedEnd, wallTransition, type WallToolEvent } from '../tools/wall-tool';
import { type DocWall, wallNumber, wallOverrides } from './document';
import { stretchEnd } from '../tools/edit';
import { referenceLength } from '../elements/opening/derive';
import { newId } from '../core/id';
import type { App } from './app';
import { PREVIEW_ID } from './app';

export function previewWall(app: App): DocWall[] {
  const w = app.ui.wall;
  if (app.ui.tool !== 'wall') return [];
  if (w.kind === 'rect') {
    const sides = rectangle(w.start, app.rectCorner());
    return (sides ?? []).map((s, i) => app.oriented(s.start, s.end, `${PREVIEW_ID}${i}`));
  }
  if (w.kind === 'bend') {
    const b = bulgeThrough(w.last, w.end, w.cursor);
    return [app.oriented(w.last, w.end, PREVIEW_ID, b ?? 0)];
  }
  if (w.kind !== 'drawing') return [];
  const end = app.drawingEnd();
  if (distance(w.last, end) < MIN_WALL_LENGTH) return [];
  return [app.oriented(w.last, end, PREVIEW_ID)];
}

/** The numbers of the walls selected (a few) or under the pointer, or snapped to while drawing. */
export function wallTags(app: App): { at: Point2; text: string }[] {
  const doc = app.store.get();
  const ids = new Set([...app.ui.selection].slice(0, 12));
  if (app.ui.hover) ids.add(app.ui.hover);
  if (app.ui.snap?.wallId) ids.add(app.ui.snap.wallId);
  // As shown: a wall being dragged, moved or turned by a Modify tool carries its number along.
  return [...app.geometry.solids.values()]
    .map((s) => s.wall)
    .filter((w) => ids.has(w.id) && w.levelId === app.ui.levelId)
    // A third of the way along: the middle is where the temporary dimension shows its value. Along an
    // arc, on the arc: on its chord the tag sat inside the curve, across the chord and radius dimensions.
    // At 70 % of its sweep, clear of the radius dimension (30 %, temp-dims.ts) and the bend handle (50 %).
    .map((w) => {
      const arc = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 });
      const at = arc ? pointAt(arc, arc.startAngle + arc.sweep * 0.7) : { x: w.start.x + (w.end.x - w.start.x) / 3, y: w.start.y + (w.end.y - w.start.y) / 3 };
      return { at, text: t('wall.tag', { n: wallNumber(doc, w.id) ?? '' }) };
    });
}

/** While turning the selection: the angle, at the point it turns about. */
export function turnMeasure(app: App): { at: Point2; text: string } | null {
  const d = app.ui.drag;
  if (d?.kind === 'stretch' || d?.kind === 'grip') {
    const w = d.walls.find((x) => x.id === d.id);
    return w ? { at: { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 }, text: `${lengthText(referenceLength(w))}` } : null;
  }
  if (d?.kind === 'bulge') {
    // The arc's radius and length at its middle, as while drawing one; straight again, its length.
    const w = d.walls.find((x) => x.id === d.id);
    if (!w) return null;
    const arc = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 });
    const at = arcMiddle(w.start, w.end, w.bulge ?? 0);
    return arc ? { at, text: `R ${lengthText(arc.radius)} · ${lengthText(referenceLength(w))}` } : { at, text: `${lengthText(referenceLength(w))}` };
  }
  if (d?.kind !== 'rotate') return null;
  const deg = (d.angle * 180) / Math.PI;
  return { at: d.pivot, text: `${angleNum(deg)}°` };
}

/** While bending an arc: its radius, at the middle of the arc, set off outward. Null for a straight bend. */
export function bendMeasure(app: App): { at: Point2; text: string; normal: Point2; clear: number } | null {
  const w = app.ui.wall;
  if (app.ui.tool !== 'wall' || w.kind !== 'bend') return null;
  const b = bulgeThrough(w.last, w.end, w.cursor);
  const arc = b === null ? null : arcOf({ start: w.last, end: w.end, bulge: b });
  if (!arc) return null;
  const mid = arc.startAngle + arc.sweep / 2;
  const out = { x: Math.cos(mid), y: Math.sin(mid) };
  const at = { x: arc.center.x + out.x * arc.radius, y: arc.center.y + out.y * arc.radius };
  const length = arc.radius * Math.abs(arc.sweep);
  return { at, text: `R ${lengthText(arc.radius)} · ${lengthText(length)}`, normal: out, clear: 0.2 };
}

/** The rectangle's opposite corner: its typed sides ("w;d", toward the cursor) when typed, else the cursor. */
export function rectCorner(app: App): Point2 {
  const w = app.ui.wall;
  if (w.kind !== 'rect') return { x: 0, y: 0 };
  const sides = parsePoint(app.shell.measure.value);
  if (!sides.ok) return w.cursor;
  const sx = w.cursor.x < w.start.x ? -1 : 1;
  const sy = w.cursor.y < w.start.y ? -1 : 1;
  return { x: w.start.x + sx * Math.abs(sides.value.x), y: w.start.y + sy * Math.abs(sides.value.y) };
}

/** The end of the segment being drawn: the typed length (and angle) when there is one, else the cursor. */
export function drawingEnd(app: App): Point2 {
  const w = app.ui.wall;
  if (w.kind !== 'drawing') return w.kind === 'bend' ? w.end : { x: 0, y: 0 };
  const point = parsePointFrom(app.shell.measure.value, w.last);
  if (point.ok) return point.value;
  const typed = parseLengthAngle(app.shell.measure.value);
  return typed.ok && typed.value.length >= MIN_WALL_LENGTH ? typedEnd(w, typed.value.length, typed.value.angle) : w.cursor;
}

/**
 * The wall drawn from `start` to `end`, turned round when Space flipped the side: the same line, the
 * body on its other side (its exterior is on the right of its direction, so the direction is what flips).
 */
export function oriented(app: App, start: Point2, end: Point2, id: string, bulge = 0): DocWall {
  return app.ui.wallFlip ? app.makeWall(end, start, id, -bulge) : app.makeWall(start, end, id, bulge);
}

/** Space while drawing walls. */
export function toggleWallFlip(app: App): void {
  app.ui.wallFlip = !app.ui.wallFlip;
  app.refresh();
}

export function makeWall(app: App, start: Point2, end: Point2, id = newId('wall'), bulge = 0): DocWall {
  const d = app.ui.defaults;
  const wall: DocWall = {
    id,
    wallTypeId: d.wallTypeId,
    referenceLine: d.referenceLine,
    start,
    end,
    ...(bulge !== 0 ? { bulge } : {}),
    levelId: app.ui.levelId,
    baseOffset: d.baseOffset,
    top: d.top,
  };
  // Values equal to the type's are not kept on the wall: it follows its type for them.
  const own = wallOverrides(app.store.get(), wall);
  const { top, baseOffset, ...rest } = wall;
  return { ...rest, ...(own.top ? { top: top! } : {}), ...(own.baseOffset ? { baseOffset: baseOffset! } : {}) };
}

export function wallEvent(app: App, event: WallToolEvent): void {
  const r = wallTransition(app.ui.wall, event);
  // A value typed for one step (a length, a radius) never carries over to the next.
  if (r.state.kind !== app.ui.wall.kind || r.segment) app.shell.measure.value = '';
  // A chain just ended (closed on its start, Enter, Esc): the snap it showed is the old chain's, as
  // "Start · closes" left under the pointer until it moved. The next move snaps afresh.
  if (r.state.kind === 'idle' && app.ui.wall.kind !== 'idle') app.ui.snap = null;
  const was = app.ui.wall;
  app.ui.wall = r.state;
  if (r.segment || r.segments) app.shell.measure.value = '';
  if (r.segment) app.store.dispatch(addWalls([app.oriented(r.segment.start, r.segment.end, newId('wall'), r.segment.bulge ?? 0)]));
  // A rectangle's four walls, as one undo step.
  else if (r.segments) app.store.dispatch(addWalls(r.segments.map((s) => app.oriented(s.start, s.end, newId('wall')))));
  else app.refresh();
  // A chain closed on its start: its walls are the last ones added, one per step.
  if (r.segment && r.state.kind === 'idle' && (was.kind === 'drawing' || was.kind === 'bend')) app.checkLoop(was.count + 1);
}

/**
 * An outline just closed turning clockwise has each wall's exterior face (the right of its
 * direction) inside it: said, with the way back, since a house drawn that way showed its outer
 * finish on the room side and nothing told why.
 */
export function checkLoop(app: App, n: number): void {
  const loop = app.store.get().walls.slice(-n);
  if (loop.length < 3) return;
  const area = loop.reduce((s, w) => s + (w.start.x * w.end.y - w.end.x * w.start.y), 0) / 2;
  if (area >= 0) return;
  app.ui.info = t('hint.exteriorInside', { n: loop.length });
  app.renderChrome();
}

/** The footer field: a length (and angle) while drawing; a new length for one selected wall. */
export function submitMeasure(app: App, text: string): boolean {
  if (text.trim() === '') return false;
  // "3x", "x3", "3*" or "/3": a series of the copy just made (copySeries).
  const series = /^\s*(?:[x*×]\s*(\d+)|(\d+)\s*[x*×]|\/\s*(\d+))\s*$/i.exec(text);
  if (series && app.ui.tool === 'select') {
    const [, a, b, d] = series;
    return app.copySeries(Number(a ?? b ?? d), d !== undefined);
  }
  const mod = app.ui.tool === 'modify' ? app.ui.modify : null;
  if (mod) {
    // A distance for Move and Copy (units allowed); degrees or a factor for the others.
    const v = mod.kind === 'move' || mod.kind === 'copy' ? parseLength(text) : parseNumber(text);
    if (!v.ok) {
      app.ui.error = t('hint.badMeasure', { ...typingExamples(), text });
      app.renderChrome();
      return false;
    }
    app.modifyEvent({ kind: 'typed', value: v.value });
    return app.ui.error === null;
  }
  if (app.ui.guide) {
    const d = parseLength(text);
    if (!d.ok || d.value < 0) {
      app.ui.error = t('hint.badMeasure', { ...typingExamples(), text });
      app.renderChrome();
      return false;
    }
    app.ui.error = null;
    app.placeGuide(d.value);
    return true;
  }
  if (app.ui.tool === 'wall' && app.ui.wall.kind === 'bend') {
    const radius = parseLength(text);
    if (!radius.ok || radius.value <= 0) {
      app.ui.error = t('hint.badMeasure', { ...typingExamples(), text });
      app.renderChrome();
      return false;
    }
    app.ui.error = null;
    app.wallEvent({ kind: 'typedRadius', radius: radius.value });
    return true;
  }
  // A rectangle's sides, "width;depth", from its first corner toward the cursor.
  if (app.ui.tool === 'wall' && app.ui.wall.kind === 'rect') {
    const sides = parsePoint(text);
    if (!sides.ok) {
      app.ui.error = t('hint.badMeasure', { ...typingExamples(), text });
      app.renderChrome();
      return false;
    }
    app.ui.error = null;
    app.wallEvent({ kind: 'typedSides', width: Math.abs(sides.value.x), depth: Math.abs(sides.value.y) });
    return true;
  }
  // "x;y": a point, as a click there would be: the start or the next point of a wall, a floor's
  // corner, a room's point. So drawing needs no mouse (ref/chat.txt:207, 242).
  // "@dx;dy": from the point being drawn from.
  const point = parsePointFrom(text, app.ui.drawFrom);
  if (point.ok) {
    const wall = app.ui.tool === 'wall' && app.ui.wall.kind !== 'bend';
    if (!wall && app.ui.tool !== 'floor' && app.ui.tool !== 'room' && app.ui.tool !== 'measure' && app.ui.tool !== 'dimension') {
      app.ui.error = t('hint.pointHere', { text });
      app.renderChrome();
      return false;
    }
    app.ui.error = null;
    if (wall) app.wallEvent({ kind: 'click', point: point.value });
    else if (app.ui.tool === 'measure') app.measureEvent({ kind: 'click', point: point.value });
    else if (app.ui.tool === 'dimension') app.dimensionEvent({ kind: 'click', point: point.value });
    else if (app.ui.tool === 'floor') app.floorClick(point.value, 0, true);
    else app.roomClick(point.value);
    return true;
  }
  const r = parseLengthAngle(text);
  if (!r.ok || r.value.length < MIN_WALL_LENGTH) {
    app.ui.error = t('hint.badMeasure', { ...typingExamples(), text });
    app.renderChrome();
    return false;
  }
  app.ui.error = null;
  if (app.ui.tool === 'wall' && app.ui.wall.kind === 'drawing') {
    app.wallEvent({ kind: 'typed', length: r.value.length, angle: r.value.angle });
    return true;
  }
  if (app.openingKind() && app.ui.opening.kind === 'aiming') {
    app.openingEvent({ kind: 'typed', distance: r.value.length });
    return true;
  }
  if (app.openingKind()) {
    // A measure with nothing to measure along: say how to choose a wall without the pointer.
    app.ui.error = t('hint.openingNoWall');
    app.renderChrome();
    return false;
  }
  // One opening selected: the typed value is its rule's new distance.
  const openings = app.selectedOpenings();
  if (openings.length === 1 && app.ui.selection.size === 1) {
    const o = openings[0]!.opening;
    const rule = hasDistance(o.rule) ? o.rule : ruleKeepingPosition(app.store.get(), o.id, 'fromStart');
    if (rule && hasDistance(rule)) app.store.dispatch(updateOpening(o.id, { rule: { ...rule, distance: r.value.length } }));
    return true;
  }
  const sel = app.selectedWalls();
  if (sel.length === 1) {
    const w = sel[0]!;
    const len = distance(w.start, w.end);
    const k = r.value.length / len;
    // Its end moved, the walls joined there going with it, as its length dimension does.
    const end = { x: w.start.x + (w.end.x - w.start.x) * k, y: w.start.y + (w.end.y - w.start.y) * k };
    app.store.dispatch(setWalls(stretchEnd(app.store.get(), w.id, 'end', end)));
    return true;
  }
  return false;
}
