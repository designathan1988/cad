// Temporary dimensions of the one selected element, as in Revit: a wall's length, an opening's
// distances to the nearest wall meeting its own on each side (its face; the wall's end when none), or,
// on the side of the opening it is measured from, the gap to that one. Each can be typed: the value
// becomes one command.

import { MIN_WALL_LENGTH } from '../core/tolerance';
import { add, distance, normalize, perp, type Point2, scale, sub } from '../core/vector';
import type { Command } from '../core/store';
import { updateOpening } from '../elements/opening/commands';
import { setWalls } from '../elements/wall/commands';
import { bulgeKeepingSide } from '../tools/arc-edit';
import { stretchEnd } from '../tools/edit';
import { arcOf } from '../elements/wall/geometry/arc';
import type { Doc } from './document';
import type { DerivedGeometry } from './geometry';
import { stopAfter, stopBefore, wallStops } from './wall-stops';

export interface TempDim {
  readonly id: string;
  /** Measured between these two points, on the reference line. */
  readonly a: Point2;
  readonly b: Point2;
  /** Which side to draw it on (unit), and how far its line clears the element (m). */
  readonly side: Point2;
  readonly clear: number;
  readonly value: number;
  /** The command for a typed value, or null when the value cannot be applied. */
  readonly apply: (value: number) => Command<Doc> | null;
}

export function tempDims(doc: Doc, g: DerivedGeometry, selection: ReadonlySet<string>): TempDim[] {
  if (selection.size !== 1) return [];
  const id = [...selection][0]!;
  const wall = doc.walls.find((w) => w.id === id);
  if (wall) {
    if (wall.bulge) return arcDims(doc, wall);
    const len = distance(wall.start, wall.end);
    const dir = normalize(sub(wall.end, wall.start));
    const half = thicknessOf(doc, wall.wallTypeId) / 2;
    return [
      {
        id: `${id}:length`,
        a: wall.start,
        b: wall.end,
        side: quieterSide(doc, wall, dir),
        clear: half,
        value: len,
        apply: (v) => (v >= MIN_WALL_LENGTH ? setWalls(stretchEnd(doc, id, 'end', add(wall.start, scale(dir, v)))) : null),
      },
    ];
  }
  const o = g.openings.get(id);
  if (!o) return [];
  const host = doc.walls.find((w) => w.id === o.opening.wallId);
  if (!host || host.bulge) return [];
  const len = distance(host.start, host.end);
  const dir = normalize(sub(host.end, host.start));
  const at = (s: number) => add(host.start, scale(dir, s));
  const half = thicknessOf(doc, host.wallTypeId) / 2;
  const side = perp(dir);
  const stops = wallStops(doc, host.id);
  const before = stopBefore(stops, o.start);
  const after = stopAfter(stops, o.end, len);
  // A distance below zero means the opening runs past that end: there is nothing to measure there.
  const dims: TempDim[] = [
    {
      id: `${id}:fromStart`,
      a: at(before),
      b: at(o.start),
      side,
      clear: half,
      value: o.start - before,
      apply: (v) => (v >= 0 ? updateOpening(id, { rule: { kind: 'fromStart', distance: before + v } }) : null),
    },
    {
      id: `${id}:fromEnd`,
      a: at(o.end),
      b: at(after),
      side,
      clear: half,
      value: after - o.end,
      apply: (v) => (v >= 0 ? updateOpening(id, { rule: { kind: 'fromEnd', distance: len - after + v } }) : null),
    },
  ];
  // Measured from another opening: on that side, the gap to it, and a typed value keeps the rule.
  const rule = o.opening.rule;
  const ref = rule.kind === 'fromOpening' ? g.openings.get(rule.openingId) : undefined;
  if (rule.kind === 'fromOpening' && ref && ref.opening.wallId === host.id) {
    const after = rule.toward === 'end';
    dims[after ? 0 : 1] = {
      id: `${id}:fromOpening`,
      a: after ? at(ref.end) : at(o.end),
      b: after ? at(o.start) : at(ref.start),
      side,
      clear: half,
      value: after ? o.start - ref.end : ref.start - o.end,
      apply: (v) => (v >= 0 ? updateOpening(id, { rule: { ...rule, distance: v } }) : null),
    };
  }
  return dims.filter((x) => x.value >= 0);
}

/**
 * An arc's chord, on the side away from its bulge, and its radius, from the centre to the arc. A typed chord moves the end along it and keeps the sweep; a typed radius keeps the ends.
 */
function arcDims(doc: Doc, wall: Doc['walls'][number]): TempDim[] {
  const arc = arcOf({ start: wall.start, end: wall.end, bulge: wall.bulge ?? 0 });
  if (!arc) return [];
  const bulge = wall.bulge ?? 0;
  const chord = distance(wall.start, wall.end);
  const dir = normalize(sub(wall.end, wall.start));
  // The radius is shown along the radius at 30 % of the sweep, not the middle one: on the middle one
  // its value sat against the chord's (the tester's K03).
  const along = arc.startAngle + arc.sweep * 0.3;
  const onArc = add(arc.center, scale({ x: Math.cos(along), y: Math.sin(along) }, arc.radius));
  const across = normalize(sub(onArc, arc.center));
  return [
    {
      id: `${wall.id}:chord`,
      a: wall.start,
      b: wall.end,
      // A positive bulge lies right of the chord: the dimension goes on its left.
      side: bulge > 0 ? perp(dir) : scale(perp(dir), -1),
      clear: thicknessOf(doc, wall.wallTypeId) / 2,
      value: chord,
      apply: (v) => (v >= MIN_WALL_LENGTH ? setWalls(stretchEnd(doc, wall.id, 'end', add(wall.start, scale(dir, v)))) : null),
    },
    {
      id: `${wall.id}:radius`,
      a: arc.center,
      b: onArc,
      side: perp(across),
      clear: 0,
      value: arc.radius,
      apply: (v) => {
        const next = bulgeKeepingSide(chord, bulge, v);
        return next === null ? null : setWalls([{ ...wall, bulge: next }]);
      },
    },
  ];
}

const thicknessOf = (doc: Doc, typeId: string): number =>
  (doc.wallTypes.find((t) => t.id === typeId)?.layers ?? []).reduce((s, l) => s + l.thickness, 0);

/**
 * The side of a straight wall where fewer walls stand on its flank (Ts): its length is drawn there, so
 * the label does not sit over a wall's end (the test run of 2026-10-25). The left one on a tie.
 */
function quieterSide(doc: Doc, wall: Doc['walls'][number], dir: Point2): Point2 {
  const left = perp(dir);
  const len = distance(wall.start, wall.end);
  const reach = thicknessOf(doc, wall.wallTypeId) / 2 + 0.05;
  let balance = 0;
  for (const w of doc.walls) {
    if (w.id === wall.id || w.levelId !== wall.levelId) continue;
    for (const [e, other] of [
      [w.start, w.end],
      [w.end, w.start],
    ] as const) {
      const v = sub(e, wall.start);
      const along = v.x * dir.x + v.y * dir.y;
      const across = v.x * left.x + v.y * left.y;
      // An end on this wall's body, away from its ends: a wall standing on its flank.
      if (along <= reach || along >= len - reach || Math.abs(across) > reach) continue;
      const body = sub(other, e);
      balance += Math.sign(body.x * left.x + body.y * left.y);
    }
  }
  return balance > 0 ? scale(left, -1) : left;
}
