import type { Scene3D } from './scene-3d';
import { type PatternUniforms, patternUv } from './scene-materials';
import * as THREE from 'three';
import { DenoiseMaterial, GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer';
import { clampedSamples, oneShadowRay } from './trace-shader';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GenerateMeshBVHWorker } from 'three-mesh-bvh/worker';
import type { RenderQuality } from '../session/view/view-3d';


/**
 * One sample more of the photorealistic view (three-gpu-pathtracer): the elements' meshes and the sun
 * (not the grid, the guides or the ground's shadow catcher), bounced light, soft shadows and the
 * sky's reflections. Given the scene again when an element changed, the camera when it moved, the
 * lights when they did; it keeps drawing until it has the quality's samples. False when the
 * browser cannot trace (the realistic raster view is drawn instead).
 */
export function trace(view: Scene3D): boolean {
  const drawn = traceStep(view);
  if (drawn) view.traceShown = true;
  // Said until its first picture: later, the realistic view between a move and the trace's clean samples
  // is a moment, not a preparation (said each time, the word blinked on the bar as the view turned).
  const preparing = !drawn && !view.traceShown;
  if (preparing !== view.preparing) {
    view.preparing = preparing;
    view.onTracePreparing(preparing);
  }
  return drawn;
}

/** The traced view's sky, made the first time it is asked (the raster frames between traces show it too). */
export function photoSky(view: Scene3D): GradientEquirectTexture {
  if (!view.traceSky) {
    const sky = new GradientEquirectTexture(256);
    sky.topColor.set(0x9fbfe6);
    sky.bottomColor.set(0xe9e3d6);
    sky.exponent = 0.6;
    sky.update();
    view.traceSky = sky;
  }
  return view.traceSky;
}

/** A traced sample's brightest: the sun's light on a white wall, a bright sky's at least (trace-shader.ts). */
export function fireflyClamp(view: Scene3D): number {
  return Math.max(view.sun.intensity, 2 * view.brightness);
}

