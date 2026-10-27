// A wall type seen in 3D, still (the wall types' store, types-dialog.ts): a piece of the wall, its layers
// in their materials (patterns too), each layer stopped a little short of the one behind it so the
// build-up shows as steps at its end, as a manufacturer's sample. Drawn on the objects' stage.

import * as THREE from 'three';
import { SEE_THROUGH, materialIn, type Material } from '../elements/material/schema';
import type { WallLayer } from '../elements/wall/schema';
import { previewMesh } from '../render/pattern-texture';
import { meshSnapshot } from './object-snapshot';

const LENGTH = 1.2;
const HEIGHT = 1;
/** How much shorter each layer is than the one behind it, at the end that shows the build-up (m). */
const STEP = 0.12;

/** The picture as a data URL, w × h device pixels; null with no layers or no WebGL. */
export function wallSnapshot(layers: readonly WallLayer[], materials: readonly Material[], w: number, h: number): string | null {
  if (layers.length === 0) return null;
  const total = layers.reduce((s, l) => s + l.thickness, 0);
  const meshes: THREE.Mesh[] = [];
  // From the exterior face (the first layer, in front: three.js's +z) to the interior.
  let z = total / 2;
  layers.forEach((l, i) => {
    const t = Math.max(0.001, l.thickness);
    // The layers nearer the front stop shorter: the last (interior) runs the whole length.
    const len = LENGTH - (layers.length - 1 - i) * STEP;
    const g = new THREE.BoxGeometry(len, HEIGHT, t);
    g.translate(-LENGTH / 2 + len / 2, HEIGHT / 2, z - t / 2);
    const m = materialIn(materials, l.materialId);
    meshes.push(previewMesh(g, m, SEE_THROUGH[m.id]));
    z -= t;
  });
  return meshSnapshot(meshes, w, h, 0.75, 0.32);
}
