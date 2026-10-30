// A door or window model seen in 3D, still (the doors and windows store, openings-dialog.ts): its parts
// (elements/opening/parts.ts) in a piece of wall around it, from a three-quarter view in front, as an
// image. Drawn on the objects' stage (object-snapshot.ts).

import * as THREE from 'three';
import type { Point2 } from '../model/vector';
import { openingParts } from '../elements/opening/parts';
import { newOpening } from '../elements/opening/schema';
import type { OpeningModel } from '../elements/opening/style';
import { prism } from '../elements/prisms';
import { meshSnapshot } from './object-snapshot';
import { materialIn, SEE_THROUGH } from '../elements/material/schema';
import { previewMesh } from '../elements/object/textures';

/** The wall around it: this much beyond each jamb, over the head and its thickness (m). */
const MARGIN = 0.5;
const THICK = 0.18;

const look = (color: string, roughness: number, metalness = 0, opacity?: number) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...(opacity === undefined ? {} : { transparent: true, opacity }) });

/** The picture as a data URL, w × h device pixels; null with no WebGL. */
export function openingSnapshot(m: OpeningModel, w: number, h: number): string | null {
  const width = m.width;
  const bottom = m.sill;
  const top = m.sill + m.height;
  const face = THICK / 2;
  const frame = { start: { x: 0, y: 0 }, end: { x: width, y: 0 }, dir: { x: 1, y: 0 }, normal: { x: 0, y: 1 }, faces: [-face, face] as const, region: [] };
  const opening = newOpening('snapshot', 'wall', m.kind, { kind: 'fromStart', distance: 0 }, { width, height: m.height, sill: m.sill, swing: 'right', style: { ...m.style, open: m.style.open ?? 0.35 } });
  const meshes: THREE.Mesh[] = [];
  const wallTop = top + MARGIN;
  // The wall: a block each side, one over the head, one under a window's sill.
  const block = (x0: number, x1: number, z0: number, z1: number) => {
    if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) return;
    const poly: Point2[] = [{ x: x0, y: -face }, { x: x1, y: -face }, { x: x1, y: face }, { x: x0, y: face }];
    meshes.push(new THREE.Mesh(prism(poly, z0, z1), look('#e9e5de', 0.9)));
  };
  block(-MARGIN, 0, 0, wallTop);
  block(width, width + MARGIN, 0, wallTop);
  block(0, width, top, wallTop);
  block(0, width, 0, bottom);
  // A floor under it, a little wider than the wall.
  meshes.push(new THREE.Mesh(prism([{ x: -MARGIN - 0.2, y: -0.6 }, { x: width + MARGIN + 0.2, y: -0.6 }, { x: width + MARGIN + 0.2, y: 0.6 }, { x: -MARGIN - 0.2, y: 0.6 }], -0.02, 0), look('#b9b2a6', 0.8)));
  for (const part of openingParts({ opening, start: 0, end: width, bottom, top }, frame, false)) {
    const geo = prism(part.polygon, part.bottom, part.top);
    if (part.turn) {
      const { origin, axis, angle } = part.turn;
      const o3 = new THREE.Vector3(origin.x, origin.z, -origin.y);
      const r = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(axis.x, 0, -axis.y).normalize(), angle);
      geo.applyMatrix4(new THREE.Matrix4().makeTranslation(-o3.x, -o3.y, -o3.z)).applyMatrix4(r).applyMatrix4(new THREE.Matrix4().makeTranslation(o3.x, o3.y, o3.z));
    }
    // In the model's own materials where it sets them (frosted glass too), else a timber leaf in a white frame.
    const own = part.role === 'leaf' ? m.style.leafMaterial : part.role === 'frame' ? m.style.frameMaterial : m.style.glazing === 'frosted' ? 'frostedGlass' : undefined;
    if (own) {
      const mat = materialIn([], own);
      meshes.push(previewMesh(geo, mat, SEE_THROUGH[mat.id]));
      continue;
    }
    const material = part.role === 'glass' ? look('#a9c8d8', 0.05, 0, 0.45) : part.role === 'leaf' ? look(m.kind === 'door' ? '#a06c43' : '#f4f4f2', 0.55) : look('#f4f4f2', 0.5);
    meshes.push(new THREE.Mesh(geo, material));
  }
  // From the front (the wall's −y side, three.js's +z), a little to the side and above.
  return meshSnapshot(meshes, w, h, 0.62, 0.3);
}
