// 3D view. Reads derived geometry, draws, syncs meshes by wall id, disposes what it drops, and
// renders only when something changed. World (x, y, height) maps to three.js (x, height, −y).
// Each convex piece is a prism; pieces are disjoint by construction, so no 3D boolean exists.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer';
import type { RenderQuality, VisualStyle } from '../session/view/view-3d';
import type { Point2 } from '../model/vector';
import type { DerivedGeometry } from '../project/derive';
import type { WallId } from '../elements/wall/schema';
import type { PrismFaces } from '../elements/wall/geometry/faces';
import type { SectionBox, SectionLine } from '../model/section-box';
import { type PatternUniforms, prepare } from './scene-materials';
import { drop } from './scene-build';
import { GROUND_MIN, groundFade } from './scene-light';
import { render } from './scene-render';
import type { ElementId } from '../core/id';

/** Vertical field of view (degrees). */
const VIEW_FOV = 40;

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly persp = new THREE.PerspectiveCamera(VIEW_FOV, 1, 0.05, 2000);
  /**
   * Orthographic, as elevations and sections are drawn (Revit's parallel views): no perspective, sizes
   * true at any depth. `orthoHalf`: half the view's height in metres at zoom 1.
   */
  readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 4000);
  orthoOn = false;
  orthoHalf = 5;
  /** The camera in use: the perspective one, or the orthographic one (setOrtho). */
  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.orthoOn ? this.ortho : this.persp;
  }
  readonly controls: OrbitControls;
  readonly scene = new THREE.Scene();
  /** The meshes drawn, walls and doors and windows alike, by their element's id. */
  readonly walls = new Map<ElementId, { group: THREE.Group; key: string }>();
  // Colours come from the design tokens (styles.css, --3d-*), set in setTheme.
  /** Each solid's shape key (wallMeshKey without the state), kept while the solid lives. */
  readonly shapeKeys = new WeakMap<object, string>();
  /** One three.js material per project material (elements/material), its colour and finish kept up to date. */
  readonly layerMaterials = new Map<string, THREE.MeshStandardMaterial>();
  /** A renovation's walls by phase (app/layer-sets.ts: wallPhases), with the overrides on; each phase's material in its token's colour. */
  phases: ReadonlyMap<string, 'new' | 'existing' | 'demolish'> = new Map();
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
  boxKey = '';
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
  readonly caps = new THREE.Group();
  readonly capMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  /**
   * Thin lines where the surfaces turn (edges.ts), one set per level so each lifts with its level: walls
   * of one colour read apart, and so does the step of a wall off the face of the wall below it.
   */
  readonly edgeMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
  readonly edges = new Map<string, THREE.LineSegments>();
  edgesOf: DerivedGeometry['solids'] | null = null;
  capsKey = '';
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
  environment: THREE.Texture | null = null;
  /** Hidden lines: every surface white, unlit, behind its edges. */
  readonly hiddenFace = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  /** Shadows on the ground, where nothing else stands to take them. */
  readonly shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.28 }));
  covered = { right: 0, bottom: 0, left: 0 };
  /**
   * How far the view's centre is shifted (px), set when the view is framed from what the panels
   * covered then. A panel shown or hidden later leaves it: shifting it then moved the whole model on
   * screen, with no camera move, each time a selection brought the panel in.
   */
  shift = { x: 0, y: 0 };
  offsetDirty = false;
  readonly grid: THREE.GridHelper;
  /**
   * The ground under the model, at its lowest base: a room with no floor shows it. Before, it showed
   * the background, a black hole among the walls in the dark theme.
   */
  readonly ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaMap: groundFade() }),
  );
  needsRender = true;
  raf = 0;
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
  readonly photoGround = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.tracedGround);
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

  /** Doors and windows drawn open: those opened one by one (a double click, the selection's Open). */
  private opened: ReadonlySet<string> = new Set();
  setOpened(opened: ReadonlySet<string>): void {
    this.opened = opened;
  }
  isOpen(id: string): boolean {
    return this.opened.has(id);
  }

  invalidate(): void {
    this.needsRender = true;
    if (this.raf === 0) this.raf = requestAnimationFrame(() => render(this));
  }

  /**
   * The faces of every wall's blocks that show (faces.ts), by wall, once per derived geometry: the
   * faces between touching blocks, coplanar and facing, were drawn both and fought for the same pixels
   * (light specks on the walls). Blocks of every level and wall together, as joins span walls.
   */
  facesCache: { solids: DerivedGeometry['solids']; faces: Map<WallId, PrismFaces[]> } | null = null;

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
