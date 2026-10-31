// 3D view. Reads derived geometry, draws, syncs meshes by wall id, disposes what it drops, and
// renders only when something changed. World (x, y, height) maps to three.js (x, height, −y).
// Each convex piece is a prism; pieces are disjoint by construction, so no 3D boolean exists.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer';
import type { RenderQuality, VisualStyle } from '../session/view/view-3d';
import type { Point2 } from '../model/vector';
import type { DerivedGeometry } from '../project/derive';
import type { WallId } from '../elements/wall/schema';
import { wallMeshKey } from './wall-paint';
import type { PrismFaces } from '../elements/wall/geometry/faces';
import { toThree } from '../elements/prisms';
import { eachSolid } from '../elements/registry';
import type { KindSolid } from '../elements/contract';
import { type SectionBox, type SectionLine, sectionLooks } from '../model/section-box';
import { type Compiling, photoSky, trace, TRACE } from './scene-trace';
import { applyEdges, setFaint, layerMaterial, lifelike, type PatternUniforms, prepare, XRAY_OPACITY } from './scene-materials';
import { build, buildOpening, clipPlanes, drop, facesOf, outline, syncBoxCaps, syncEdges } from './scene-build';
import { GROUND_MIN, groundFade, placeGround } from './scene-light';
import { applyLights, applyShadows, effects, QUALITY } from './scene-light';

/** Vertical field of view (degrees). */
const VIEW_FOV = 40;