export function traceStep(view: Scene3D): boolean {
  if (view.traceUnavailable) return false;
  if (!view.tracer) {
    const t = new WebGLPathTracer(view.renderer);
    // The library's undocumented inner parts patched below (its shader, its compile, its targets), as
    // three-gpu-pathtracer 0.0.27 has them (package.json pins it). Missing, the patches would throw or quietly
    // lose the fixes (fireflies, compile stalls, filtering): the realistic view is drawn and the user told.
    const inner = (t as unknown as { _pathTracer?: { material?: { setDefine?: unknown; fragmentShader?: unknown }; compileMaterial?: unknown; _primaryTarget?: unknown; _blendTargets?: unknown } })._pathTracer;
    if (
      !inner ||
      typeof inner.material?.setDefine !== 'function' ||
      typeof inner.material.fragmentShader !== 'string' ||
      typeof inner.compileMaterial !== 'function' ||
      !(inner._primaryTarget instanceof THREE.WebGLRenderTarget) ||
      !Array.isArray(inner._blendTargets)
    ) {
      t.dispose();
      view.traceUnavailable = true;
      view.onTraceUnavailable();
      return false;
    }
    t.bounces = 5;
    t.minSamples = 1;
    t.renderDelay = 0;
    t.fadeDuration = 300;
    // No coarse preview of its own: it drew with the shader still compiling, which made the browser
    // compile it at once (37 s with the page standing still, on Windows). Until the trace has its first
    // samples the realistic view is drawn instead (trace returns false).
    t.dynamicLowRes = false;
    t.rasterizeScene = false;
    // Fireflies (bright specks from glossy bounces) filtered as the samples add up.
    t.filterGlossyFactor = 0.5;
    // Shown through an edge-keeping denoise (glslSmartDeNoise): strong while there are few samples, faded
    // out as they add up, so the first seconds are not grain and the finished picture is not blurred.
    const denoiseMaterial = new DenoiseMaterial({ blending: THREE.NoBlending, premultipliedAlpha: true });
    // Shown as the realistic view is: filmic tone mapping (no blown-out whites) and the screen's colour space
    // (the tracer's own display gave its linear values straight: washed out and flat).
    const denoise = new FullScreenQuad(denoiseMaterial);
    t.renderToCanvasCallback = (target, renderer, quad) => {
      const n = t.samples;
      // A denoise easing from moderate to light as samples add up (1024), kept low enough to keep textures: strong, it smeared them (stones into
      // blotches, bricks washed out). Fireflies are kept down by the glossy filter instead.
      const strength = Math.max(0.15, 1 - n / 1024);
      // Always drawn through it (strength 0: no smoothing), for its tone mapping and colour space.
      void quad;
      const m = denoise.material as DenoiseMaterial & { uniforms: Record<string, { value: unknown }> };
      m.uniforms.map!.value = target.texture;
      m.uniforms.sigma!.value = 1.2 + 1.8 * strength;
      m.uniforms.kSigma!.value = 1;
      m.uniforms.threshold!.value = 0.04 + 0.06 * strength;
      m.uniforms.opacity!.value = 1;
      const auto = renderer.autoClear;
      const exposure = renderer.toneMappingExposure;
      renderer.autoClear = false;
      // The traced light (sun and the whole sky bounced) is several times the raster view's: exposed down
      // so its whites keep their texture and its shadows their depth.
      renderer.toneMappingExposure = TRACE_EXPOSURE;
      denoise.render(renderer);
      renderer.toneMappingExposure = exposure;
      renderer.autoClear = auto;
    };
    // Its scene's bounding volumes built in a worker: built here, the page stood still for seconds.
    t.setBVHWorker(new GenerateMeshBVHWorker());
    // Its shader's switches as view view will have them, before the first compile: the library starts
    // with depth of field and fog on and no background, sets them right on its first frame, and each
    // change compiles the shader again (minutes on Windows the first time). Only the camera's type
    // (perspective, parallel) changes later.
    const shader = (t as unknown as { _pathTracer: { material: THREE.ShaderMaterial & { setDefine(name: string, value: number): void } } })._pathTracer.material;
    shader.setDefine('FEATURE_DOF', 0);
    shader.setDefine('FEATURE_BACKGROUND_MAP', 1);
    shader.setDefine('FEATURE_FOG', 0);
    // One shadow ray for the direct light instead of two: a scene traversal less to compile (trace-shader.ts).
    // Compiled in the background for the target it draws into (a float texture, linear, no tone mapping):
    // compiled for the canvas (tone mapped, sRGB) as the library does, it was another program, and the one
    // drawn compiled at its first use with the page standing still (7 s measured, an RTX 3060 on Direct3D).
    const tracing = (t as unknown as { _pathTracer: { compileMaterial(): Promise<unknown>; _primaryTarget: THREE.WebGLRenderTarget } })._pathTracer;
    const compile = tracing.compileMaterial.bind(tracing);
    tracing.compileMaterial = () => {
      const was = view.renderer.getRenderTarget();
      view.renderer.setRenderTarget(tracing._primaryTarget);
      try {
        return compile();
      } finally {
        view.renderer.setRenderTarget(was);
      }
    };
    shader.fragmentShader = clampedSamples(oneShadowRay(shader.fragmentShader));
    shader.uniforms['fireflyClamp'] = { value: fireflyClamp(view) };
    shader.needsUpdate = true;
    view.traceShader = shader;
    // Shown smoothly enlarged: the library reads its targets nearest (a medium-quality trace, at three
    // quarters of the screen's pixels, then had stair-stepped shadow edges). Linear needs float filtering.
    if (view.renderer.extensions.has('OES_texture_float_linear')) {
      const targets = t as unknown as { _pathTracer: { _primaryTarget: THREE.WebGLRenderTarget; _blendTargets: THREE.WebGLRenderTarget[] } };
      for (const target of [targets._pathTracer._primaryTarget, ...targets._pathTracer._blendTargets]) {
        target.texture.minFilter = THREE.LinearFilter;
        target.texture.magFilter = THREE.LinearFilter;
      }
    }
    view.tracer = t;
  }
  const t = view.tracer;
  t.renderScale = TRACE[view.quality].scale;
  // The scene given again when an element changed, built in the background: until it is, the
  // realistic view is drawn (false), and the trace takes over when it is ready.
  if (view.traceBuild) return false;
  if (view.traced.content !== view.contentVersion) {
    const version = view.contentVersion;
    const old = view.traceScene;
    const scene = Object.assign(new THREE.Scene(), { children: [traceCopies(view), view.sun], environment: photoSky(view), background: photoSky(view) });
    scene.environmentIntensity = view.brightness;
    view.traceBuild = t.setSceneAsync(scene, view.camera).then(() => {
      old?.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.dispose());
      view.traceScene = scene;
      view.traced = { content: version, camera: '', light: '' };
      view.traceBuild = null;
      view.invalidate();
    });
    return false;
  }
  const camera = `${view.camera.matrixWorld.elements.join()}|${view.camera.projectionMatrix.elements.join()}`;
  if (camera !== view.traced.camera) {
    t.setCamera(view.camera);
    view.traced.camera = camera;
  }
  const light = `${view.sun.position.toArray().join()}|${view.sun.intensity}|${view.brightness}`;
  if (light !== view.traced.light && view.traceScene) {
    view.traceScene.environmentIntensity = view.brightness;
    if (view.traceShader) view.traceShader.uniforms['fireflyClamp']!.value = fireflyClamp(view);
    t.updateLights();
    t.updateEnvironment();
    view.traced.light = light;
  }
  t.renderSample();
  // Its shader compiles in the background the first time (KHR_parallel_shader_compile): looked at
  // again shortly, the realistic view drawn meanwhile.
  if ((t as Compiling).isCompiling) {
    setTimeout(() => view.invalidate(), 250);
    return false;
  }
  // Its first samples traced on, the realistic view kept until they are enough to show clean.
  if (t.samples < TRACE[view.quality].shown) {
    view.invalidate();
    return false;
  }
  // Drawing on, a sample a frame, until the quality's count.
  if (t.samples < TRACE[view.quality].samples) view.invalidate();
  return true;
}

