import type { Scene3D } from './scene-3d';
import * as THREE from 'three';
import { patternTexture, patternUvAt } from '../elements/object/textures';
import { type Material, SEE_THROUGH } from '../elements/material/schema';


/** A surface's material set up as every other: cut by the section planes, behind its edges' lines. */
export function prepare(view: Scene3D, m: THREE.Material): void {
  m.clippingPlanes = view.clip;
  // The faces a little behind their depth, so the lines on their edges are not half hidden by them.
  m.polygonOffset = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits = 1;
}

/** A wall layer's material: made the first time, then given the project material's colour and finish. */
export function layerMaterial(view: Scene3D, m: Material): THREE.MeshStandardMaterial {
  let x = view.layerMaterials.get(m.id);
  if (!x) {
    x = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    prepare(view, x);
    // The services' pipes and points (elements/kinds/mep.ts: their materials "mep_…") stay whole in
    // X-ray: seeing them through the walls is what it is for.
    x.userData.kept = m.id.startsWith('mep_');
    setFaint(x, view.xrayOn);
    patterned(x);
    view.layerMaterials.set(m.id, x);
  }
  // A pattern carries the colour itself (its pieces' tones): the material is white under it.
  const colour = m.pattern ? '#ffffff' : m.color;
  if (x.color.getHexString() !== colour.slice(1).toLowerCase()) x.color.set(colour);
  setPattern(view, x, m);
  x.roughness = m.roughness;
  x.metalness = m.metalness;
  // The project's glass is seen through (a curtain wall's panels, an object's glass part), and so are
  // frosted glass and water, less (SEE_THROUGH).
  const clear = SEE_THROUGH[m.id] !== undefined;
  x.userData.opacity = SEE_THROUGH[m.id];
  x.userData.frosted = m.id === 'frostedGlass';
  if (x.userData.clear !== clear) {
    x.userData.clear = clear;
    setFaint(x, view.xrayOn);
  }
  return x;
}

/** A material's pattern painted again when it or the colour changed, or taken off. */
export function setPattern(view: Scene3D, x: THREE.MeshStandardMaterial, m: Material): void {
  const key = m.pattern ? JSON.stringify([m.pattern, m.color]) : '';
  const u = x.userData.pattern as PatternUniforms;
  if (u.key === key) return;
  u.key = key;
  (u.uPatMap.value as THREE.Texture | null)?.dispose();
  u.uPatMap.value = null;
  if (m.pattern) {
    const { texture, period } = patternTexture(m.pattern, m.color, Math.min(8, view.renderer.capabilities.getMaxAnisotropy()));
    u.uPatMap.value = texture;
    u.uPatPeriod.value.copy(period);
    u.uPatAngle.value = (m.pattern.angle * Math.PI) / 180;
  }
  const on = m.pattern !== undefined;
  if ((x.defines?.PATTERN !== undefined) !== on) {
    x.defines = on ? { ...x.defines, PATTERN: '' } : Object.fromEntries(Object.entries(x.defines ?? {}).filter(([k]) => k !== 'PATTERN'));
    x.needsUpdate = true;
  }
}

export function setFaint(m: THREE.Material, faint: boolean): void {
  const on = faint && m.userData.kept !== true;
  const clear = m.userData.clear === true;
  m.transparent = on || clear;
  m.opacity = on ? XRAY_OPACITY : clear ? ((m.userData.opacity as number | undefined) ?? GLASS_OPACITY) : 1;
  m.depthWrite = !on && !clear;
  m.needsUpdate = true;
}

/** Lit and finished as the real thing: the realistic style, and the photorealistic one traced over it. */
export function lifelike(view: Scene3D): boolean {
  return view.style === 'realistic' || view.style === 'photo';
}

/** The edges' lines as the style draws them: full in hidden lines, none in realistic (but in x-ray). */
export function applyEdges(view: Scene3D): void {
  view.edgeMaterial.visible = !lifelike(view) || view.xrayOn;
  view.edgeMaterial.opacity = view.style === 'hidden' || view.xrayOn ? 0.9 : 0.55;
}

/** How much of a wall shows in x-ray. */
export const XRAY_OPACITY = 0.28;

/** How much the project's glass hides what is behind it. */
export const GLASS_OPACITY = 0.45;

export interface PatternUniforms {
  key: string;
  readonly uPatMap: { value: THREE.Texture | null };
  readonly uPatPeriod: { value: THREE.Vector2 };
  readonly uPatAngle: { value: number };
}

/**
 * A material that can show a pattern (render/pattern-texture.ts) laid in the world's metres, whatever
 * the geometry's own coordinates: a face looking up or down takes it in plan, one looking sideways along
 * its length and up (box mapping by the face's normal). Walls, floors and objects alike, none of them
 * with texture coordinates of their own. Off until the material has a pattern (its PATTERN define).
 */
export function patterned(x: THREE.MeshStandardMaterial): void {
  const u: PatternUniforms = { key: '', uPatMap: { value: null }, uPatPeriod: { value: new THREE.Vector2(1, 1) }, uPatAngle: { value: 0 } };
  x.userData.pattern = u;
  x.onBeforeCompile = (shader) => {
    shader.uniforms.uPatMap = u.uPatMap;
    shader.uniforms.uPatPeriod = u.uPatPeriod;
    shader.uniforms.uPatAngle = u.uPatAngle;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n#ifdef PATTERN\nvarying vec3 vPatPos;\nvarying vec3 vPatNormal;\n#endif')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n#ifdef PATTERN\nvPatPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvPatNormal = normalize(mat3(modelMatrix) * objectNormal);\n#endif',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n#ifdef PATTERN\nvarying vec3 vPatPos;\nvarying vec3 vPatNormal;\nuniform sampler2D uPatMap;\nuniform vec2 uPatPeriod;\nuniform float uPatAngle;\n#endif')
      .replace(
        '#include <map_fragment>',
        [
          '#include <map_fragment>',
          '#ifdef PATTERN',
          'vec3 patN = abs(normalize(vPatNormal));',
          // Plan x and y are three.js x and −z; the height is y.
          'vec2 patP = patN.y >= max(patN.x, patN.z) ? vec2(vPatPos.x, -vPatPos.z) : (patN.x >= patN.z ? vec2(-vPatPos.z, vPatPos.y) : vec2(vPatPos.x, vPatPos.y));',
          'float patC = cos(uPatAngle);',
          'float patS = sin(uPatAngle);',
          'patP = vec2(patC * patP.x + patS * patP.y, -patS * patP.x + patC * patP.y);',
          'diffuseColor.rgb *= texture2D(uPatMap, patP / uPatPeriod).rgb;',
          '#endif',
        ].join('\n'),
      );
  };
}

/**
 * Texture coordinates for a pattern on a geometry already in the world, as the patterned shader lays it
 * (patterned above): a face looking up or down in plan, one looking sideways along its length and up;
 * over the pattern's period, turned by its angle. Made flat (each triangle its own corners) so a face
 * takes its own direction.
 */
export function patternUv(g: THREE.BufferGeometry, u: PatternUniforms): THREE.BufferGeometry {
  return patternUvAt(g, u.uPatPeriod.value, u.uPatAngle.value);
}
