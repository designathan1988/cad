// The 3D view's look: visual style and quality, light, x-ray, renovation phases and the theme's colours.

import type { Scene3D } from './scene-3d';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { RenderQuality, VisualStyle } from '../session/view/view-3d';
import { applyEdges, setFaint, lifelike, prepare, XRAY_OPACITY } from './scene-materials';
import { applyLights, applyShadows, QUALITY } from './scene-light';

/**
 * X-ray (view-3d.ts): the walls and floors faint, writing no depth, so what is behind them shows; the
 * lines stay solid, so the shapes still read. Glass and leaves keep their own look.
 */
/**
 * The walls drawn by their phase in a renovation (with the overrides on), each phase in its colour
 * (`colour`: its token's); the walls to be demolished seen through, as glass is. Empty: by their layers.
 */
export function setPhases(view: Scene3D, phases: ReadonlyMap<string, 'new' | 'existing' | 'demolish'>, colour: (phase: 'new' | 'existing' | 'demolish') => string): void {
  view.phases = phases;
  for (const p of new Set(phases.values())) {
    let m = view.phaseMaterials.get(p);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
      prepare(view, m);
      m.userData.clear = p === 'demolish';
      setFaint(m, view.xrayOn);
      view.phaseMaterials.set(p, m);
    }
    const c = colour(p);
    if (c && `#${m.color.getHexString()}` !== c.toLowerCase()) {
      m.color.set(c);
      view.invalidate();
    }
  }
}

export function setXray(view: Scene3D, on: boolean): void {
  const faint = [view.materials.side, view.materials.top, view.materials.floor, view.materials.sideSel, view.materials.topSel, ...view.layerMaterials.values(), ...view.phaseMaterials.values()];
  if (faint[0]!.transparent === on && (on ? faint[0]!.opacity === XRAY_OPACITY : true)) return;
  view.xrayOn = on;
  for (const m of faint) setFaint(m, on);
  applyEdges(view);
  view.invalidate();
}

/**
 * The visual style and the quality (view-3d.ts): the lights, tone mapping and the sky's reflections a
 * style draws with, the resolution, shadow map and ambient occlusion a quality asks.
 */
export function setLook(view: Scene3D, style: VisualStyle, quality: RenderQuality): void {
  if (style === view.style && quality === view.quality) return;
  const q = QUALITY[quality];
  // three.js 0.186 has only PCF left of the filtered shadows (PCFSoft was removed): its edges softened by the radius.
  const recompile = style !== view.style;
  view.style = style;
  // Out of the photorealistic style, nothing is being prepared: said now, not at the next frame.
  if (style !== 'photo' && view.preparing) {
    view.preparing = false;
    view.onTracePreparing(false);
  }
  view.quality = quality;
  view.renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * q.ratio, q.max));
  view.renderer.shadowMap.type = THREE.PCFShadowMap;
  const shadow = view.sun.shadow;
  shadow.radius = q.soft ? 3 : 1;
  if (shadow.mapSize.x !== q.shadow) {
    shadow.mapSize.set(q.shadow, q.shadow);
    shadow.map?.dispose();
    shadow.map = null;
  }
  const realistic = lifelike(view);
  view.renderer.toneMapping = realistic ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  view.renderer.toneMappingExposure = 1;
  if (realistic && !view.environment) {
    const pmrem = new THREE.PMREMGenerator(view.renderer);
    view.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  view.scene.environment = realistic ? view.environment : null;
  applyEdges(view);
  applyShadows(view, recompile);
  view.offsetDirty = true;
  view.invalidate();
}

/** The view's brightness and the sun's strength (view-3d.ts): every light times the first, the sun times both. */
export function setLight(view: Scene3D, brightness: number, sun: number): void {
  if (brightness === view.brightness && sun === view.sunScale) return;
  view.brightness = brightness;
  view.sunScale = sun;
  applyLights(view);
  view.invalidate();
}

/** Colours of the theme, read from the design tokens: `token('--3d-side')` and so on. */
export function setTheme(view: Scene3D, dark: boolean, token: (name: string) => string): void {
  const c = (name: string) => new THREE.Color(token(name));
  view.scene.background = c('--canvas');
  const m = view.materials;
  m.side.color = c('--3d-side');
  m.top.color = c('--3d-top');
  m.floor.color = c('--3d-floor');
  m.roof.color = c('--3d-roof');
  m.sideSel.color = c('--3d-side-sel');
  m.topSel.color = c('--accent');
  m.preview.color = c('--3d-preview');
  m.glass.color = c('--3d-glass');
  m.leaf.color = c('--3d-leaf');
  m.frame.color = c('--3d-frame');
  m.invalid.color = c('--warn');
  view.capMaterial.color = c('--3d-cut');
  view.boxCapMaterial.color = c('--3d-cut');
  view.edgeMaterial.color = c('--3d-edge');
  (view.ground.material as THREE.MeshBasicMaterial).color = c('--3d-ground');
  // The wall layers keep their materials' own colours in both themes, lit by the scene's light.
  view.sky.color = c('--3d-light');
  view.sky.groundColor = c('--3d-ground-light');
  view.sun.color = c('--3d-light');
  view.fill.color = c('--3d-light');
  // The ground grid in both themes, faint, under everything (placeGround).
  view.grid.visible = true;
  const lines = view.grid.geometry.getAttribute('color');
  // GridHelper colours its lines per vertex: centre lines one colour, the rest another.
  const major = c('--grid-major');
  const minor = c('--grid-minor');
  for (let i = 0; i < lines.count; i++) {
    const centre = i < 4;
    const k = centre ? major : minor;
    lines.setXYZ(i, k.r, k.g, k.b);
  }
  lines.needsUpdate = true;
  const gm = view.grid.material as THREE.Material | THREE.Material[];
  (Array.isArray(gm) ? gm : [gm]).forEach((x) => {
    x.transparent = true;
    // Lines on a dark canvas read fainter: a little more of them.
    x.opacity = dark ? 0.5 : 0.35;
    x.needsUpdate = true;
  });
  view.invalidate();
}