/** A luminaire's point light per lumen: 900 lm give the floor 1.75 m under it about 0.5, a third of the sun. */
const LAMP_SCALE = (0.5 * 1.75 * 1.75) / 900;

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  private readonly persp = new THREE.PerspectiveCamera(VIEW_FOV, 1, 0.05, 2000);
  /**
   * Orthographic, as elevations and sections are drawn (Revit's parallel views): no perspective, sizes
   * true at any depth. `orthoHalf`: half the view's height in metres at zoom 1.
   */
  private readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 4000);
  orthoOn = false;
  private orthoHalf = 5;
  /** The camera in use: the perspective one, or the orthographic one (setOrtho). */
  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.orthoOn ? this.ortho : this.persp;
  }
  readonly controls: OrbitControls;
  readonly scene = new THREE.Scene();
  readonly walls = new Map<WallId, { group: THREE.Group; key: string }>();
  // Colours come from the design tokens (styles.css, --3d-*), set in setTheme.
  /** Each solid's shape key (wallMeshKey without the state), kept while the solid lives. */
  private readonly shapeKeys = new WeakMap<object, string>();
  /** One three.js material per project material (elements/material), its colour and finish kept up to date. */
  readonly layerMaterials = new Map<string, THREE.MeshStandardMaterial>();
  /** A renovation's walls by phase (app/layer-sets.ts: wallPhases), with the overrides on; each phase's material in its token's colour. */
  private phases: ReadonlyMap<string, 'new' | 'existing' | 'demolish'> = new Map();
  readonly phaseMaterials = new Map<string, THREE.MeshStandardMaterial>();
  xrayOn = false;
  readonly materials = {
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
  readonly clip: THREE.Plane[] = [];
  /** The cut's plane and the section box's six, together in `clip`. */
  cutPlane: THREE.Plane | null = null;
  boxPlanes: THREE.Plane[] = [];
  private boxKey = '';
  /** The cut's fill is clipped by the box only: its own plane would clip it away. */
  readonly capClip: THREE.Plane[] = [];
  /** Where the box's faces go through walls and floors, filled as a cut is (section-box.ts, boxCaps). */
  readonly boxCapGroup = new THREE.Group();
  readonly boxCapMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  boxBox: SectionBox | null = null;
  sectionLine: SectionLine | null = null;
  sectionPlane: THREE.Plane | null = null;
  boxCapsKey: unknown[] = [];
  lastSync: { g: DerivedGeometry; lift: (levelId: string) => number } | null = null;
  /** Where the cut goes through walls, filled as the plan fills them (not clipped itself). */
  private readonly caps = new THREE.Group();
  private readonly capMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  /**
   * Thin lines where the surfaces turn (edges.ts), one set per level so each lifts with its level: walls
   * of one colour read apart, and so does the step of a wall off the face of the wall below it.
   */
  readonly edgeMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
  readonly edges = new Map<string, THREE.LineSegments>();
  edgesOf: DerivedGeometry['solids'] | null = null;
  private capsKey = '';
  readonly sky = new THREE.HemisphereLight(undefined, undefined, 2.7);
  readonly sun = new THREE.DirectionalLight(undefined, 1.5);
  readonly fill = new THREE.DirectionalLight(undefined, 0.6);
  /** The only light of Consistent colours: each material's own colour, as it is. */
  readonly ambient = new THREE.AmbientLight(0xffffff, 0);
  /** The sun's and the sky's strength, before the style's. */
  readonly sunBase = 1.5;
  readonly skyBase = 2.7;
  /** Shadows drawn now (Realistic's own). */
  shadows = false;
  /** The visual style and the quality (view-3d.ts), and what they need: the post-processing, the sky's reflections. */
  style: VisualStyle = 'shaded';
  /** The view's brightness and the sun's strength against the sky (view-3d.ts), multiplying the style's lights. */
  brightness = 1;
  sunScale = 1;
  quality: RenderQuality = 'medium';
  composer: { readonly fx: EffectComposer; readonly key: string; readonly passes: { camera: THREE.Camera }[] } | null = null;
  private environment: THREE.Texture | null = null;
  /** Hidden lines: every surface white, unlit, behind its edges. */
  private readonly hiddenFace = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  /** Shadows on the ground, where nothing else stands to take them. */
  readonly shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.28 }));
  private covered = { right: 0, bottom: 0, left: 0 };
  /**
   * How far the view's centre is shifted (px), set when the view is framed from what the panels
   * covered then. A panel shown or hidden later leaves it: shifting it then moved the whole model on
   * screen, with no camera move, each time a selection brought the panel in.
   */
  private shift = { x: 0, y: 0 };
  private offsetDirty = false;
  readonly grid: THREE.GridHelper;
  /**
   * The ground under the model, at its lowest base: a room with no floor shows it. Before, it showed
   * the background, a black hole among the walls in the dark theme.
   */
  readonly ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaMap: groundFade() }),
  );
  private needsRender = true;
  private raf = 0;
  /** The photorealistic style's path tracer, made the first time it is chosen; what it was last given. */
  tracer: WebGLPathTracer | null = null;
  /** The tracer's shader, for its firefly clamp (trace-shader.ts). */
  traceShader: THREE.ShaderMaterial | null = null;
  /** Its sky, an equirectangular gradient (it cannot read the realistic style's PMREM): the light from
   * everywhere a hemisphere light gives the raster view. */
  traceSky: GradientEquirectTexture | null = null;
  traceScene: THREE.Scene | null = null;
  /** The tracer's scene while it is being built (in a worker), until it is ready. */
  traceBuild: Promise<void> | null = null;
  readonly tracedPatterns = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>();
  /** The traced view's glass: clear, transmitting, of window glass's index (1.5). */
  readonly tracedGlass = new THREE.MeshPhysicalMaterial({ color: 0xf2f8fa, roughness: 0.02, metalness: 0, transmission: 1, ior: 1.5, thickness: 0.006, side: THREE.DoubleSide });
  /** Frosted glass, traced: light through it, scattered. */
  /** The traced view's ground (traceCopies): matte, a warm grey. */
  readonly tracedGround = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 1, metalness: 0 });
  readonly tracedFrosted = new THREE.MeshPhysicalMaterial({ color: 0xf4f8fa, roughness: 0.45, metalness: 0, transmission: 1, ior: 1.5, thickness: 0.006, side: THREE.DoubleSide });
  /**
   * The traced view's ground drawn in the raster view the photorealistic style shows while the trace
   * gathers its samples (after a move): with the trace's sky behind, the change to the traced picture is
   * a sharpening, not a jump from the theme's dark background and a black hole in a room with no floor.
   */
  private readonly photoGround = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.tracedGround);
  /** The photorealistic view's ground level (placeGround): the walls' foot. */
  stand = 0;
  traced = { content: -1, camera: '', light: '' };
  /** Bumped whenever an element's meshes are made or dropped: the tracer's scene is built again. */
  contentVersion = 0;
  onChange: () => void = () => {};
  /** Told when the photorealistic view starts or stops preparing (its scene built, its shader compiled). */
  onTracePreparing: (preparing: boolean) => void = () => {};
  preparing = false;
  /** Whether the photorealistic view has shown a traced picture yet. */
  traceShown = false;

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
    prepare(this, this.hiddenFace);
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
    this.photoGround.receiveShadow = true;
    this.photoGround.visible = false;
    this.scene.add(this.photoGround);
    this.renderer.localClippingEnabled = true;
    for (const m of Object.values(this.materials)) prepare(this, m);
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
    clipPlanes(this);
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
        prepare(this, m);
        m.userData.clear = p === 'demolish';
        setFaint(m, this.xrayOn);
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
    for (const m of faint) setFaint(m, on);
    applyEdges(this);
    this.invalidate();
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
    // Out of the photorealistic style, nothing is being prepared: said now, not at the next frame.
    if (style !== 'photo' && this.preparing) {
      this.preparing = false;
      this.onTracePreparing(false);
    }
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
    const realistic = lifelike(this);
    this.renderer.toneMapping = realistic ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    if (realistic && !this.environment) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    this.scene.environment = realistic ? this.environment : null;
    applyEdges(this);
    applyShadows(this, recompile);
    this.offsetDirty = true;
    this.invalidate();
  }

  /** The view's brightness and the sun's strength (view-3d.ts): every light times the first, the sun times both. */
  setLight(brightness: number, sun: number): void {
    if (brightness === this.brightness && sun === this.sunScale) return;
    this.brightness = brightness;
    this.sunScale = sun;
    applyLights(this);
    this.invalidate();
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
    if (this.style !== 'photo' && this.preparing) {
      this.preparing = false;
      this.onTracePreparing(false);
    }
    if (this.style === 'photo' && !this.xrayOn && this.clip.length === 0 && trace(this)) {
      for (const [mesh, m] of swapped) mesh.material = m;
      return;
    }
    // The photorealistic style's raster frames on the trace's sky and ground (photoGround).
    const photo = this.style === 'photo';
    const background = this.scene.background;
    const grid = this.grid.visible;
    const shadowGround = this.shadowGround.visible;
    // The realistic style on its fading ground: a room with no floor showed the background
    // through it, a black hole among the walls in the dark theme. The other styles stand on the grid.
    const realGround = this.style === 'realistic';
    if (realGround) this.ground.visible = true;
    if (photo) {
      this.scene.background = photoSky(this);
      const size = Math.max(200, this.ground.scale.x * 6);
      this.photoGround.scale.set(size, 1, size);
      this.photoGround.position.set(this.ground.position.x, this.stand - 0.002, this.ground.position.z);
      this.photoGround.visible = true;
      this.grid.visible = false;
      this.shadowGround.visible = false;
    }
    const fx = effects(this, w, h);
    if (fx) {
      if (resized) {
        fx.setPixelRatio(this.renderer.getPixelRatio());
        fx.setSize(w, h);
      }
      fx.render();
    } else this.renderer.render(this.scene, this.camera);
    if (realGround) this.ground.visible = false;
    if (photo) {
      this.scene.background = background;
      this.photoGround.visible = false;
      this.grid.visible = grid;
      this.shadowGround.visible = shadowGround;
    }
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
    clipPlanes(this);
    syncBoxCaps(this);
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
    clipPlanes(this);
    syncBoxCaps(this);
    this.invalidate();
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

  /** Doors and windows drawn open: those opened one by one (a double click, the selection's Open). */
  private opened: ReadonlySet<string> = new Set();
  setOpened(opened: ReadonlySet<string>): void {
    this.opened = opened;
  }
  isOpen(id: string): boolean {
    return this.opened.has(id);
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
    // Traced, the scene first built as it is now (in the background, as for the view).
    if (this.style === 'photo') {
      for (let n = 0; n < 5 && (this.traceBuild || this.traced.content !== this.contentVersion); n++) {
        if (!this.traceBuild) trace(this);
        await this.traceBuild;
      }
      // And its shader compiled (the first time, in the background): set going by a first sample, waited
      // for two minutes at most.
      this.tracer?.renderSample();
      for (const until = performance.now() + 120_000; this.tracer && (this.tracer as Compiling).isCompiling && performance.now() < until; ) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
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
    // Traced, the picture keeps sampling until it is clean (the quality's picture count, a minute of queuing at most): one
    // frame of the tracer is a sample, noise.
    if (this.style === 'photo' && this.tracer && this.traceScene) {
      // No fade from its coarse preview: timed by the clock, it had barely begun when the samples, queued
      // in a tenth of a second, were done, and the picture came out mostly the preview's noise.
      const fade = this.tracer.fadeDuration;
      this.tracer.fadeDuration = 0;
      const until = performance.now() + 60_000;
      while (this.tracer.samples < TRACE[this.quality].picture && performance.now() < until) this.tracer.renderSample();
      this.tracer.fadeDuration = fade;
    }
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
      if (old) drop(this, old.group);
      const group = buildOpening(this, o, state);
      group.userData.wallId = id;
      this.scene.add(group);
      this.walls.set(id, { group, key });
      this.contentVersion++;
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
      if (old) drop(this, old.group);
      const made = x.kind.solid?.(x.solid);
      if (!made) continue;
      const group = new THREE.Group();
      // One solid, or several (an object's parts), each in a scene material or a project material.
      for (const part of Array.isArray(made) ? (made as readonly KindSolid[]) : [made as KindSolid]) {
        const material = state === 's' ? this.materials.sideSel : typeof part.material === 'string' ? this.materials[part.material] : layerMaterial(this, part.material);
        const mesh = new THREE.Mesh(part.geometry, material);
        mesh.position.y = part.y;
        if (part.edges) mesh.add(outline(this, part.geometry));
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
      this.contentVersion++;
      place(x.id, x.levelId);
    }
    const faces = facesOf(this, g);
    for (const s of g.solids.values()) {
      seen.add(s.wall.id);
      // A material's colour or finish changed keeps the walls' meshes: their materials take it here.
      for (const m of s.materials) layerMaterial(this, m);
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
      if (old) drop(this, old.group);
      const group = build(this, s, state, mine, phase);
      group.userData.wallId = s.wall.id;
      this.scene.add(group);
      this.walls.set(s.wall.id, { group, key });
      this.contentVersion++;
      place(s.wall.id, s.wall.levelId);
    }
    for (const [id, w] of this.walls) {
      if (!seen.has(id)) {
        drop(this, w.group);
        this.walls.delete(id);
      }
    }
    syncEdges(this, g, lift);
    this.lastSync = { g, lift };
    syncBoxCaps(this);
    placeGround(this, g);
    this.invalidate();
  }

  /**
   * The faces of every wall's blocks that show (faces.ts), by wall, once per derived geometry: the
   * faces between touching blocks, coplanar and facing, were drawn both and fought for the same pixels
   * (light specks on the walls). Blocks of every level and wall together, as joins span walls.
   */
  facesCache: { solids: DerivedGeometry['solids']; faces: Map<WallId, PrismFaces[]> } | null = null;

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

  /** The ray under a screen point, in plan coordinates (x, y in plan, z the height): from the eye, unit direction. */
  rayAt(clientX: number, clientY: number): { origin: { x: number; y: number; z: number }; dir: { x: number; y: number; z: number } } {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const o = ray.ray.origin;
    const d = ray.ray.direction;
    return { origin: { x: o.x, y: -o.z, z: o.y }, dir: { x: d.x, y: -d.z, z: d.y } };
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
    for (const w of this.walls.values()) drop(this, w.group);
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
