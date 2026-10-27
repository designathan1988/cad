// A definition seen in 3D, still (the objects dialog's detail, objects-dialog.ts): its pieces at its first
// type in their materials, lit, from a three-quarter view above, as an image. One renderer for every
// picture, made the first time one is asked for, so the dialog's redraws do not each take a context.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SEE_THROUGH } from '../elements/material/schema';
import { previewMesh } from '../render/pattern-texture';
import type { Doc } from '../app/document';
import { cutGeometries } from '../elements/kinds/object';
import { evaluateObject } from '../elements/object/evaluate';
import type { ObjectDefinition } from '../elements/object/schema';

type Stage = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; group: THREE.Group };
let stage: Stage | null = null;

/** The stage, or null where the browser has no WebGL (the picture is then left out). */
function stageOf(): Stage | null {
  if (stage) return stage;
  const canvas = document.createElement('canvas');
  if (!canvas.getContext('webgl2')) return null;
  // Read back as an image right after drawing: the buffer kept until then.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  const scene = new THREE.Scene();
  // A room's light around it, as the realistic 3D has: what metals, mirrors and glazes reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(3, 6, 4);
  const group = new THREE.Group();
  scene.add(sun, group);
  stage = { renderer, scene, camera: new THREE.PerspectiveCamera(35, 4 / 3, 0.01, 200), group };
  return stage;
}

/** The picture as a data URL, w × h device pixels, at the given type (its first by default); null with nothing to draw or no WebGL. */
export function objectSnapshot(def: ObjectDefinition, doc: Doc, w: number, h: number, typeId = def.types[0]?.id ?? ''): string | null {
  const ev = evaluateObject(def, { id: 'snapshot', levelId: '', definitionId: def.id, typeId, at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: doc.definitions, materials: doc.materials });
  if (ev.pieces.length === 0) return null;
  // Glass seen through, as in the 3D view (scene-3d.ts).
  return meshSnapshot(cutGeometries(ev.pieces).map(({ piece: p, geometry }) => previewMesh(geometry, p.material, SEE_THROUGH[p.material.id])), w, h);
}

/**
 * Meshes pictured on the stage, framed whole from a three-quarter view above (yaw, pitch in radians), as a
 * data URL; null with no WebGL. The meshes are the stage's until the next picture (then disposed).
 */
export function meshSnapshot(meshes: readonly THREE.Mesh[], w: number, h: number, yaw = 0.65, pitch = 0.45): string | null {
  const s = stageOf();
  if (!s) return null;
  for (const c of [...s.group.children]) {
    const m = c as THREE.Mesh;
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
    s.group.remove(c);
  }
  const box = new THREE.Box3();
  for (const mesh of meshes) {
    s.group.add(mesh);
    box.expandByObject(mesh);
  }
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(0.2, box.getSize(new THREE.Vector3()).length() / 2);
  s.renderer.setSize(w, h, false);
  s.camera.aspect = w / h;
  const dist = (radius / Math.sin((s.camera.fov * Math.PI) / 360)) * 1.05;
  s.camera.position.set(centre.x + dist * Math.cos(pitch) * Math.sin(yaw), centre.y + dist * Math.sin(pitch), centre.z + dist * Math.cos(pitch) * Math.cos(yaw));
  s.camera.lookAt(centre);
  s.camera.updateProjectionMatrix();
  s.renderer.render(s.scene, s.camera);
  return s.renderer.domElement.toDataURL('image/png');
}
