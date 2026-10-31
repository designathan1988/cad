// A definition seen in 3D, still (the objects dialog's detail, objects-dialog.ts): its pieces at its first
// type in their materials, lit, from a three-quarter view above, as an image. One renderer for every
// picture, made the first time one is asked for, so the dialog's redraws do not each take a context.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SEE_THROUGH } from '../elements/material/schema';
import { previewMesh } from '../elements/object/textures';
import type { Doc } from '../project/doc';
import { cutGeometries } from '../elements/kinds/object';
import { evaluateObject } from '../elements/object/evaluate';
import type { ObjectDefinition } from '../elements/object/schema';
import { standInObjectId } from '../elements/object/schema';
import { NO_LEVEL } from '../project/doc';

type Stage = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; group: THREE.Group; sun: THREE.DirectionalLight; ground: THREE.Mesh };
const shared = { stage: null as Stage | null };
/** Each picture drawn at this many times its size (see meshSnapshot). */
const SUPERSAMPLE = 2;

/** The stage, or null where the browser has no WebGL (the picture is then left out). */
function stageOf(): Stage | null {
  if (shared.stage) return shared.stage;
  const canvas = document.createElement('canvas');
  if (!canvas.getContext('webgl2')) return null;
  // Read back as an image right after drawing: the buffer kept until then.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  // Lit as the realistic 3D view: filmic tone mapping, so whites are not flat and blown out.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  // A room's light around it, as the realistic 3D has: what metals, mirrors and glazes reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();
  // A soft fill, and a key light from the side and above casting shadows: faces turned to it and away
  // from it read apart, a leaf's edge and a wall's thickness show, and what stands casts its shadow (lit
  // only from the front, a door, its frame and the wall read as one flat sheet).
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6f7480, 0.55));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  // The floor under it: only its shadow drawn.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.28 }));
  ground.receiveShadow = true;
  const group = new THREE.Group();
  scene.add(sun, sun.target, ground, group);
  shared.stage = { renderer, scene, camera: new THREE.PerspectiveCamera(35, 4 / 3, 0.01, 200), group, sun, ground };
  return shared.stage;
}

/** The picture as a data URL, w × h device pixels, at the given type (its first by default); null with nothing to draw or no WebGL. */
export function objectSnapshot(def: ObjectDefinition, doc: Doc, w: number, h: number, typeId = def.types[0]?.id ?? ''): string | null {
  const ev = evaluateObject(def, { id: standInObjectId('snapshot'), levelId: NO_LEVEL, definitionId: def.id, typeId, at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: doc.definitions, materials: doc.materials });
  if (ev.pieces.length === 0) return null;
  // Glass seen through, as in the 3D view (scene-3d.ts).
  return meshSnapshot(cutGeometries(ev.pieces).map(({ piece: p, geometry }) => previewMesh(geometry, p.material, SEE_THROUGH[p.material.id])), w, h);
}

/**
 * Meshes pictured on the stage, framed whole from a three-quarter view above (yaw, pitch in radians), as a
 * data URL; null with no WebGL. The meshes are the stage's until the next picture (then disposed).
 */
export function meshSnapshot(meshes: readonly THREE.Mesh[], w: number, h: number, yaw = 0.7, pitch = 0.42): string | null {
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
  for (const mesh of meshes) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  // The key light from the camera's left and above, its shadow camera round the meshes; the ground under them.
  const key = new THREE.Vector3(Math.sin(yaw - 0.9), 1.3, Math.cos(yaw - 0.9)).normalize().multiplyScalar(radius * 4);
  s.sun.position.copy(centre).add(key);
  s.sun.target.position.copy(centre);
  s.sun.target.updateMatrixWorld();
  const sc = s.sun.shadow.camera;
  sc.left = sc.bottom = -radius * 1.6;
  sc.right = sc.top = radius * 1.6;
  sc.near = radius * 0.5;
  sc.far = radius * 8;
  sc.updateProjectionMatrix();
  s.ground.position.set(centre.x, box.min.y - 0.001, centre.z);
  s.ground.scale.set(radius * 8, 1, radius * 8);
  // Drawn at twice the size and scaled down by the image: edges smooth even where the browser gives no
  // multisampling (it read stepped at 1:1), and sharp on a high-density screen.
  s.renderer.setSize(w * SUPERSAMPLE, h * SUPERSAMPLE, false);
  s.camera.aspect = w / h;
  const dist = (radius / Math.sin((s.camera.fov * Math.PI) / 360)) * 1.05;
  s.camera.position.set(centre.x + dist * Math.cos(pitch) * Math.sin(yaw), centre.y + dist * Math.sin(pitch), centre.z + dist * Math.cos(pitch) * Math.cos(yaw));
  s.camera.lookAt(centre);
  s.camera.updateProjectionMatrix();
  s.renderer.render(s.scene, s.camera);
  return s.renderer.domElement.toDataURL('image/png');
}