/**
 * The elements' meshes for the path tracer, one material each where they stand. A mesh of several
 * materials (a wall block's sides and top) is split by its groups: the tracer numbers one material per
 * mesh while it lists a mesh's every material, so after the first such mesh every surface took its
 * neighbour's colour (the terrain red, a roof green).
 */
export function traceCopies(view: Scene3D): THREE.Group {
  const out = new THREE.Group();
  // Their positions as they are now: a level's elements just lifted to its height had them still from
  // before (the raster view updates them as it draws), and the upper level's slab and stair were missing.
  view.scene.updateMatrixWorld(true);
  for (const { group } of view.walls.values())
    group.traverseVisible((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const parts: [THREE.BufferGeometry, THREE.Material][] = [];
      if (!Array.isArray(mesh.material)) parts.push([mesh.geometry.clone(), mesh.material]);
      else {
        const g = mesh.geometry;
        const flat = g.index ? g.toNonIndexed() : g;
        for (const grp of g.groups.length > 0 ? g.groups : [{ start: 0, count: flat.attributes.position!.count, materialIndex: 0 }]) {
          const m = mesh.material[grp.materialIndex ?? 0];
          if (!m || grp.count === 0) continue;
          const part = new THREE.BufferGeometry();
          for (const [name, attr] of Object.entries(flat.attributes)) {
            const a = attr as THREE.BufferAttribute;
            part.setAttribute(name, new THREE.BufferAttribute(a.array.slice(grp.start * a.itemSize, (grp.start + grp.count) * a.itemSize), a.itemSize, a.normalized));
          }
          parts.push([part, m]);
        }
        if (flat !== g) flat.dispose();
      }
      for (const [geometry, material] of parts) {
        // Where it stands, in the world's metres: a pattern is laid in them.
        geometry.applyMatrix4(mesh.matrixWorld);
        const pattern = (material.userData.pattern as PatternUniforms | undefined)?.uPatMap.value ? (material.userData.pattern as PatternUniforms) : null;
        // Glass as glass (light through it, bent and reflected), not as a see-through surface.
        const glass = material === view.materials.glass || material.userData.clear === true;
        out.add(new THREE.Mesh(pattern ? patternUv(geometry, pattern) : geometry, glass ? (material.userData.frosted === true ? view.tracedFrosted : view.tracedGlass) : pattern ? tracedPattern(view, material as THREE.MeshStandardMaterial) : material));
      }
    });
  // A ground under everything, matte, a little below the lowest thing: what stands has somewhere to cast
  // its shadow and to sit on (without it the model floated in the sky).
  const box = new THREE.Box3().setFromObject(out);
  if (!box.isEmpty()) {
    const size = Math.max(200, box.getSize(new THREE.Vector3()).length() * 6);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), view.tracedGround);
    ground.position.set((box.min.x + box.max.x) / 2, Math.max(box.min.y, view.stand) - 0.002, (box.min.z + box.max.z) / 2);
    ground.updateMatrixWorld();
    ground.geometry.applyMatrix4(ground.matrixWorld);
    ground.position.set(0, 0, 0);
    out.add(ground);
  }
  // The luminaires' lights, where they are.
  for (const { group } of view.walls.values())
    group.traverseVisible((o) => {
      if (!(o as THREE.Light).isLight) return;
      const light = o.clone();
      light.matrixAutoUpdate = false;
      light.matrix.copy(o.matrixWorld);
      out.add(light);
    });
  return out;
}

