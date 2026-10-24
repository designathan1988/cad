// Temporary dimensions of the one selected element, as in Revit: a wall's length, an opening's
// distances to the ends of its wall. Each can be typed: the value becomes one command.

import { MIN_WALL_LENGTH } from '../core/tolerance';
import { add, distance, normalize, perp, type Point2, scale, sub } from '../core/vector';
import type { Command } from '../core/store';
import { updateOpening } from '../elements/opening/commands';
import { setWalls } from '../elements/wall/commands';
import { stretchEnd } from '../tools/edit';
import type { Doc } from './document';
import type { DerivedGeometry } from './geometry';

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
    if (wall.bulge) return [];
    const len = distance(wall.start, wall.end);
    const dir = normalize(sub(wall.end, wall.start));
    const half = thicknessOf(doc, wall.wallTypeId) / 2;
    return [
      {
        id: `${id}:length`,
        a: wall.start,
        b: wall.end,
        side: perp(dir),
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
  return [
    {
      id: `${id}:fromStart`,
      a: host.start,
      b: at(o.start),
      side,
      clear: half,
      value: o.start,
      apply: (v) => (v >= 0 ? updateOpening(id, { rule: { kind: 'fromStart', distance: v } }) : null),
    },
    {
      id: `${id}:fromEnd`,
      a: at(o.end),
      b: host.end,
      side,
      clear: half,
      value: len - o.end,
      apply: (v) => (v >= 0 ? updateOpening(id, { rule: { kind: 'fromEnd', distance: v } }) : null),
    },
  ];
}

const thicknessOf = (doc: Doc, typeId: string): number =>
  (doc.wallTypes.find((t) => t.id === typeId)?.layers ?? []).reduce((s, l) => s + l.thickness, 0);
