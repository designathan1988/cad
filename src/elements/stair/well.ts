// Stair wells: a stair leaves the floor it reaches open over its steps (Revit's Shaft Opening, made by
// the stair itself). A floor whose top is within WELL_REACH of a stair's top is cut by its footprint.

import type { Doc } from '../../project/doc';
import type { Point2 } from '../../model/vector';
import { type StairSolid, stairSolid, stairWell } from './geometry';
import { type Stair, WELL_REACH } from './schema';
import type { LevelId } from '../../project/doc';

/** The stair as built, from its level. */
export function solidOfStair(doc: Doc, s: Stair) {
  const level = doc.levels.find((l) => l.id === s.levelId) ?? { elevation: 0, height: 2.8 };
  return stairSolid(s, level.height, level.elevation);
}

/** The top step's far edge, where the stair arrives on the floor above: its two ends. */
export function arrivalOf(s: StairSolid): [Point2, Point2] | null {
  const end = s.walk.at(-1);
  const before = s.walk.at(-2);
  if (!end || !before) return null;
  const l = Math.hypot(end.x - before.x, end.y - before.y) || 1;
  const across = { x: -(end.y - before.y) / l, y: (end.x - before.x) / l };
  const h = s.stair.width / 2;
  return [
    { x: end.x - across.x * h, y: end.y - across.y * h },
    { x: end.x + across.x * h, y: end.y + across.y * h },
  ];
}

/** The level a stair arrives at: the one whose floor is nearest its top, within WELL_REACH. */
export function levelReached(doc: Doc, s: Stair): LevelId | null {
  const solid = solidOfStair(doc, s);
  const top = solid.bottom + solid.height;
  const best = [...doc.levels].sort((a, b) => Math.abs(a.elevation - top) - Math.abs(b.elevation - top))[0];
  return best && best.id !== s.levelId && Math.abs(best.elevation - top) <= WELL_REACH ? best.id : null;
}

/** The wells of the stairs reaching height z (their own well not turned off), each with its stair. */
export function wellsReaching(doc: Doc, z: number): { stair: Stair; well: Point2[] }[] {
  return doc.stairs.flatMap((s) => {
    if (s.well === false) return [];
    const solid = solidOfStair(doc, s);
    if (Math.abs(solid.bottom + solid.height - z) > WELL_REACH) return [];
    const well = stairWell(solid);
    return well.length >= 3 ? [{ stair: s, well }] : [];
  });
}
