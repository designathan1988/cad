// Test walls carry their layers inline; engineInput turns them into Walls plus a type map.

import { computeWallGeometry } from '../../../src/elements/wall/geometry/footprint';
import type {
  LayerFunction,
  ReferenceLine,
  Wall,
  WallLayer,
  WallType,
  WallId,
  WallTypeId,
} from '../../../src/elements/wall/schema';

export interface XYPoint {
  readonly x: number;
  readonly y: number;
}

export interface TestWall {
  readonly id: WallId;
  readonly start: XYPoint;
  readonly end: XYPoint;
  readonly referenceLine: ReferenceLine;
  readonly layers: readonly WallLayer[];
  readonly thickness: number;
  /** 0 or absent: straight. Otherwise tan(sweep / 4), positive counter-clockwise. */
  readonly bulge?: number;
}

export const layer = (thickness: number, fn: LayerFunction = 'structure'): WallLayer => ({
  thickness,
  function: fn,
  materialId: fn,
});

export function testWall(
  id: WallId,
  start: XYPoint,
  end: XYPoint,
  layers: number | readonly WallLayer[],
  referenceLine: ReferenceLine = 'centerline',
): TestWall {
  const ls = typeof layers === 'number' ? [layer(layers)] : layers;
  return { id, start, end, referenceLine, layers: ls, thickness: ls.reduce((s, l) => s + l.thickness, 0) };
}

/** One type per distinct layer list, so walls with the same layers share a type. */
export function engineInput(ws: readonly TestWall[]): { walls: Wall[]; types: Map<WallTypeId, WallType> } {
  const types = new Map<WallTypeId, WallType>();
  const walls = ws.map((w) => {
    const id = JSON.stringify(w.layers);
    if (!types.has(id)) types.set(id, { id, name: id, layers: w.layers });
    return { id: w.id, wallTypeId: id, start: w.start, end: w.end, referenceLine: w.referenceLine, ...(w.bulge ? { bulge: w.bulge } : {}) };
  });
  return { walls, types };
}

export const geometry = (ws: readonly TestWall[]) => {
  const { walls, types } = engineInput(ws);
  return computeWallGeometry(walls, types);
};
