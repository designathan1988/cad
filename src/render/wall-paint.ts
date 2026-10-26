// What colours each block of a wall in 3D (pure): its layer's material (elements/material), as in plan
// and in the type thumbnails (ui/swatch.ts); the selection or the preview over the layers; the plain
// wall colours when the type is missing. The scene turns these into its materials.

import type { Block } from '../elements/opening/void';
import type { Material } from '../elements/material/schema';

/** One of the scene's own materials by name, or a project material. */
export type Paint = 'preview' | 'sideSel' | 'topSel' | 'side' | 'top' | Material;

export function blockPaint(materials: readonly Material[], layerIndex: number, state: 'p' | 's' | 'n'): { side: Paint; top: Paint } {
  if (state === 'p') return { side: 'preview', top: 'preview' };
  if (state === 's') return { side: 'sideSel', top: 'topSel' };
  const m = materials[layerIndex];
  return m ? { side: m, top: m } : { side: 'side', top: 'top' };
}

/** When a wall's meshes are built again: its state, its blocks, and what colours them. */
export const wallMeshKey = (state: string, blocks: readonly Block[], materials: readonly Material[]): string =>
  state + JSON.stringify(blocks) + JSON.stringify(materials.map((m) => m.id));
