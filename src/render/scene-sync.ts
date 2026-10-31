import type { Scene3D } from './scene-3d';
import { draw } from './scene-render';
import * as THREE from 'three';
import type { DerivedGeometry } from '../project/derive';
import type { WallId } from '../elements/wall/schema';
import { wallMeshKey } from './wall-paint';
import { eachSolid } from '../elements/registry';
import type { KindSolid } from '../elements/contract';
import { type Compiling, trace, TRACE } from './scene-trace';
import { layerMaterial } from './scene-materials';
import { build, buildOpening, drop, facesOf, outline, syncBoxCaps, syncEdges } from './scene-build';
import { placeGround } from './scene-light';


/**
 * Brings the meshes in line with the geometry: only walls whose shape or state changed are rebuilt.
 * `lift`: how far up each level is drawn (an exploded view), by level id.
 */
export function sync(view: Scene3D, g: DerivedGeometry, selected: ReadonlySet<WallId>, preview: ReadonlySet<WallId>, lift: (levelId: string) => number = () => 0): void {
  const seen = new Set<WallId>();
  // Moved up or down as a whole, never rebuilt for it: the lift is not part of any key.
  const place = (id: WallId, levelId: string) => {
    const w = view.walls.get(id);
    if (w) w.group.position.y = lift(levelId);
  };
  for (const o of g.openings.values()) {
    if (!o.frame) continue;
    const id = o.opening.id;
    seen.add(id);
    const state = preview.has(id) ? 'p' : selected.has(id) ? 's' : o.valid ? 'n' : 'i';
    let shape = view.shapeKeys.get(o);
    if (shape === undefined) view.shapeKeys.set(o, (shape = JSON.stringify([o.frame, o.opening, o.bottom, o.top])));
    const key = state + (view.isOpen(id) ? 'o' : '') + shape;
    const old = view.walls.get(id);
    const levelId = g.solids.get(o.opening.wallId)?.wall.levelId ?? '';
    if (old?.key === key) {
      place(id, levelId);
      continue;
    }
    if (old) drop(view, old.group);
    const group = buildOpening(view, o, state);
    group.userData.wallId = id;
    view.scene.add(group);
    view.walls.set(id, { group, key });
    view.contentVersion++;
    place(id, levelId);
  }
  // The registry's kinds (elements/registry.ts): each gives its solid; rebuilt only when it changed.
  for (const x of eachSolid(g.kinds)) {
    // Texts and axes are drawn in plan only (no solid, no level of their own for an axis).
    if (!x.kind.solid || x.levelId === null) continue;
    seen.add(x.id);
    const state = selected.has(x.id) ? 's' : 'n';
    let k = view.shapeKeys.get(x.solid as object);
    // What it derives (its level's heights too), not only the element: raising the level rebuilds it.
    if (k === undefined) view.shapeKeys.set(x.solid as object, (k = JSON.stringify(x.solid)));
    const key = state + k;
    const old = view.walls.get(x.id);
    if (old?.key === key) {
      place(x.id, x.levelId);
      continue;
    }
    if (old) drop(view, old.group);
    const made = x.kind.solid?.(x.solid);
    if (!made) continue;
    const group = new THREE.Group();
    // One solid, or several (an object's parts), each in a scene material or a project material.
    for (const part of Array.isArray(made) ? (made as readonly KindSolid[]) : [made as KindSolid]) {
      const material = state === 's' ? view.materials.sideSel : typeof part.material === 'string' ? view.materials[part.material] : layerMaterial(view, part.material);
      const mesh = new THREE.Mesh(part.geometry, material);
      mesh.position.y = part.y;
      if (part.edges) mesh.add(outline(view, part.geometry));
      group.add(mesh);
      // A luminaire's light in the view: a point light falling off as light does, its strength from
      // its lumens. The view is lit as by day (the sun's 1.5 is not lux): a lamp in candelas washed the
      // floor under it out to white, so its lumens are scaled for 900 lm to light the floor 1.75 m
      // under it at about a third of the sun. It goes through walls: the view casts no shadows.
      for (const l of part.lights ?? []) {
        const light = new THREE.PointLight(l.color, l.lumens * LAMP_SCALE, 0, 2);
        light.position.set(l.x, part.y + l.z, -l.y);
        group.add(light);
      }
    }
    group.userData.wallId = x.id;
    view.scene.add(group);
    view.walls.set(x.id, { group, key });
    view.contentVersion++;
    place(x.id, x.levelId);
  }
  const faces = facesOf(view, g);
  for (const s of g.solids.values()) {
    seen.add(s.wall.id);
    // A material's colour or finish changed keeps the walls' meshes: their materials take it here.
    for (const m of s.materials) layerMaterial(view, m);
    const state = preview.has(s.wall.id) ? 'p' : selected.has(s.wall.id) ? 's' : 'n';
    // The shape's part of the key, once per solid: solids are only replaced when the geometry is
    // computed again, and a switch of view (148 walls) stringified every block each time.
    let shape = view.shapeKeys.get(s);
    // What shows of a wall depends on its neighbours too (faces.ts): their faces are in the key.
    const mine = faces.get(s.wall.id) ?? [];
    if (shape === undefined) view.shapeKeys.set(s, (shape = wallMeshKey('', s.blocks, s.materials) + JSON.stringify(mine)));
    // A wall's phase (its id's, an arc's segments being "id#k") colours it whole.
    const phase = view.phases.get(s.wall.id.split('#')[0]!);
    const key = state + (phase ?? '') + shape;
    const old = view.walls.get(s.wall.id);
    if (old?.key === key) {
      place(s.wall.id, s.wall.levelId);
      continue;
    }
    if (old) drop(view, old.group);
    const group = build(view, s, state, mine, phase);
    group.userData.wallId = s.wall.id;
    view.scene.add(group);
    view.walls.set(s.wall.id, { group, key });
    view.contentVersion++;
    place(s.wall.id, s.wall.levelId);
  }
  for (const [id, w] of view.walls) {
    if (!seen.has(id)) {
      drop(view, w.group);
      view.walls.delete(id);
    }
  }
  syncEdges(view, g, lift);
  view.lastSync = { g, lift };
  syncBoxCaps(view);
  placeGround(view, g);
  view.invalidate();
}

