// The 3D environment: the sun's place, the shadow casters, the ground and the post effects composer.
import type { Scene3D } from './scene-3d';
import { lifelike } from './scene-materials';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { RenderQuality } from '../session/view/view-3d';
import type { DerivedGeometry } from '../project/derive';
import { eachSolid } from '../elements/registry';



/**
 * The post-processing the look needs (ambient occlusion, multisampled), built when that changes; none
 * when the quality asks none, in hidden lines and consistent colours, and while a cut or a box clips
 * (the occlusion's own pass would see what is clipped away).
 */
export function effects(view: Scene3D, w: number, h: number): EffectComposer | null {
  const ao = QUALITY[view.quality].ao && (view.style === 'shaded' || view.style === 'realistic') && view.clip.length === 0 && !view.xrayOn;
  const key = ao ? `ao|${view.orthoOn}|${view.quality}` : '';
  if (view.composer?.key !== key) {
    view.composer?.fx.dispose();
    view.composer = null;
    if (ao) {
      const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
      const fx = new EffectComposer(view.renderer, target);
      fx.setPixelRatio(view.renderer.getPixelRatio());
      fx.setSize(w, h);
      const first = new RenderPass(view.scene, view.camera);
      const gtao = new GTAOPass(view.scene, view.camera, w, h);
      gtao.blendIntensity = QUALITY[view.quality].aoBlend;
      gtao.updateGtaoMaterial({ samples: QUALITY[view.quality].aoSamples });
      fx.addPass(first);
      fx.addPass(gtao);
      fx.addPass(new OutputPass());
      view.composer = { fx, key, passes: [first, gtao] };
    }
  }
  if (!view.composer) return null;
  for (const p of view.composer.passes) p.camera = view.camera;
  return view.composer.fx;
}

/** Shadows drawn: Realistic's own; materials compiled again for them. */
export function applyShadows(view: Scene3D, recompile = false): void {
  const on = lifelike(view);
  const changed = on !== view.shadows;
  view.shadows = on;
  view.renderer.shadowMap.enabled = on;
  view.sun.castShadow = on;
  view.shadowGround.visible = on;
  placeSun(view);
  castShadows(view);
  if (changed || recompile)
    view.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      for (const x of Array.isArray(m) ? m : m ? [m] : []) x.needsUpdate = true;
    });
}

/** The lights as the style has them, from the strengths the sun set, times the view's brightness. */
export function applyLights(view: Scene3D): void {
  const s = view.style;
  const b = view.brightness;
  // π: three.js's diffuse is the albedo over π times the light, so π gives each colour as it is.
  view.ambient.intensity = s === 'consistent' ? Math.PI * b : 0;
  view.sun.intensity = (s === 'consistent' ? 0 : lifelike(view) ? view.sunBase * 2.6 : view.sunBase) * b * view.sunScale;
  view.sky.intensity = (s === 'consistent' ? 0 : lifelike(view) ? view.skyBase * 0.05 : view.skyBase) * b;
  view.fill.intensity = (s === 'shaded' || s === 'hidden' ? 0.6 : 0) * b;
  view.scene.environmentIntensity = 0.22 * b;
}

/** The view's fixed sun, far over the model's middle, its shadow camera round the model. */
export function placeSun(view: Scene3D): void {
  const c = view.ground.position;
  const reach = Math.max(10, view.ground.scale.x / GROUND_SPAN);
  // Up and to the left, far enough over the model to cast its shadows.
  const fixed = new THREE.Vector3(-8, 14, 10).normalize().multiplyScalar(reach * 2);
  view.sun.position.set(c.x + fixed.x, c.y + fixed.y, c.z + fixed.z);
  view.sun.target.position.copy(c);
  applyLights(view);
  const cam = view.sun.shadow.camera;
  cam.left = -reach * 1.5;
  cam.right = reach * 1.5;
  cam.top = reach * 1.5;
  cam.bottom = -reach * 1.5;
  cam.near = 0.5;
  cam.far = reach * 6;
  cam.updateProjectionMatrix();
  view.shadowGround.position.set(c.x, c.y + 0.001, c.z);
  view.shadowGround.scale.set(view.ground.scale.x, view.ground.scale.y, 1);
}

