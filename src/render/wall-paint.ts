// What colours each block of a wall in 3D (pure): its layer function's token, as in plan and in the
// type thumbnails (ui/swatch.ts); the selection or the preview over the layers; the plain wall colours
// when the type is missing. The scene turns these names into its materials.

import type { Block } from '../elements/opening/void';
import type { WallLayer } from '../elements/wall/schema';
import { LAYER_TOKEN } from '../ui/swatch';

export type Paint = string;

export function blockPaint(layers: readonly WallLayer[], layerIndex: number, state: 'p' | 's' | 'n'): { side: Paint; top: Paint } {
  if (state === 'p') return { side: 'preview', top: 'preview' };
  if (state === 's') return { side: 'sideSel', top: 'topSel' };
  const fn = layers[layerIndex]?.function;
  return fn ? { side: LAYER_TOKEN[fn], top: LAYER_TOKEN[fn] } : { side: 'side', top: 'top' };
}

/** When a wall's meshes are built again: its state, its blocks, and what colours them. */
export const wallMeshKey = (state: string, blocks: readonly Block[], layers: readonly WallLayer[]): string =>
  state + JSON.stringify(blocks) + JSON.stringify(layers.map((l) => l.function));