/**
 * The view as it is, drawn once larger (its long side `long` pixels, the drawing buffer's limit
 * at most) for a picture: the same camera, framing, sun and shadows; the view back to the screen's
 * size after. A PNG, or null when the browser gives none.
 */
export async function snapshot(view: Scene3D, long: number): Promise<Blob | null> {
  // Traced, the scene first built as it is now (in the background, as for the view).
  if (view.style === 'photo') {
    for (let n = 0; n < 5 && (view.traceBuild || view.traced.content !== view.contentVersion); n++) {
      if (!view.traceBuild) trace(view);
      await view.traceBuild;
    }
    // And its shader compiled (the first time, in the background): set going by a first sample, waited
    // for two minutes at most.
    view.tracer?.renderSample();
    for (const until = performance.now() + 120_000; view.tracer && (view.tracer as Compiling).isCompiling && performance.now() < until; ) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  const w = view.canvas.clientWidth;
  const h = view.canvas.clientHeight;
  if (w === 0 || h === 0) return null;
  const gl = view.renderer.getContext();
  const max = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number, ...(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array));
  const k = Math.min(long, max) / Math.max(w, h);
  const W = Math.round(w * k);
  const H = Math.round(h * k);
  const ratio = view.renderer.getPixelRatio();
  view.renderer.setPixelRatio(1);
  view.renderer.setSize(W, H, false);
  if (view.shift.x !== 0 || view.shift.y !== 0) view.camera.setViewOffset(W, H, view.shift.x * k, view.shift.y * k, W, H);
  view.camera.updateProjectionMatrix();
  // The shadows as fine as the picture: their map four times the screen's, as far as the card goes;
  // at the screen's size their edges came out in steps.
  const shadow = view.sun.shadow;
  const screenMap = shadow.mapSize.x;
  const fine = Math.min(screenMap * 4, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
  const remap = (size: number) => {
    shadow.mapSize.set(size, size);
    shadow.map?.dispose();
    shadow.map = null;
  };
  if (view.shadows && fine > screenMap) remap(fine);
  draw(view, W, H, true);
  // Traced, the picture keeps sampling until it is clean (the quality's picture count, a minute of queuing at most): one
  // frame of the tracer is a sample, noise.
  if (view.style === 'photo' && view.tracer && view.traceScene) {
    // No fade from its coarse preview: timed by the clock, it had barely begun when the samples, queued
    // in a tenth of a second, were done, and the picture came out mostly the preview's noise.
    const fade = view.tracer.fadeDuration;
    view.tracer.fadeDuration = 0;
    const until = performance.now() + 60_000;
    while (view.tracer.samples < TRACE[view.quality].picture && performance.now() < until) view.tracer.renderSample();
    view.tracer.fadeDuration = fade;
  }
  // Taken now, before the next frame clears the drawing buffer.
  const blob = new Promise<Blob | null>((done) => view.canvas.toBlob(done, 'image/png'));
  if (shadow.mapSize.x !== screenMap) remap(screenMap);
  view.renderer.setPixelRatio(ratio);
  view.renderer.setSize(w, h, false);
  // The next frame sets the projection for the screen again.
  view.offsetDirty = true;
  view.invalidate();
  return blob;
}

/** A luminaire's point light per lumen: 900 lm give the floor 1.75 m under it about 0.5, a third of the sun. */
export const LAMP_SCALE = (0.5 * 1.75 * 1.75) / 900;
