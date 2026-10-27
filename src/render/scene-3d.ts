// 3D view. Reads derived geometry, draws, syncs meshes by wall id, disposes what it drops, and
// renders only when something changed. World (x, y, height) maps to three.js (x, height, −y).
// Each convex piece is a prism; pieces are disjoint by construction, so no 3D boolean exists.

import * as THREE from 'three';
import { patternTexture } from './pattern-texture';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { RenderQuality, VisualStyle } from '../app/view-3d';
import type { Point2 } from '../core/vector';
import type { DerivedGeometry, OpeningSolid, WallSolid } from '../app/geometry';
import type { WallId } from '../elements/wall/schema';
import type { Material } from '../elements/material/schema';
import { blockPaint, type Paint, wallMeshKey } from './wall-paint';
import { type PrismFaces, visibleFaces } from '../elements/wall/geometry/faces';
import { prism, shownPrism, slopedPrism, toThree } from './prisms';
import { eachSolid } from '../elements/registry';
import type { KindSolid } from '../elements/contract';
import { featureEdges, type SlopedTop, underSlopes } from '../elements/wall/geometry/edges';
import { openingParts } from '../elements/opening/parts';
import { SOIL_DEPTH } from '../elements/kinds/terrain';
import { boxCaps, type SectionBox, type SectionLine, sectionCaps, sectionLooks, type UprightPrism } from '../app/section-box';

/** The ground's size: this many times the model's extent, at least GROUND_MIN (m) across. */
const GROUND_SPAN = 4;
const GROUND_MIN = 60;
/** Vertical field of view (degrees): the overview's, and a walker's. */
const VIEW_FOV = 40;
const WALK_FOV = 65;
/**
 * Each quality's settings: the resolution against the screen's (`ratio` times its pixel ratio, at most
 * `max`; over 1 drawn larger and shown smaller, which smooths the edges), the sun's shadow map (px a
 * side) and whether its edges are soft, and ambient occlusion with multisampling (a post-processing pass).
 */