/** A patterned material as the tracer can read it: its pattern a texture of its own (patternUv's
 * coordinates), not a shader's; one per material, kept while it is. */
export function tracedPattern(view: Scene3D, m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const u = m.userData.pattern as PatternUniforms;
  let x = view.tracedPatterns.get(m);
  if (!x || x.map !== u.uPatMap.value) {
    x?.dispose();
    x = new THREE.MeshStandardMaterial({ color: m.color, map: u.uPatMap.value, roughness: m.roughness, metalness: m.metalness, side: m.side });
    view.tracedPatterns.set(m, x);
  }
  return x;
}

/** The tracer as it is: its JavaScript has isCompiling (WebGLPathTracer.js), its typings do not. */
export type Compiling = WebGLPathTracer & { readonly isCompiling: boolean };

/** The photorealistic style by quality: the share of the screen's pixels traced, the samples it stops at. */
// The saved picture's own count (picture): it is 3840 pixels wide, and the view's count there was the
// GPU's minutes (1024 at high, 150 s); these come out clean at that size in a fraction of it.
// The trace shown from its `shown` samples on, the realistic view drawn until then: its first samples are
// grain (black specks, half-lit walls) that no denoise takes away without smearing the textures.
export const TRACE: Readonly<Record<RenderQuality, { readonly scale: number; readonly samples: number; readonly picture: number; readonly shown: number }>> = {
  low: { scale: 0.5, samples: 64, picture: 64, shown: 24 },
  medium: { scale: 0.75, samples: 256, picture: 128, shown: 48 },
  high: { scale: 1, samples: 1024, picture: 256, shown: 64 },
  ultra: { scale: 1, samples: 4096, picture: 512, shown: 96 },
};

/** The traced view's exposure (its tone mapping), against its light being far brighter than the raster view's. */
export const TRACE_EXPOSURE = 0.55;
