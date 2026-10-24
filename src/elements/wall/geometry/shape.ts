// A wall once its type is applied. Derived on every computation, never stored.

import type { Point2 } from '../../../core/vector';
import type { ReferenceLine, Wall, WallId, WallLayer, WallType } from '../schema';

export interface WallShape {
  readonly id: WallId;
  readonly start: Point2;
  readonly end: Point2;
  readonly referenceLine: ReferenceLine;
  readonly thickness: number;
  readonly layers: readonly WallLayer[];
  /** Layer boundaries along the normal, exterior face first: layer k spans [k] to [k + 1]. */
  readonly layerOffsets: readonly number[];
  /** Offsets of the core faces: first to last structure layer, or the whole wall without one. */
  readonly core: readonly [number, number];
}

export type ShapeProblem = 'missingWallType' | 'invalidWallType';

/** Offset of the exterior face from the reference line, along the left normal. */
function exteriorOffset(referenceLine: ReferenceLine, thickness: number): number {
  switch (referenceLine) {
    case 'centerline':
      return -thickness / 2;
    case 'exteriorFace':
      return 0;
    case 'interiorFace':
      return -thickness;
  }
}

export function shapeOf(wall: Wall, type: WallType | undefined): WallShape | ShapeProblem {
  if (type === undefined) return 'missingWallType';
  const { layers } = type;
  if (layers.length === 0 || layers.some((l) => !(Number.isFinite(l.thickness) && l.thickness > 0))) {
    return 'invalidWallType';
  }
  const thickness = layers.reduce((s, l) => s + l.thickness, 0);
  const layerOffsets = [exteriorOffset(wall.referenceLine, thickness)];
  for (const layer of layers) layerOffsets.push(layerOffsets[layerOffsets.length - 1]! + layer.thickness);

  const structural = layers.flatMap((l, i) => (l.function === 'structure' ? [i] : []));
  const first = structural[0];
  const last = structural[structural.length - 1];
  const core: readonly [number, number] =
    first === undefined || last === undefined
      ? [layerOffsets[0]!, layerOffsets[layers.length]!]
      : [layerOffsets[first]!, layerOffsets[last + 1]!];

  return {
    id: wall.id,
    start: wall.start,
    end: wall.end,
    referenceLine: wall.referenceLine,
    thickness,
    layers,
    layerOffsets,
    core,
  };
}
