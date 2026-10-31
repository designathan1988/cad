// A frame of the 3D view: the size kept, the composer or the tracer drawn, the loop asked again.

import type { Scene3D } from './scene-3d';
import * as THREE from 'three';
import { photoSky, trace } from './scene-trace';
import { effects } from './scene-light';

/** One frame as the look draws it: hidden lines with every surface white for the frame, then put back. */
export function draw(view: Scene3D, w: number, h: number, resized: boolean): void {
  const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
  if (view.style === 'hidden')
    for (const { group } of view.walls.values())
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        swapped.push([mesh, mesh.material]);
        mesh.material = view.hiddenFace;
      });
  if (view.style !== 'photo' && view.preparing) {
    view.preparing = false;
    view.onTracePreparing(false);
  }
  if (view.style === 'photo' && !view.xrayOn && view.clip.length === 0 && trace(view)) {
    for (const [mesh, m] of swapped) mesh.material = m;
    return;
  }
  // The photorealistic style's raster frames on the trace's sky and ground (photoGround).
  const photo = view.style === 'photo';
  const background = view.scene.background;
  const grid = view.grid.visible;
  const shadowGround = view.shadowGround.visible;
  // The realistic style on its fading ground: a room with no floor showed the background
  // through it, a black hole among the walls in the dark theme. The other styles stand on the grid.
  const realGround = view.style === 'realistic';
  if (realGround) view.ground.visible = true;
  if (photo) {
    view.scene.background = photoSky(view);
    const size = Math.max(200, view.ground.scale.x * 6);
    view.photoGround.scale.set(size, 1, size);
    view.photoGround.position.set(view.ground.position.x, view.stand - 0.002, view.ground.position.z);
    view.photoGround.visible = true;
    view.grid.visible = false;
    view.shadowGround.visible = false;
  }
  const fx = effects(view, w, h);
  if (fx) {
    if (resized) {
      fx.setPixelRatio(view.renderer.getPixelRatio());
      fx.setSize(w, h);
    }
    fx.render();
  } else view.renderer.render(view.scene, view.camera);
  if (realGround) view.ground.visible = false;
  if (photo) {
    view.scene.background = background;
    view.photoGround.visible = false;
    view.grid.visible = grid;
    view.shadowGround.visible = shadowGround;
  }
  for (const [mesh, m] of swapped) mesh.material = m;
}

export function render(view: Scene3D): void {
  view.raf = 0;
  if (!view.needsRender) return;
  view.needsRender = false;
  const w = view.canvas.clientWidth;
  const h = view.canvas.clientHeight;
  if (w === 0 || h === 0) return;
  const size = view.renderer.getSize(new THREE.Vector2());
  const resized = size.x !== w || size.y !== h || view.offsetDirty;
  if (resized) {
    view.renderer.setSize(w, h, false);
    view.persp.aspect = w / h;
    Object.assign(view.ortho, { left: -view.orthoHalf * (w / h), right: view.orthoHalf * (w / h), top: view.orthoHalf, bottom: -view.orthoHalf });
    // Framed beside a panel: the view's centre is the part it left visible (see shift).
    if (view.shift.x !== 0 || view.shift.y !== 0) view.camera.setViewOffset(w, h, view.shift.x, view.shift.y, w, h);
    else view.camera.clearViewOffset();
    view.camera.updateProjectionMatrix();
    view.offsetDirty = false;
  }
  draw(view, w, h, resized);
  // The projection changed (first frame, new size, panel): what is placed over the view by
  // projecting through the camera (the handles, the cube) must be placed again.
  if (resized) view.onChange();
}