const QUALITY: Readonly<Record<RenderQuality, { readonly ratio: number; readonly max: number; readonly shadow: number; readonly soft: boolean; readonly ao: boolean }>> = {
  low: { ratio: 0.75, max: 1, shadow: 1024, soft: false, ao: false },
  medium: { ratio: 1, max: 2, shadow: 2048, soft: true, ao: false },
  high: { ratio: 1, max: 2, shadow: 4096, soft: true, ao: true },
  ultra: { ratio: 2, max: 3, shadow: 4096, soft: true, ao: true },
};
/** How much of a wall shows in x-ray. */
const XRAY_OPACITY = 0.28;
/** How much the project's glass hides what is behind it. */
const GLASS_OPACITY = 0.45;
interface PatternUniforms {
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
function patterned(x: THREE.MeshStandardMaterial): void {
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

/** A luminaire's point light per lumen: 900 lm give the floor 1.75 m under it about 0.5, a third of the sun. */
const LAMP_SCALE = (0.5 * 1.75 * 1.75) / 900;

/** Opaque in its middle, fading to nothing at its edge: the ground runs off into the background. */
function groundFade(): THREE.Texture {
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

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  private readonly persp = new THREE.PerspectiveCamera(VIEW_FOV, 1, 0.05, 2000);
  /**
   * Orthographic, as elevations and sections are drawn (Revit's parallel views): no perspective, sizes
   * true at any depth. `orthoHalf`: half the view's height in metres at zoom 1.
   */
  private readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 4000);
  private orthoOn = false;
  private orthoHalf = 5;
  /** The camera in use: the perspective one, or the orthographic one (setOrtho). */
  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.orthoOn ? this.ortho : this.persp;
  }
  readonly controls: OrbitControls;
  private readonly scene = new THREE.Scene();
  private readonly walls = new Map<WallId, { group: THREE.Group; key: string }>();
  // Colours come from the design tokens (styles.css, --3d-*), set in setTheme.
  /** Each solid's shape key (wallMeshKey without the state), kept while the solid lives. */
  private readonly shapeKeys = new WeakMap<object, string>();
  /** One three.js material per project material (elements/material), its colour and finish kept up to date. */
  private readonly layerMaterials = new Map<string, THREE.MeshStandardMaterial>();
  /** A renovation's walls by phase (app/layer-sets.ts: wallPhases), with the overrides on; each phase's material in its token's colour. */
  private phases: ReadonlyMap<string, 'new' | 'existing' | 'demolish'> = new Map();
  private readonly phaseMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private xrayOn = false;
  private readonly materials = {
    side: new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }),
    top: new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide }),
    roof: new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }),
    sideSel: new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }),
    topSel: new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }),
    preview: new THREE.MeshStandardMaterial({ roughness: 0.8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ roughness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }),
    frame: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }),
    invalid: new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  };
  /** The cut (view-3d.ts): everything above its plane is clipped away; shared by every material, so a cut is one change. */
  private readonly clip: THREE.Plane[] = [];
  /** The cut's plane and the section box's six, together in `clip`. */
  private cutPlane: THREE.Plane | null = null;
  private boxPlanes: THREE.Plane[] = [];
  private boxKey = '';
  /** The cut's fill is clipped by the box only: its own plane would clip it away. */
  private readonly capClip: THREE.Plane[] = [];
  /** Where the box's faces go through walls and floors, filled as a cut is (section-box.ts, boxCaps). */
  private readonly boxCapGroup = new THREE.Group();
  private readonly boxCapMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  private boxBox: SectionBox | null = null;
  private sectionLine: SectionLine | null = null;
  private sectionPlane: THREE.Plane | null = null;
  private boxCapsKey: unknown[] = [];
  private lastSync: { g: DerivedGeometry; lift: (levelId: string) => number } | null = null;
  /** Where the cut goes through walls, filled as the plan fills them (not clipped itself). */
  private readonly caps = new THREE.Group();
  private readonly capMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  /**
   * Thin lines where the surfaces turn (edges.ts), one set per level so each lifts with its level: walls
   * of one colour read apart, and so does the step of a wall off the face of the wall below it.
   */
  private readonly edgeMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
  private readonly edges = new Map<string, THREE.LineSegments>();
  private edgesOf: DerivedGeometry['solids'] | null = null;
  private capsKey = '';
  private readonly sky = new THREE.HemisphereLight(undefined, undefined, 2.7);
  private readonly sun = new THREE.DirectionalLight(undefined, 1.5);
  private readonly fill = new THREE.DirectionalLight(undefined, 0.6);
  /** The only light of Consistent colours: each material's own colour, as it is. */
  private readonly ambient = new THREE.AmbientLight(0xffffff, 0);
  /** The sun's and the sky's strength as the site's sun sets them (placeSun), before the style's. */
  private sunBase = 1.5;
  private skyBase = 2.7;
  /** The site's sun (app/sun.ts): the way to it, and whether it casts shadows; null for the fixed light. */
  private sunWay: { readonly x: number; readonly y: number; readonly z: number } | null = null;
  /** Shadows asked for by the site; `shadows`: drawn now (the site's, or Realistic's own). */
  private siteShadows = false;
  private shadows = false;
  /** The visual style and the quality (view-3d.ts), and what they need: the post-processing, the sky's reflections. */
  private style: VisualStyle = 'shaded';
  /** The view's brightness and the sun's strength against the sky (view-3d.ts), multiplying the style's lights. */
  private brightness = 1;
  private sunScale = 1;
  private quality: RenderQuality = 'medium';
  private composer: { readonly fx: EffectComposer; readonly key: string; readonly passes: { camera: THREE.Camera }[] } | null = null;
  private environment: THREE.Texture | null = null;
  /** Hidden lines: every surface white, unlit, behind its edges. */
  private readonly hiddenFace = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  /** Shadows on the ground, where nothing else stands to take them. */
  private readonly shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.28 }));
  private covered = { right: 0, bottom: 0, left: 0 };
  /**
   * How far the view's centre is shifted (px), set when the view is framed from what the panels
   * covered then. A panel shown or hidden later leaves it: shifting it then moved the whole model on
   * screen, with no camera move, each time a selection brought the panel in.
   */
  private shift = { x: 0, y: 0 };
  private offsetDirty = false;
  private readonly grid: THREE.GridHelper;
  /**
   * The ground under the model, at its lowest base: a room with no floor shows it. Before, it showed
   * the background, a black hole among the walls in the dark theme.
   */
  private readonly ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaMap: groundFade() }),
  );
  private needsRender = true;
  private raf = 0;
  onChange: () => void = () => {};

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.persp.position.set(-6, 9, 12);
    this.controls = new OrbitControls(this.persp, canvas);
    // Wheel zooms at the cursor, middle button pans, Shift + middle (or right) rotates. Left is ours.
    this.controls.zoomToCursor = true;
    this.controls.enableDamping = false;
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.screenSpacePanning = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.addEventListener('change', () => {
      this.invalidate();
      // What is placed by projecting through the camera (the floating bar) must use the camera as it
      // is now: its world matrices are otherwise updated only by the next frame's render, and a jump
      // (the cube's Top, F, a turn by keyboard) left the bar where the selection was before it.
      this.camera.updateMatrixWorld();
      this.onChange();
    });
    this.scene.add(this.sky);
    this.sun.position.set(-8, 14, 10);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.shadowGround.rotation.x = -Math.PI / 2;
    this.shadowGround.receiveShadow = true;
    this.shadowGround.visible = false;
    this.scene.add(this.shadowGround);
    this.fill.position.set(10, 6, -8);
    this.scene.add(this.fill);
    this.scene.add(this.ambient);
    this.prepare(this.hiddenFace);
    this.grid = new THREE.GridHelper(200, 200);
    this.grid.position.y = -0.001;
    this.scene.add(this.grid);
    // Under the grid and drawn before it, writing no depth: the grid's lines stay on it.
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.renderOrder = -1;
    this.ground.scale.set(GROUND_MIN, GROUND_MIN, 1);
    this.ground.position.y = -0.002;
    // Kept as the ground's frame (its middle and size place the sun and the grid), never drawn: the view
    // stands on a grid, as a CAD viewport does, not on a grey plane the terrain would cut through.
    this.ground.visible = false;
    this.scene.add(this.ground);
    this.renderer.localClippingEnabled = true;
    for (const m of Object.values(this.materials)) this.prepare(m);
    this.edgeMaterial.clippingPlanes = this.clip;
    this.capMaterial.clippingPlanes = this.capClip;
    this.boxCapMaterial.clippingPlanes = this.clip;
    this.scene.add(this.boxCapGroup);
    this.scene.add(this.caps);
  }

  /**
   * Cuts everything above height z away (null: no cut), and fills where it goes through the walls with
   * `sections`, the walls' pieces at that height (the plan's, which already leave the doors and windows out).
   */
  setCut(z: number | null, sections: readonly (readonly Point2[])[]): void {
    const key = z === null ? '' : JSON.stringify([z, sections]);
    if (key === this.capsKey) return;
    this.capsKey = key;
    this.cutPlane = z === null ? null : new THREE.Plane(new THREE.Vector3(0, -1, 0), z);
    this.clipPlanes();
    for (const c of [...this.caps.children]) {
      this.caps.remove(c);
      if (c instanceof THREE.Mesh) c.geometry.dispose();
    }
    if (z !== null) {
      for (const poly of sections) {
        if (poly.length < 3) continue;
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, p.y)))), this.capMaterial);
        // The shape lies in x–y; turned −90° about x it lies in three.js x–(−z), as the floors do.
        mesh.rotation.x = -Math.PI / 2;
        // Just under the plane, which would otherwise clip it half the time.
        mesh.position.y = z - 0.0005;
        this.caps.add(mesh);
      }
    }
    this.invalidate();
  }

  /** A surface's material set up as every other: cut by the section planes, behind its edges' lines. */
  private prepare(m: THREE.Material): void {
    m.clippingPlanes = this.clip;
    // The faces a little behind their depth, so the lines on their edges are not half hidden by them.
    m.polygonOffset = true;
    m.polygonOffsetFactor = 1;
    m.polygonOffsetUnits = 1;
  }

  /** A wall layer's material: made the first time, then given the project material's colour and finish. */
  private layerMaterial(m: Material): THREE.MeshStandardMaterial {
    let x = this.layerMaterials.get(m.id);
    if (!x) {
      x = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
      this.prepare(x);
      // The services' pipes and points (elements/kinds/mep.ts: their materials "mep_…") stay whole in
      // X-ray: seeing them through the walls is what it is for.
      x.userData.kept = m.id.startsWith('mep_');
      this.faint(x, this.xrayOn);
      patterned(x);
      this.layerMaterials.set(m.id, x);
    }
    // A pattern carries the colour itself (its pieces' tones): the material is white under it.
    const colour = m.pattern ? '#ffffff' : m.color;
    if (x.color.getHexString() !== colour.slice(1).toLowerCase()) x.color.set(colour);
    this.setPattern(x, m);
    x.roughness = m.roughness;
    x.metalness = m.metalness;
    // The project's glass is seen through (a curtain wall's panels, an object's glass part).
    const clear = m.id === 'glass';
    if (x.userData.clear !== clear) {
      x.userData.clear = clear;
      this.faint(x, this.xrayOn);
    }
    return x;
  }

  /** A material's pattern painted again when it or the colour changed, or taken off. */
  private setPattern(x: THREE.MeshStandardMaterial, m: Material): void {
    const key = m.pattern ? JSON.stringify([m.pattern, m.color]) : '';
    const u = x.userData.pattern as PatternUniforms;
    if (u.key === key) return;
    u.key = key;
    (u.uPatMap.value as THREE.Texture | null)?.dispose();
    u.uPatMap.value = null;
    if (m.pattern) {
      const { texture, period } = patternTexture(m.pattern, m.color, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
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

  private faint(m: THREE.Material, faint: boolean): void {
    const on = faint && m.userData.kept !== true;
    const clear = m.userData.clear === true;
    m.transparent = on || clear;
    m.opacity = on ? XRAY_OPACITY : clear ? GLASS_OPACITY : 1;
    m.depthWrite = !on && !clear;
    m.needsUpdate = true;
  }

  /**
   * X-ray (view-3d.ts): the walls and floors faint, writing no depth, so what is behind them shows; the
   * lines stay solid, so the shapes still read. Glass and leaves keep their own look.
   */
  /**
   * The walls drawn by their phase in a renovation (with the overrides on), each phase in its colour
   * (`colour`: its token's); the walls to be demolished seen through, as glass is. Empty: by their layers.
   */
  setPhases(phases: ReadonlyMap<string, 'new' | 'existing' | 'demolish'>, colour: (phase: 'new' | 'existing' | 'demolish') => string): void {
    this.phases = phases;
    for (const p of new Set(phases.values())) {
      let m = this.phaseMaterials.get(p);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
        this.prepare(m);
        m.userData.clear = p === 'demolish';
        this.faint(m, this.xrayOn);
        this.phaseMaterials.set(p, m);
      }
      const c = colour(p);
      if (c && `#${m.color.getHexString()}` !== c.toLowerCase()) {
        m.color.set(c);
        this.invalidate();
      }
    }
  }

  setXray(on: boolean): void {
    const faint = [this.materials.side, this.materials.top, this.materials.floor, this.materials.sideSel, this.materials.topSel, ...this.layerMaterials.values(), ...this.phaseMaterials.values()];
    if (faint[0]!.transparent === on && (on ? faint[0]!.opacity === XRAY_OPACITY : true)) return;
    this.xrayOn = on;
    for (const m of faint) this.faint(m, on);
    this.applyEdges();
    this.invalidate();
  }

  /** The edges' lines as the style draws them: full in hidden lines, none in realistic (but in x-ray). */
  private applyEdges(): void {
    this.edgeMaterial.visible = this.style !== 'realistic' || this.xrayOn;
    this.edgeMaterial.opacity = this.style === 'hidden' || this.xrayOn ? 0.9 : 0.55;
  }

  /**
   * The visual style and the quality (view-3d.ts): the lights, tone mapping and the sky's reflections a
   * style draws with, the resolution, shadow map and ambient occlusion a quality asks.
   */
  setLook(style: VisualStyle, quality: RenderQuality): void {
    if (style === this.style && quality === this.quality) return;
    const q = QUALITY[quality];
    // three.js 0.186 has only PCF left of the filtered shadows (PCFSoft was removed): its edges softened by the radius.
    const recompile = style !== this.style;
    this.style = style;
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * q.ratio, q.max));
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const shadow = this.sun.shadow;
    shadow.radius = q.soft ? 3 : 1;
    if (shadow.mapSize.x !== q.shadow) {
      shadow.mapSize.set(q.shadow, q.shadow);
      shadow.map?.dispose();
      shadow.map = null;
    }
    const realistic = style === 'realistic';
    this.renderer.toneMapping = realistic ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    if (realistic && !this.environment) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    this.scene.environment = realistic ? this.environment : null;
    this.applyEdges();
    this.applyShadows(recompile);
    this.offsetDirty = true;
    this.invalidate();
  }

  /** The view's brightness and the sun's strength (view-3d.ts): every light times the first, the sun times both. */
  setLight(brightness: number, sun: number): void {
    if (brightness === this.brightness && sun === this.sunScale) return;
    this.brightness = brightness;
    this.sunScale = sun;
    this.applyLights();
    this.invalidate();
  }

  /** The lights as the style has them, from the strengths the sun set, times the view's brightness. */
  private applyLights(): void {
    const s = this.style;
    const b = this.brightness;
    // π: three.js's diffuse is the albedo over π times the light, so π gives each colour as it is.
    this.ambient.intensity = s === 'consistent' ? Math.PI * b : 0;
    this.sun.intensity = (s === 'consistent' ? 0 : s === 'realistic' ? this.sunBase * 2.6 : this.sunBase) * b * this.sunScale;
    this.sky.intensity = (s === 'consistent' ? 0 : s === 'realistic' ? this.skyBase * 0.05 : this.skyBase) * b;
    this.fill.intensity = (s === 'shaded' || s === 'hidden' ? 0.6 : 0) * b;
    this.scene.environmentIntensity = 0.22 * b;
  }

  /** Shadows drawn: those the site asks, or Realistic's own while the sun is up; materials compiled again for them. */
  private applyShadows(recompile = false): void {
    const up = this.sunWay === null || this.sunWay.z > 0;
    const on = (this.siteShadows && this.sunWay !== null && this.sunWay.z > 0) || (this.style === 'realistic' && up);
    const changed = on !== this.shadows;
    this.shadows = on;
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    this.shadowGround.visible = on;
    this.placeSun();
    this.castShadows();
    if (changed || recompile)
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        for (const x of Array.isArray(m) ? m : m ? [m] : []) x.needsUpdate = true;
      });
  }

  /**
   * The post-processing the look needs (ambient occlusion, multisampled), built when that changes; none
   * when the quality asks none, in hidden lines and consistent colours, and while a cut or a box clips
   * (the occlusion's own pass would see what is clipped away).
   */
  private effects(w: number, h: number): EffectComposer | null {
    const ao = QUALITY[this.quality].ao && (this.style === 'shaded' || this.style === 'realistic') && this.clip.length === 0 && !this.xrayOn;
    const key = ao ? `ao|${this.orthoOn}` : '';
    if (this.composer?.key !== key) {
      this.composer?.fx.dispose();
      this.composer = null;
      if (ao) {
        const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
        const fx = new EffectComposer(this.renderer, target);
        fx.setPixelRatio(this.renderer.getPixelRatio());
        fx.setSize(w, h);
        const first = new RenderPass(this.scene, this.camera);
        const gtao = new GTAOPass(this.scene, this.camera, w, h);
        gtao.blendIntensity = 0.8;
        fx.addPass(first);
        fx.addPass(gtao);
        fx.addPass(new OutputPass());
        this.composer = { fx, key, passes: [first, gtao] };
      }
    }
    if (!this.composer) return null;
    for (const p of this.composer.passes) p.camera = this.camera;
    return this.composer.fx;
  }

  /** One frame as the look draws it: hidden lines with every surface white for the frame, then put back. */
  private draw(w: number, h: number, resized: boolean): void {
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    if (this.style === 'hidden')
      for (const { group } of this.walls.values())
        group.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          swapped.push([mesh, mesh.material]);
          mesh.material = this.hiddenFace;
        });
    const fx = this.effects(w, h);
    if (fx) {
      if (resized) {
        fx.setPixelRatio(this.renderer.getPixelRatio());
        fx.setSize(w, h);
      }
      fx.render();
    } else this.renderer.render(this.scene, this.camera);
    for (const [mesh, m] of swapped) mesh.material = m;
  }

  /**
   * The section box (section-box.ts): everything outside it clipped away, by six planes facing in.
   * Plan x, y and height z are three.js x, −z and y.
   */
  setBox(box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null): void {
    const key = JSON.stringify(box);
    if (key === this.boxKey) return;
    this.boxKey = key;
    this.boxBox = box;
    this.boxPlanes = box
      ? [
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x),
          new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x),
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.z),
          new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.z),
          // Plan y ≥ min: three.js z ≤ −min.
          new THREE.Plane(new THREE.Vector3(0, 0, -1), -box.min.y),
          new THREE.Plane(new THREE.Vector3(0, 0, 1), box.max.y),
        ]
      : [];
    this.clipPlanes();
    this.syncBoxCaps();
    this.invalidate();
  }

  /** A vertical section (section-box.ts): what lies behind its line clipped away, its cut filled. */
  setSection(s: SectionLine | null): void {
    if (JSON.stringify(s) === JSON.stringify(this.sectionLine)) return;
    this.sectionLine = s;
    if (s) {
      const n = sectionLooks(s);
      // Kept: n · (p − point) ≥ 0, with plan (x, y) at three.js (x, −z).
      this.sectionPlane = new THREE.Plane(new THREE.Vector3(n.x, 0, -n.y), -(n.x * s.point.x + n.y * s.point.y));
    } else this.sectionPlane = null;
    this.clipPlanes();
    this.syncBoxCaps();
    this.invalidate();
  }

  /** The box's fills, again when the box, the walls or the lifts changed. */
  private syncBoxCaps(): void {
    const box = this.boxBox;
    const src = this.lastSync;
    const levels = src ? [...new Set([...src.g.solids.values()].map((s) => s.wall.levelId))] : [];
    // The walls and floors by identity (a new derived geometry is a change), the box and lifts by value.
    const key: unknown[] = [src?.g.solids, src?.g.kinds, JSON.stringify([box, this.sectionLine, levels.map((l) => src!.lift(l))])];
    if (key.every((k, i) => k === this.boxCapsKey[i])) return;
    this.boxCapsKey = key;
    for (const c of [...this.boxCapGroup.children]) {
      this.boxCapGroup.remove(c);
      if (c instanceof THREE.Mesh) c.geometry.dispose();
    }
    if ((!box && !this.sectionLine) || !src) return;
    const prisms: UprightPrism[] = [];
    for (const s of src.g.solids.values()) {
      const up = src.lift(s.wall.levelId);
      for (const b of s.blocks) prisms.push({ polygon: b.polygon, bottom: b.bottom + up, top: b.top + up, ...(b.plane ? { plane: { ...b.plane, c: b.plane.c + up } } : {}) });
    }
    // The registry's kinds that a cut fills (a floor: contract.ts, caps).
    for (const x of eachSolid(src.g.kinds)) {
      if (!x.kind.caps || x.levelId === null) continue;
      const up = src.lift(x.levelId);
      for (const c of x.kind.caps(x.solid)) prisms.push({ polygon: c.polygon, bottom: c.bottom + up, top: c.top + up });
    }
    // A hair inside the box, so the face it lies on does not clip it away.
    const e = 0.0005;
    const inside = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo + e), hi - e);
    if (this.sectionLine) {
      // A hair on the kept side of the section's plane, for the same reason.
      const n = sectionLooks(this.sectionLine);
      for (const cap of sectionCaps(prisms, this.sectionLine)) {
        const pts = cap.map((p) => toThree({ x: p.x + n.x * e, y: p.y + n.y * e }, p.z));
        this.boxCapGroup.add(new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([pts[0]!, pts[1]!, pts[2]!, pts[0]!, pts[2]!, pts[3]!]), this.boxCapMaterial));
      }
    }
    if (!box) return;
    for (const cap of boxCaps(prisms, box)) {
      const pts = cap.map((p) => toThree({ x: inside(p.x, box.min.x, box.max.x), y: inside(p.y, box.min.y, box.max.y) }, inside(p.z, box.min.z, box.max.z)));
      let geo: THREE.BufferGeometry;
      if (cap.every((p) => p.z === cap[0]!.z)) {
        // A top or a bottom: the outline may be any polygon.
        geo = new THREE.ShapeGeometry(new THREE.Shape(cap.map((p) => new THREE.Vector2(p.x, p.y))));
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, pts[0]!.y, 0);
      } else {
        geo = new THREE.BufferGeometry().setFromPoints([pts[0]!, pts[1]!, pts[2]!, pts[0]!, pts[2]!, pts[3]!]);
      }
      this.boxCapGroup.add(new THREE.Mesh(geo, this.boxCapMaterial));
    }
  }

  /** The cut and the box into the planes every material shares (changed in place). */
  private clipPlanes(): void {
    this.clip.length = 0;
    if (this.cutPlane) this.clip.push(this.cutPlane);
    this.clip.push(...this.boxPlanes);
    if (this.sectionPlane) this.clip.push(this.sectionPlane);
    this.capClip.length = 0;
    this.capClip.push(...this.boxPlanes);
  }

  /**
   * Orthographic or perspective, the view kept as seen: the same direction and target, and the model
   * the same size in the middle of the view.
   */
  setOrtho(on: boolean): void {
    if (on === this.orthoOn) return;
    const from = this.camera;
    const to = on ? this.ortho : this.persp;
    const target = this.controls.target;
    const dist = from.position.distanceTo(target);
    const tan = Math.tan((this.persp.fov * Math.PI) / 360);
    if (on) {
      this.orthoHalf = dist * tan;
      this.ortho.zoom = 1;
      to.position.copy(from.position);
    } else {
      // Back at the distance where the perspective shows what the parallel view showed.
      const d = this.orthoHalf / this.ortho.zoom / tan;
      to.position.copy(target).add(from.position.clone().sub(target).setLength(d));
    }
    to.quaternion.copy(from.quaternion);
    to.up.copy(from.up);
    this.orthoOn = on;
    this.controls.object = to;
    this.controls.update();
    this.offsetDirty = true;
    this.invalidate();
  }

  /**
   * Doors and windows drawn open: all of them while walking (a closed leaf filled the view of whoever
   * walked through it), and those opened one by one (a double click, the selection's Open).
   */
  private doorsOpen = false;
  private opened: ReadonlySet<string> = new Set();
  setDoorsOpen(open: boolean, opened: ReadonlySet<string> = new Set()): void {
    this.doorsOpen = open;
    this.opened = opened;
  }
  private isOpen(id: string): boolean {
    return this.doorsOpen || this.opened.has(id);
  }

  private flight = 0;
  /**
   * The camera flown to a position and target over `ms` (a tour's stop, tour-dialog.ts), easing in and
   * out; a new flight takes over from where the last one was.
   */
  flyTo(position: readonly [number, number, number], target: readonly [number, number, number], ms: number): void {
    cancelAnimationFrame(this.flight);
    this.setOrtho(false);
    const p0 = this.persp.position.clone();
    const t0 = this.controls.target.clone();
    const p1 = new THREE.Vector3(...position);
    const t1 = new THREE.Vector3(...target);
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.persp.position.lerpVectors(p0, p1, e);
      this.controls.target.lerpVectors(t0, t1, e);
      this.persp.up.set(0, 1, 0);
      this.controls.update();
      this.invalidate();
      if (k < 1) this.flight = requestAnimationFrame(step);
    };
    this.flight = requestAnimationFrame(step);
  }

  /** A flight under way stops where it is (a tour stopped). */
  stopFlight(): void {
    cancelAnimationFrame(this.flight);
  }

  /** The camera as it was before walking, given back when the walk ends. */
  private beforeWalk: { position: THREE.Vector3; target: THREE.Vector3; ortho: boolean } | null = null;

  /** A walk begins (app/walk.ts): the orbit put aside, the perspective camera at the walker's eyes. */
  startWalk(): void {
    // A tour's flight still under way would carry the camera off the walker's eyes, frame by frame.
    this.stopFlight();
    if (this.beforeWalk) return;
    this.beforeWalk = { position: this.camera.position.clone(), target: this.controls.target.clone(), ortho: this.orthoOn };
    this.setOrtho(false);
    this.controls.enabled = false;
    // A person's view: wider than the overview's lens, or a room's walls filled it from its middle.
    this.persp.fov = WALK_FOV;
    this.persp.updateProjectionMatrix();
  }

  /** The walker's eyes (plan x, y and height z) looking along yaw and pitch. */
  setWalkView(eye: { x: number; y: number; z: number }, yaw: number, pitch: number): void {
    const at = toThree({ x: eye.x, y: eye.y }, eye.z);
    const look = toThree({ x: eye.x + Math.cos(yaw) * Math.cos(pitch), y: eye.y + Math.sin(yaw) * Math.cos(pitch) }, eye.z + Math.sin(pitch));
    this.persp.position.copy(at);
    this.persp.up.set(0, 1, 0);
    this.persp.lookAt(look);
    this.persp.updateMatrixWorld();
    this.invalidate();
  }

  /** The walk ends: the camera and the orbit back as they were. */
  endWalk(): void {
    const was = this.beforeWalk;
    if (!was) return;
    this.beforeWalk = null;
    this.persp.fov = VIEW_FOV;
    this.persp.updateProjectionMatrix();
    this.persp.position.copy(was.position);
    this.controls.target.copy(was.target);
    this.controls.enabled = true;
    this.controls.update();
    if (was.ortho) this.setOrtho(true);
    this.invalidate();
  }

  /** Colours of the theme, read from the design tokens: `token('--3d-side')` and so on. */
  setTheme(dark: boolean, token: (name: string) => string): void {
    const c = (name: string) => new THREE.Color(token(name));
    this.scene.background = c('--canvas');
    const m = this.materials;
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
    this.capMaterial.color = c('--3d-cut');
    this.boxCapMaterial.color = c('--3d-cut');
    this.edgeMaterial.color = c('--3d-edge');
    (this.ground.material as THREE.MeshBasicMaterial).color = c('--3d-ground');
    // The wall layers keep their materials' own colours in both themes, lit by the scene's light.
    this.sky.color = c('--3d-light');
    this.sky.groundColor = c('--3d-ground-light');
    this.sun.color = c('--3d-light');
    this.fill.color = c('--3d-light');
    // The ground grid in both themes, faint, under everything (placeGround).
    this.grid.visible = true;
    const lines = this.grid.geometry.getAttribute('color');
    // GridHelper colours its lines per vertex: centre lines one colour, the rest another.
    const major = c('--grid-major');
    const minor = c('--grid-minor');
    for (let i = 0; i < lines.count; i++) {
      const centre = i < 4;
      const k = centre ? major : minor;
      lines.setXYZ(i, k.r, k.g, k.b);
    }
    lines.needsUpdate = true;
    const gm = this.grid.material as THREE.Material | THREE.Material[];
    (Array.isArray(gm) ? gm : [gm]).forEach((x) => {
      x.transparent = true;
      // Lines on a dark canvas read fainter: a little more of them.
      x.opacity = dark ? 0.5 : 0.35;
      x.needsUpdate = true;
    });
    this.invalidate();
  }

  invalidate(): void {
    this.needsRender = true;
    if (this.raf === 0) this.raf = requestAnimationFrame(() => this.render());
  }

  private render(): void {
    this.raf = 0;
    if (!this.needsRender) return;
    this.needsRender = false;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    const resized = size.x !== w || size.y !== h || this.offsetDirty;
    if (resized) {
      this.renderer.setSize(w, h, false);
      this.persp.aspect = w / h;
      Object.assign(this.ortho, { left: -this.orthoHalf * (w / h), right: this.orthoHalf * (w / h), top: this.orthoHalf, bottom: -this.orthoHalf });
      // Framed beside a panel: the view's centre is the part it left visible (see shift).
      if (this.shift.x !== 0 || this.shift.y !== 0) this.camera.setViewOffset(w, h, this.shift.x, this.shift.y, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.offsetDirty = false;
    }
    this.draw(w, h, resized);
    // The projection changed (first frame, new size, panel): what is placed over the view by
    // projecting through the camera (the floating bar, the cube) must be placed again.
    if (resized) this.onChange();
  }

  /**
   * The view as it is, drawn once larger (its long side `long` pixels, the drawing buffer's limit
   * at most) for a picture: the same camera, framing, sun and shadows; the view back to the screen's
   * size after. A PNG, or null when the browser gives none.
   */
  async snapshot(long: number): Promise<Blob | null> {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return null;
    const gl = this.renderer.getContext();
    const max = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number, ...(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array));
    const k = Math.min(long, max) / Math.max(w, h);
    const W = Math.round(w * k);
    const H = Math.round(h * k);
    const ratio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    if (this.shift.x !== 0 || this.shift.y !== 0) this.camera.setViewOffset(W, H, this.shift.x * k, this.shift.y * k, W, H);
    this.camera.updateProjectionMatrix();
    // The shadows as fine as the picture: their map four times the screen's, as far as the card goes;
    // at the screen's size their edges came out in steps.
    const shadow = this.sun.shadow;
    const screenMap = shadow.mapSize.x;
    const fine = Math.min(screenMap * 4, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    const remap = (size: number) => {
      shadow.mapSize.set(size, size);
      shadow.map?.dispose();
      shadow.map = null;
    };
    if (this.shadows && fine > screenMap) remap(fine);
    this.draw(W, H, true);
    // Taken now, before the next frame clears the drawing buffer.
    const blob = new Promise<Blob | null>((done) => this.canvas.toBlob(done, 'image/png'));
    if (shadow.mapSize.x !== screenMap) remap(screenMap);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    // The next frame sets the projection for the screen again.
    this.offsetDirty = true;
    this.invalidate();
    return blob;
  }

  /**
   * Brings the meshes in line with the geometry: only walls whose shape or state changed are rebuilt.
   * `lift`: how far up each level is drawn (an exploded view), by level id.
   */
  sync(g: DerivedGeometry, selected: ReadonlySet<WallId>, preview: ReadonlySet<WallId>, lift: (levelId: string) => number = () => 0): void {
    const seen = new Set<WallId>();
    // Moved up or down as a whole, never rebuilt for it: the lift is not part of any key.
    const place = (id: WallId, levelId: string) => {
      const w = this.walls.get(id);
      if (w) w.group.position.y = lift(levelId);
    };
    for (const o of g.openings.values()) {
      if (!o.frame) continue;
      const id = o.opening.id;
      seen.add(id);
      const state = preview.has(id) ? 'p' : selected.has(id) ? 's' : o.valid ? 'n' : 'i';
      let shape = this.shapeKeys.get(o);
      if (shape === undefined) this.shapeKeys.set(o, (shape = JSON.stringify([o.frame, o.opening, o.bottom, o.top])));
      const key = state + (this.isOpen(id) ? 'o' : '') + shape;
      const old = this.walls.get(id);
      const levelId = g.solids.get(o.opening.wallId)?.wall.levelId ?? '';
      if (old?.key === key) {
        place(id, levelId);
        continue;
      }
      if (old) this.drop(old.group);
      const group = this.buildOpening(o, state);
      group.userData.wallId = id;
      this.scene.add(group);
      this.walls.set(id, { group, key });
      place(id, levelId);
    }
    // The registry's kinds (elements/registry.ts): each gives its solid; rebuilt only when it changed.
    for (const x of eachSolid(g.kinds)) {
      // Texts and axes are drawn in plan only (no solid, no level of their own for an axis).
      if (!x.kind.solid || x.levelId === null) continue;
      seen.add(x.id);
      const state = selected.has(x.id) ? 's' : 'n';
      let k = this.shapeKeys.get(x.solid as object);
      // What it derives (its level's heights too), not only the element: raising the level rebuilds it.
      if (k === undefined) this.shapeKeys.set(x.solid as object, (k = JSON.stringify(x.solid)));
      const key = state + k;
      const old = this.walls.get(x.id);
      if (old?.key === key) {
        place(x.id, x.levelId);
        continue;
      }
      if (old) this.drop(old.group);
      const made = x.kind.solid?.(x.solid);
      if (!made) continue;
      const group = new THREE.Group();
      // One solid, or several (an object's parts), each in a scene material or a project material.
      for (const part of Array.isArray(made) ? (made as readonly KindSolid[]) : [made as KindSolid]) {
        const material = state === 's' ? this.materials.sideSel : typeof part.material === 'string' ? this.materials[part.material] : this.layerMaterial(part.material);
        const mesh = new THREE.Mesh(part.geometry, material);
        mesh.position.y = part.y;
        if (part.edges) mesh.add(this.outline(part.geometry));
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
      this.scene.add(group);
      this.walls.set(x.id, { group, key });
      place(x.id, x.levelId);
    }
    const faces = this.facesOf(g);
    for (const s of g.solids.values()) {
      seen.add(s.wall.id);
      // A material's colour or finish changed keeps the walls' meshes: their materials take it here.
      for (const m of s.materials) this.layerMaterial(m);
      const state = preview.has(s.wall.id) ? 'p' : selected.has(s.wall.id) ? 's' : 'n';
      // The shape's part of the key, once per solid: solids are only replaced when the geometry is
      // computed again, and a switch of view (148 walls) stringified every block each time.
      let shape = this.shapeKeys.get(s);
      // What shows of a wall depends on its neighbours too (faces.ts): their faces are in the key.
      const mine = faces.get(s.wall.id) ?? [];
      if (shape === undefined) this.shapeKeys.set(s, (shape = wallMeshKey('', s.blocks, s.materials) + JSON.stringify(mine)));
      // A wall's phase (its id's, an arc's segments being "id#k") colours it whole.
      const phase = this.phases.get(s.wall.id.split('#')[0]!);
      const key = state + (phase ?? '') + shape;
      const old = this.walls.get(s.wall.id);
      if (old?.key === key) {
        place(s.wall.id, s.wall.levelId);
        continue;
      }
      if (old) this.drop(old.group);
      const group = this.build(s, state, mine, phase);
      group.userData.wallId = s.wall.id;
      this.scene.add(group);
      this.walls.set(s.wall.id, { group, key });
      place(s.wall.id, s.wall.levelId);
    }
    for (const [id, w] of this.walls) {
      if (!seen.has(id)) {
        this.drop(w.group);
        this.walls.delete(id);
      }
    }
    this.syncEdges(g, lift);
    this.lastSync = { g, lift };
    this.syncBoxCaps();
    this.placeGround(g);
    this.invalidate();
  }

  /** The lines over the walls, again only when the walls changed; lifted with their levels. */
  private syncEdges(g: DerivedGeometry, lift: (levelId: string) => number): void {
    if (this.edgesOf !== g.solids) {
      this.edgesOf = g.solids;
      for (const l of this.edges.values()) {
        this.scene.remove(l);
        l.geometry.dispose();
      }
      this.edges.clear();
      const faces = this.facesOf(g);
      const byLevel = new Map<string, { prisms: WallSolid['blocks'][number][]; faces: PrismFaces[]; sloped: SlopedTop[] }>();
      for (const s of g.solids.values()) {
        const mine = faces.get(s.wall.id) ?? [];
        const level = byLevel.get(s.wall.levelId) ?? { prisms: [], faces: [], sloped: [] };
        s.blocks.forEach((b, i) => {
          if (!mine[i]) return;
          level.prisms.push(b);
          level.faces.push(mine[i]!);
          // Under a roof: seen up to its highest point, then cut to its slope (edges.ts, underSlopes).
          if (b.plane) level.sloped.push({ polygon: b.polygon, plane: b.plane, faces: mine[i] });
        });
        byLevel.set(s.wall.levelId, level);
      }
      for (const [levelId, { prisms, faces: shown, sloped }] of byLevel) {
        const pos: number[] = [];
        for (const e of underSlopes(featureEdges(prisms, shown), sloped)) pos.push(e.a.x, e.a.z, -e.a.y, e.b.x, e.b.z, -e.b.y);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const lines = new THREE.LineSegments(geo, this.edgeMaterial);
        // Never picked: a line's pick reaches a metre around it.
        lines.raycast = () => {};
        this.scene.add(lines);
        this.edges.set(levelId, lines);
      }
    }
    for (const [levelId, l] of this.edges) l.position.y = lift(levelId);
  }

  /**
   * The sun of the site (app/sun.ts): `way` to it in plan and height (unit), null for the view's fixed
   * light; below the horizon it gives no light. With `shadows`, every solid casts and takes them.
   */
  setSun(way: { readonly x: number; readonly y: number; readonly z: number } | null, shadows: boolean): void {
    const key = JSON.stringify([way, shadows]);
    if (key === JSON.stringify([this.sunWay, this.siteShadows])) return;
    this.sunWay = way;
    this.siteShadows = shadows;
    // Materials compiled without shadows are compiled again with them (applyShadows).
    this.applyShadows();
    this.invalidate();
  }

  /** The sun where its way points, far over the model's middle, its shadow camera round the model. */
  private placeSun(): void {
    const c = this.ground.position;
    const reach = Math.max(10, this.ground.scale.x / GROUND_SPAN);
    if (!this.sunWay) {
      // The view's fixed light: up and to the left, far enough over the model to cast its shadows.
      const fixed = new THREE.Vector3(-8, 14, 10).normalize().multiplyScalar(reach * 2);
      this.sun.position.set(c.x + fixed.x, c.y + fixed.y, c.z + fixed.z);
      this.sun.target.position.copy(c);
      this.sunBase = 1.5;
      this.skyBase = 2.7;
    } else {
      const w = this.sunWay;
      // Plan (x, y, up) to three.js (x, up, −y).
      this.sun.position.set(c.x + w.x * reach * 2, Math.max(0, c.y) + w.z * reach * 2, c.z - w.y * reach * 2);
      this.sun.target.position.copy(c);
      // Below the horizon no sun; low, a weaker one; the sky darker at night.
      const up = Math.max(0, w.z);
      this.sunBase = up > 0 ? 0.6 + 1.6 * Math.min(1, up * 2) : 0;
      this.skyBase = 0.8 + 1.9 * Math.min(1, up * 3);
    }
    this.applyLights();
    const cam = this.sun.shadow.camera;
    cam.left = -reach * 1.5;
    cam.right = reach * 1.5;
    cam.top = reach * 1.5;
    cam.bottom = -reach * 1.5;
    cam.near = 0.5;
    cam.far = reach * 6;
    cam.updateProjectionMatrix();
    this.shadowGround.position.set(c.x, c.y + 0.001, c.z);
    this.shadowGround.scale.set(this.ground.scale.x, this.ground.scale.y, 1);
  }

  /** Every solid casts and takes shadows while they are on. */
  private castShadows(): void {
    for (const { group } of this.walls.values())
      group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = this.shadows;
          o.receiveShadow = this.shadows;
        }
      });
  }

  /** The ground centred under the walls and floors shown, GROUND_SPAN times as wide, just under the lowest of them. */
  private placeGround(g: DerivedGeometry): void {
    const solids = [...g.solids.values()];
    // And the registry's with a height (a floor: contract.ts, span).
    const spanned = [...eachSolid(g.kinds)].flatMap((x) => (x.kind.span ? [{ outline: x.kind.outlines(x.solid).flat(), bottom: x.kind.span(x.solid).bottom }] : []));
    const points = [...solids.flatMap((s) => [s.wall.start, s.wall.end]), ...spanned.flatMap((f) => f.outline)];
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const [x0, x1, y0, y1] = points.length > 0 ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 0, 0, 0];
    const size = Math.max(GROUND_MIN, GROUND_SPAN * Math.max(x1 - x0, y1 - y0));
    // A terrain's block of soil goes SOIL_DEPTH under its surface's lowest point: the ground under that.
    const spannedBottoms = [...eachSolid(g.kinds)].flatMap((x) => (x.kind.span ? [x.kind.span(x.solid).bottom - (x.kind.key === 'terrains' ? SOIL_DEPTH : 0)] : []));
    const lowest = Math.min(0, ...solids.map((s) => s.bottom), ...spannedBottoms);
    this.ground.scale.set(size, size, 1);
    this.ground.position.set((x0 + x1) / 2, lowest - 0.002, -(y0 + y1) / 2);
    // The grid at the ground's height, round the model's middle, a metre a cell.
    this.grid.position.set(Math.round((x0 + x1) / 2), lowest - 0.001, Math.round(-(y0 + y1) / 2));
    this.placeSun();
    if (this.shadows) this.castShadows();
  }

  /**
   * The faces of every wall's blocks that show (faces.ts), by wall, once per derived geometry: the
   * faces between touching blocks, coplanar and facing, were drawn both and fought for the same pixels
   * (light specks on the walls). Blocks of every level and wall together, as joins span walls.
   */
  private facesCache: { solids: DerivedGeometry['solids']; faces: Map<WallId, PrismFaces[]> } | null = null;
  private facesOf(g: DerivedGeometry): Map<WallId, PrismFaces[]> {
    if (this.facesCache?.solids === g.solids) return this.facesCache.faces;
    const owners: WallId[] = [];
    const prisms = [...g.solids.values()].flatMap((s) => s.blocks.map((b) => (owners.push(s.wall.id), b)));
    const all = visibleFaces(prisms);
    const faces = new Map<WallId, PrismFaces[]>();
    all.forEach((f, i) => faces.set(owners[i]!, [...(faces.get(owners[i]!) ?? []), f]));
    this.facesCache = { solids: g.solids, faces };
    return faces;
  }

  private build(s: WallSolid, state: 'p' | 's' | 'n', faces: readonly PrismFaces[], phase?: 'new' | 'existing' | 'demolish'): THREE.Group {
    const group = new THREE.Group();
    // Each block in its layer's material, as in plan (wall-paint.ts); a wall with a phase all in its phase's.
    const byPhase = phase && state === 'n' ? this.phaseMaterials.get(phase) : undefined;
    const material = (paint: Paint): THREE.Material => byPhase ?? (typeof paint === 'string' ? this.materials[paint] : this.layerMaterial(paint));
    s.blocks.forEach((b, i) => {
      const { side, top } = blockPaint(s.materials, b.layerIndex, state);
      const f = faces[i];
      const geo = b.plane ? slopedPrism(b.polygon, b.bottom, b.plane, f) : f ? shownPrism(b.polygon, b.bottom, b.top, f) : prism(b.polygon, b.bottom, b.top);
      group.add(new THREE.Mesh(geo, [material(side), material(top)]));
    });
    return group;
  }

  /** A door or window: its parts (opening/parts.ts), each in its role's material, or all in the state's. */
  private buildOpening(o: OpeningSolid, state: 'p' | 's' | 'n' | 'i'): THREE.Group {
    const group = new THREE.Group();
    const m = this.materials;
    const shown = state === 'p' ? m.preview : state === 's' ? m.topSel : state === 'i' ? m.invalid : null;
    for (const part of openingParts(o, o.frame!, this.isOpen(o.opening.id))) {
      const mat = shown ?? (part.role === 'leaf' ? m.leaf : part.role === 'glass' ? m.glass : m.frame);
      const geo = prism(part.polygon, part.bottom, part.top);
      if (part.turn) {
        // Tilted about its level axis: three.js's (x, height, −y) for the plan's (x, y, height).
        const { origin, axis, angle } = part.turn;
        const o3 = new THREE.Vector3(origin.x, origin.z, -origin.y);
        const r = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(axis.x, 0, -axis.y).normalize(), angle);
        geo.applyMatrix4(new THREE.Matrix4().makeTranslation(-o3.x, -o3.y, -o3.z)).applyMatrix4(r).applyMatrix4(new THREE.Matrix4().makeTranslation(o3.x, o3.y, o3.z));
      }
      group.add(new THREE.Mesh(geo, [mat, mat]), this.outline(geo));
    }
    return group;
  }

  /** A floor's or an opening's edges, as the walls' lines (never picked). */
  private outline(geo: THREE.BufferGeometry): THREE.LineSegments {
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), this.edgeMaterial);
    lines.raycast = () => {};
    return lines;
  }

  private drop(group: THREE.Group): void {
    this.scene.remove(group);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
    });
  }

  /** The wall under a screen point, by ray cast. */
  pick(clientX: number, clientY: number): WallId | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObjects([...this.walls.values()].map((w) => w.group), true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o.userData.wallId === undefined) o = o.parent;
    return (o?.userData.wallId as WallId | undefined) ?? null;
  }

  /**
   * The point seen under a screen point, on the first element hit that `accept` takes (by id): in
   * plan coordinates, with the height it was hit at. Drawing on a wall's top in a perspective, the
   * floor plane alone gave the point far behind it, where the line of sight meets the floor.
   */
  surfacePoint(clientX: number, clientY: number, accept: (id: string) => boolean): { p: Point2; height: number } | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const groups = [...this.walls.entries()].filter(([id]) => accept(id)).map(([, w]) => w.group);
    const hit = ray.intersectObjects(groups, true)[0];
    return hit ? { p: { x: hit.point.x, y: -hit.point.z }, height: hit.point.y } : null;
  }

  /** Where a screen point meets the horizontal plane at height z, in world plan coordinates. */
  groundPoint(clientX: number, clientY: number, z: number): Point2 | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -z), new THREE.Vector3());
    return hit ? { x: hit.x, y: -hit.z } : null;
  }

  /** Metres per screen pixel at a world point, for snapping. */
  metresPerPixel(p: Point2, z: number): number {
    const h = this.canvas.clientHeight || 1;
    if (this.orthoOn) return (2 * this.orthoHalf) / this.ortho.zoom / h;
    const d = this.persp.position.distanceTo(toThree(p, z));
    return (2 * d * Math.tan((this.persp.fov * Math.PI) / 360)) / h;
  }

  /** How much a panel covers at the right and bottom edges of the canvas (screen pixels). */
  /** The view moved on screen by (dx, dy) px, the camera left where it is: a selection brought out from under a panel. */
  panScreen(dx: number, dy: number): void {
    this.shift = { x: this.shift.x - dx, y: this.shift.y - dy };
    this.offsetDirty = true;
    this.invalidate();
  }

  setCovered(covered: { right: number; bottom: number; left?: number }): void {
    const next = { right: covered.right, bottom: covered.bottom, left: covered.left ?? 0 };
    if (next.right === this.covered.right && next.bottom === this.covered.bottom && next.left === this.covered.left) return;
    this.covered = next;
    this.offsetDirty = true;
    this.invalidate();
  }

  frame(box: { min: Point2; max: Point2 } | null, height: number, dir = new THREE.Vector3(0.55, 0.62, 0.75)): void {
    const b = box ?? { min: { x: -1, y: -1 }, max: { x: 9, y: 7 } };
    const center = toThree({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 }, height / 2);
    const radius = Math.max(1, Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y, height) / 2);
    // Fit in the visible part: its aspect, and the share of the height it keeps.
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const visW = Math.max(w - this.covered.right - this.covered.left, w * 0.3);
    const visH = Math.max(h - this.covered.bottom, h * 0.3);
    this.controls.target.copy(center);
    // Centred in what the panels leave visible now.
    this.shift = { x: (this.covered.right - this.covered.left) / 2, y: this.covered.bottom / 2 };
    this.offsetDirty = true;
    if (this.orthoOn) {
      // As tall as the model needs, from far enough that nothing is behind the camera.
      this.orthoHalf = ((radius * 1.05) / Math.min(1, visW / visH)) * (h / visH);
      this.ortho.zoom = 1;
      this.offsetDirty = true;
      this.camera.position.copy(center).add(dir.clone().normalize().multiplyScalar(radius * 4 + 20));
    } else {
      const fit = (radius / Math.sin((this.persp.fov * Math.PI) / 360) / Math.min(1, visW / visH)) * (h / visH);
      this.camera.position.copy(center).add(dir.clone().normalize().multiplyScalar(fit * 1.05));
    }
    this.camera.up.set(0, 1, 0);
    this.controls.update();
    this.invalidate();
  }

  /**
   * The camera by keyboard: turned about its target (radians across and up), and moved toward it or
   * away (`zoom` > 1 nearer), within the limits the mouse has.
   */
  orbit(across: number, up: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const s = new THREE.Spherical().setFromVector3(offset);
    s.theta -= across;
    s.phi = Math.min(Math.max(s.phi - up, 0.05), this.controls.maxPolarAngle);
    this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(s));
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.invalidate();
  }

  zoomBy(zoom: number): void {
    if (this.orthoOn) {
      this.ortho.zoom = Math.min(Math.max(this.ortho.zoom * zoom, 0.02), 200);
      this.ortho.updateProjectionMatrix();
      this.controls.update();
      return this.invalidate();
    }
    const offset = this.camera.position.clone().sub(this.controls.target);
    const d = Math.min(Math.max(offset.length() / zoom, this.controls.minDistance), this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(d));
    this.controls.update();
    this.invalidate();
  }

  dispose(): void {
    for (const w of this.walls.values()) this.drop(w.group);
    Object.values(this.materials).forEach((m) => m.dispose());
    this.layerMaterials.forEach((m) => {
      (m.userData.pattern as PatternUniforms | undefined)?.uPatMap.value?.dispose();
      m.dispose();
    });
    for (const l of this.edges.values()) l.geometry.dispose();
    this.edgeMaterial.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