/** Every solid casts and takes shadows while they are on. */
export function castShadows(view: Scene3D): void {
  for (const { group } of view.walls.values())
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = view.shadows;
        o.receiveShadow = view.shadows;
      }
    });
}

/**
 * Each quality's settings: the resolution against the screen's (`ratio` times its pixel ratio, at most
 * `max`; over 1 drawn larger and shown smaller, which smooths the edges), the sun's shadow map (px a
 * side) and whether its edges are soft, and ambient occlusion with multisampling (a post-processing pass).
 */
// Each a step that shows: low, coarse pixels and hard shadows; medium, soft shadows and a light ambient
// occlusion; high, a full one; ultra, drawn at twice the pixels (edges supersampled), the occlusion finer.
export const QUALITY: Readonly<Record<RenderQuality, { readonly ratio: number; readonly max: number; readonly shadow: number; readonly soft: boolean; readonly ao: boolean; readonly aoSamples: number; readonly aoBlend: number }>> = {
  low: { ratio: 0.75, max: 1, shadow: 1024, soft: false, ao: false, aoSamples: 0, aoBlend: 0 },
  medium: { ratio: 1, max: 2, shadow: 2048, soft: true, ao: true, aoSamples: 8, aoBlend: 0.5 },
  high: { ratio: 1, max: 2, shadow: 4096, soft: true, ao: true, aoSamples: 16, aoBlend: 0.8 },
  ultra: { ratio: 2, max: 3, shadow: 4096, soft: true, ao: true, aoSamples: 24, aoBlend: 0.9 },
};

/** The ground centred under the walls and floors shown, GROUND_SPAN times as wide, just under the lowest of them. */
export function placeGround(view: Scene3D, g: DerivedGeometry): void {
  const solids = [...g.solids.values()];
  // And the registry's with a height (a floor: contract.ts, span).
  const spanned = [...eachSolid(g.kinds)].flatMap((x) => (x.kind.span ? [{ outline: x.kind.outlines(x.solid).flat(), bottom: x.kind.span(x.solid).bottom }] : []));
  const points = [...solids.flatMap((s) => [s.wall.start, s.wall.end]), ...spanned.flatMap((f) => f.outline)];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = points.length > 0 ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 0, 0, 0];
  const size = Math.max(GROUND_MIN, GROUND_SPAN * Math.max(x1 - x0, y1 - y0));
  const spannedBottoms = [...eachSolid(g.kinds)].flatMap((x) => (x.kind.span ? [x.kind.span(x.solid).bottom] : []));
  const lowest = Math.min(0, ...solids.map((s) => s.bottom), ...spannedBottoms);
  // The photorealistic view's ground at the walls' foot, floors' slabs sunk in it as built: at the slabs'
  // bottom, under a room with no floor the sun came in under its walls (bright streaks in their shadow).
  view.stand = solids.length === 0 ? lowest : Math.min(...solids.map((s) => s.bottom));
  view.ground.scale.set(size, size, 1);
  view.ground.position.set((x0 + x1) / 2, lowest - 0.002, -(y0 + y1) / 2);
  // The grid at the ground's height, round the model's middle, a metre a cell.
  view.grid.position.set(Math.round((x0 + x1) / 2), lowest - 0.001, Math.round(-(y0 + y1) / 2));
  placeSun(view);
  if (view.shadows) castShadows(view);
}

/** The ground's size: this many times the model's extent, at least GROUND_MIN (m) across. */
export const GROUND_SPAN = 4;

export const GROUND_MIN = 60;

/** Opaque in its middle, fading to nothing at its edge: the ground runs off into the background. */
export function groundFade(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.4, '#fff');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
