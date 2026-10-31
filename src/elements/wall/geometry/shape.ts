// A wall once its type is applied. Derived on every computation, never stored.

import type { Point2 } from '../../../model/vector';
import type { ReferenceLine, Wall, WallId, WallLayer, WallType } from '../schema';
import { stackProblem } from '../../layers/stack';

export interface WallShape {
  readonly id: WallId;
  readonly start: Point2;
  readonly end: Point2;
  readonly referenceLine: ReferenceLine;
  /** 0: straight; otherwise tan(sweep / 4). Arcs are expanded into straight segments (geometry/arc.ts). */
  readonly bulge: number;
  readonly thickness: number;
  readonly layers: readonly WallLayer[];
  /** Layer boundaries along the normal, exterior face first: layer k spans [k] to [k + 1]. */
  readonly layerOffsets: readonly number[];
  /** Offsets of the core faces: first to last structure layer, or the whole wall without one. */
  readonly core: readonly [number, number];
  /** Indices of the first and last core layers, inclusive. */
  readonly coreLayers: readonly [number, number];
}

export type ShapeProblem = 'missingWallType' | 'invalidWallType';

/** Offset of the exterior face from the reference line, along the left normal. */
/** Where the exterior face lies across the reference line (along the wall's left normal), for a thickness. */
export function exteriorOffset(referenceLine: ReferenceLine, thickness: number): number {
  switch (referenceLine) {
    case 'centerline':
      return -thickness / 2;
    case 'exteriorFace':
      return 0;
    case 'interiorFace':
      return -thickness;
  }
}

/** The core: from the first to the last structure layer (inclusive), or every layer without one. */
export function coreLayersOf(layers: readonly { readonly function: string }[]): readonly [number, number] {
  const structural = layers.flatMap((l, i) => (l.function === 'structure' ? [i] : []));
  const first = structural[0];
  const last = structural[structural.length - 1];
  return first === undefined || last === undefined ? [0, layers.length - 1] : [first, last];
}

export function shapeOf(wall: Wall, type: WallType | undefined): WallShape | ShapeProblem {
  if (type === undefined) return 'missingWallType';
  const { layers } = type;
  if (stackProblem(layers) !== null) return 'invalidWallType';
  const thickness = layers.reduce((s, l) => s + l.thickness, 0);
  const layerOffsets = [exteriorOffset(wall.referenceLine, thickness)];
  for (const layer of layers) layerOffsets.push(layerOffsets[layerOffsets.length - 1]! + layer.thickness);

  const coreLayers = coreLayersOf(layers);
  const core: readonly [number, number] = [layerOffsets[coreLayers[0]]!, layerOffsets[coreLayers[1] + 1]!];

  return {
    id: wall.id,
    start: wall.start,
    end: wall.end,
    referenceLine: wall.referenceLine,
    bulge: wall.bulge ?? 0,
    thickness,
    layers,
    layerOffsets,
    core,
    coreLayers,
  };
}
