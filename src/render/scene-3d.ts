// 3D view. Reads derived geometry, draws, syncs meshes by wall id, disposes what it drops, and
// renders only when something changed. World (x, y, height) maps to three.js (x, height, −y).
// Each convex piece is a prism; pieces are disjoint by construction, so no 3D boolean exists.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Point2 } from '../core/vector';
import type { DerivedGeometry, OpeningSolid, WallSolid } from '../app/geometry';
import { add, scale } from '../core/vector';
import type { WallId } from '../elements/wall/schema';
import { LAYER_TOKEN } from '../ui/swatch';
import { blockPaint, wallMeshKey } from './wall-paint';
import { type PrismFaces, visibleFaces } from '../elements/wall/geometry/faces';
import { featureEdges } from '../elements/wall/geometry/edges';
import { boxCaps, type SectionBox, type UprightPrism } from '../app/section-box';

const toThree = (p: Point2, z: number) => new THREE.Vector3(p.x, z, -p.y);

/** The ground's size: this many times the model's extent, at least GROUND_MIN (m) across. */
const GROUND_SPAN = 4;
const GROUND_MIN = 60;
/** How much of a wall shows in x-ray. */
const XRAY_OPACITY = 0.28;

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
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
  readonly controls: OrbitControls;
  private readonly scene = new THREE.Scene();
  private readonly walls = new Map<WallId, { group: THREE.Group; key: string }>();
  // Colours come from the design tokens (styles.css, --3d-*), set in setTheme.
  /** Each solid's shape key (wallMeshKey without the state), kept while the solid lives. */
  private readonly shapeKeys = new WeakMap<object, string>();
  /** One material per layer colour token, recoloured with the theme like the others. */
  private readonly layerMaterials = new Map<string, THREE.MeshStandardMaterial>(
    [...new Set(Object.values(LAYER_TOKEN))].map((name) => [name, new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide })]),
  );
  private readonly materials = {
    side: new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }),
    top: new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide }),
    sideSel: new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }),
    topSel: new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }),
    preview: new THREE.MeshStandardMaterial({ roughness: 0.8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ roughness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }),
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
  private covered = { right: 0, bottom: 0, left: 0 };
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
    this.camera.position.set(-6, 9, 12);
    this.controls = new OrbitControls(this.camera, canvas);
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
    this.fill.position.set(10, 6, -8);
    this.scene.add(this.fill);
    this.grid = new THREE.GridHelper(200, 200);
    this.grid.position.y = -0.001;
    this.scene.add(this.grid);
    // Under the grid and drawn before it, writing no depth: the grid's lines stay on it.
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.renderOrder = -1;
    this.ground.scale.set(GROUND_MIN, GROUND_MIN, 1);
    this.ground.position.y = -0.002;
    this.scene.add(this.ground);
    this.renderer.localClippingEnabled = true;
    for (const m of [...Object.values(this.materials), ...this.layerMaterials.values()]) {
      m.clippingPlanes = this.clip;
      // The faces a little behind their depth, so the lines on their edges are not half hidden by them.
      m.polygonOffset = true;
      m.polygonOffsetFactor = 1;
      m.polygonOffsetUnits = 1;
    }
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

  /**
   * X-ray (view-3d.ts): the walls and floors faint, writing no depth, so what is behind them shows; the
   * lines stay solid, so the shapes still read. Glass and leaves keep their own look.
   */
  setXray(on: boolean): void {
    const faint = [this.materials.side, this.materials.top, this.materials.floor, this.materials.sideSel, this.materials.topSel, ...this.layerMaterials.values()];
    if (faint[0]!.transparent === on && (on ? faint[0]!.opacity === XRAY_OPACITY : true)) return;
    for (const m of faint) {
      m.transparent = on;
      m.opacity = on ? XRAY_OPACITY : 1;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
    this.edgeMaterial.opacity = on ? 0.9 : 0.55;
    this.invalidate();
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

  /** The box's fills, again when the box, the walls or the lifts changed. */
  private syncBoxCaps(): void {
    const box = this.boxBox;
    const src = this.lastSync;
    const levels = src ? [...new Set([...src.g.solids.values()].map((s) => s.wall.levelId))] : [];
    // The walls and floors by identity (a new derived geometry is a change), the box and lifts by value.
    const key: unknown[] = [src?.g.solids, src?.g.floors, JSON.stringify([box, levels.map((l) => src!.lift(l))])];
    if (key.every((k, i) => k === this.boxCapsKey[i])) return;
    this.boxCapsKey = key;
    for (const c of [...this.boxCapGroup.children]) {
      this.boxCapGroup.remove(c);
      if (c instanceof THREE.Mesh) c.geometry.dispose();
    }
    if (!box || !src) return;
    const prisms: UprightPrism[] = [];
    for (const s of src.g.solids.values()) {
      const up = src.lift(s.wall.levelId);
      for (const b of s.blocks) prisms.push({ polygon: b.polygon, bottom: b.bottom + up, top: b.top + up });
    }
    for (const f of src.g.floors.values()) {
      const up = src.lift(f.floor.levelId);
      if (f.outline.length >= 3) prisms.push({ polygon: f.outline, bottom: f.bottom + up, top: f.top + up });
    }
    // A hair inside the box, so the face it lies on does not clip it away.
    const e = 0.0005;
    const inside = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo + e), hi - e);
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
    this.capClip.length = 0;
    this.capClip.push(...this.boxPlanes);
  }

  /** Colours of the theme, read from the design tokens: `token('--3d-side')` and so on. */
  setTheme(dark: boolean, token: (name: string) => string): void {
    const c = (name: string) => new THREE.Color(token(name));
    this.scene.background = c('--canvas');
    const m = this.materials;
    m.side.color = c('--3d-side');
    m.top.color = c('--3d-top');
    m.floor.color = c('--3d-floor');
    m.sideSel.color = c('--3d-side-sel');
    m.topSel.color = c('--accent');
    m.preview.color = c('--3d-preview');
    m.glass.color = c('--3d-glass');
    m.leaf.color = c('--3d-leaf');
    m.invalid.color = c('--warn');
    this.capMaterial.color = c('--3d-cut');
    this.boxCapMaterial.color = c('--3d-cut');
    this.edgeMaterial.color = c('--3d-edge');
    (this.ground.material as THREE.MeshBasicMaterial).color = c('--3d-ground');
    // Each layer token has its 3D twin (--layer-structure, --3d-layer-structure): the plan's darken in
    // the dark theme, and the walls in 3D turned a muddy brown under a bright floor.
    for (const [name, mat] of this.layerMaterials) mat.color = c(name.replace(/^--layer-/, '--3d-layer-'));
    this.sky.color = c('--3d-light');
    this.sky.groundColor = c('--3d-ground-light');
    this.sun.color = c('--3d-light');
    this.fill.color = c('--3d-light');
    // As in the reference captures: a faint ground grid in light, none in dark.
    this.grid.visible = !dark;
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
      x.opacity = 0.35;
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
      this.camera.aspect = w / h;
      // A panel over the right or bottom edge: shift the view so its centre is the visible part's.
      const { right, bottom, left } = this.covered;
      if (right > 0 || bottom > 0 || left > 0) this.camera.setViewOffset(w, h, (right - left) / 2, bottom / 2, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.offsetDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
    // The projection changed (first frame, new size, panel): what is placed over the view by
    // projecting through the camera (the floating bar, the cube) must be placed again.
    if (resized) this.onChange();
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
      const key = state + shape;
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
    for (const f of g.floors.values()) {
      if (f.outline.length < 3) continue;
      const id = f.floor.id;
      seen.add(id);
      const state = selected.has(id) ? 's' : 'n';
      let fkey = this.shapeKeys.get(f);
      if (fkey === undefined) this.shapeKeys.set(f, (fkey = JSON.stringify([f.outline, f.bottom, f.top])));
      const key = state + fkey;
      const old = this.walls.get(id);
      if (old?.key === key) {
        place(id, f.floor.levelId);
        continue;
      }
      if (old) this.drop(old.group);
      const group = new THREE.Group();
      const shape = new THREE.Shape(f.outline.map((p) => new THREE.Vector2(p.x, p.y)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: f.top - f.bottom, bevelEnabled: false });
      // The shape lies in x–y; turned −90° about x it lies in three.js x–(−z), extruded upward.
      const mesh = new THREE.Mesh(geo, state === 's' ? this.materials.sideSel : this.materials.floor);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = f.bottom;
      mesh.add(this.outline(geo));
      group.add(mesh);
      group.userData.wallId = id;
      this.scene.add(group);
      this.walls.set(id, { group, key });
      place(id, f.floor.levelId);
    }
    const faces = this.facesOf(g);
    for (const s of g.solids.values()) {
      seen.add(s.wall.id);
      const state = preview.has(s.wall.id) ? 'p' : selected.has(s.wall.id) ? 's' : 'n';
      // The shape's part of the key, once per solid: solids are only replaced when the geometry is
      // computed again, and a switch of view (148 walls) stringified every block each time.
      let shape = this.shapeKeys.get(s);
      // What shows of a wall depends on its neighbours too (faces.ts): their faces are in the key.
      const mine = faces.get(s.wall.id) ?? [];
      if (shape === undefined) this.shapeKeys.set(s, (shape = wallMeshKey('', s.blocks, s.layers) + JSON.stringify(mine)));
      const key = state + shape;
      const old = this.walls.get(s.wall.id);
      if (old?.key === key) {
        place(s.wall.id, s.wall.levelId);
        continue;
      }
      if (old) this.drop(old.group);
      const group = this.build(s, state, mine);
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
      const byLevel = new Map<string, { prisms: WallSolid['blocks'][number][]; faces: PrismFaces[] }>();
      for (const s of g.solids.values()) {
        const mine = faces.get(s.wall.id) ?? [];
        const level = byLevel.get(s.wall.levelId) ?? { prisms: [], faces: [] };
        s.blocks.forEach((b, i) => {
          if (!mine[i]) return;
          level.prisms.push(b);
          level.faces.push(mine[i]!);
        });
        byLevel.set(s.wall.levelId, level);
      }
      for (const [levelId, { prisms, faces: shown }] of byLevel) {
        const pos: number[] = [];
        for (const e of featureEdges(prisms, shown)) pos.push(e.a.x, e.a.z, -e.a.y, e.b.x, e.b.z, -e.b.y);
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

  /** The ground centred under the walls and floors shown, GROUND_SPAN times as wide, just under the lowest of them. */
  private placeGround(g: DerivedGeometry): void {
    const solids = [...g.solids.values()];
    const floors = [...g.floors.values()];
    const points = [...solids.flatMap((s) => [s.wall.start, s.wall.end]), ...floors.flatMap((f) => f.outline)];
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const [x0, x1, y0, y1] = points.length > 0 ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 0, 0, 0];
    const size = Math.max(GROUND_MIN, GROUND_SPAN * Math.max(x1 - x0, y1 - y0));
    const lowest = Math.min(0, ...solids.map((s) => s.bottom), ...floors.map((f) => f.bottom));
    this.ground.scale.set(size, size, 1);
    this.ground.position.set((x0 + x1) / 2, lowest - 0.002, -(y0 + y1) / 2);
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

  private build(s: WallSolid, state: 'p' | 's' | 'n', faces: readonly PrismFaces[]): THREE.Group {
    const group = new THREE.Group();
    // Each block in its layer's colour, as in plan (wall-paint.ts).
    const material = (paint: string): THREE.Material => this.layerMaterials.get(paint) ?? this.materials[paint as keyof typeof this.materials];
    s.blocks.forEach((b, i) => {
      const { side, top } = blockPaint(s.layers, b.layerIndex, state);
      const f = faces[i];
      group.add(new THREE.Mesh(f ? shownPrism(b.polygon, b.bottom, b.top, f) : prism(b.polygon, b.bottom, b.top), [material(side), material(top)]));
    });
    return group;
  }

  /** A window's glass in the middle of the wall, or a door's closed leaf. */
  private buildOpening(o: OpeningSolid, state: 'p' | 's' | 'n' | 'i'): THREE.Group {
    const group = new THREE.Group();
    const f = o.frame!;
    const door = o.opening.kind === 'door';
    const mid = (f.faces[0] + f.faces[1]) / 2;
    const half = door ? 0.02 : 0.01;
    const at = (p: Point2, off: number) => add(p, scale(f.normal, off));
    const poly = [at(f.start, mid - half), at(f.end, mid - half), at(f.end, mid + half), at(f.start, mid + half)];
    const m =
      state === 'p' ? this.materials.preview : state === 's' ? this.materials.topSel : state === 'i' ? this.materials.invalid : door ? this.materials.leaf : this.materials.glass;
    const geo = prism(poly, o.bottom, o.top);
    group.add(new THREE.Mesh(geo, [m, m]), this.outline(geo));
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
    const d = this.camera.position.distanceTo(toThree(p, z));
    const h = this.canvas.clientHeight || 1;
    return (2 * d * Math.tan((this.camera.fov * Math.PI) / 360)) / h;
  }

  /** How much a panel covers at the right and bottom edges of the canvas (screen pixels). */
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
    const fit = (radius / Math.sin((this.camera.fov * Math.PI) / 360) / Math.min(1, visW / visH)) * (h / visH);
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(dir.clone().normalize().multiplyScalar(fit * 1.05));
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
    const offset = this.camera.position.clone().sub(this.controls.target);
    const d = Math.min(Math.max(offset.length() / zoom, this.controls.minDistance), this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(d));
    this.controls.update();
    this.invalidate();
  }

  dispose(): void {
    for (const w of this.walls.values()) this.drop(w.group);
    Object.values(this.materials).forEach((m) => m.dispose());
    for (const l of this.edges.values()) l.geometry.dispose();
    this.edgeMaterial.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

/** A prism of only the faces that show (faces.ts), wound as prism(): sides in group 0, caps in group 1. */
function shownPrism(poly: readonly Point2[], bottom: number, top: number, f: PrismFaces): THREE.BufferGeometry {
  const pos: number[] = [];
  const push = (v: THREE.Vector3) => pos.push(v.x, v.y, v.z);
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const at = (t: number) => ({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len });
    for (const r of f.sides[i] ?? []) {
      const a0 = toThree(at(r.t0), r.z0);
      const b0 = toThree(at(r.t1), r.z0);
      const a1 = toThree(at(r.t0), r.z1);
      const b1 = toThree(at(r.t1), r.z1);
      [a0, b0, b1, a0, b1, a1].forEach(push);
    }
  }
  const sides = pos.length / 3;
  for (const c of f.top) for (let i = 1; i < c.length - 1; i++) [toThree(c[0]!, top), toThree(c[i]!, top), toThree(c[i + 1]!, top)].forEach(push);
  for (const c of f.bottom) for (let i = 1; i < c.length - 1; i++) [toThree(c[0]!, bottom), toThree(c[i + 1]!, bottom), toThree(c[i]!, bottom)].forEach(push);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.addGroup(0, sides, 0);
  g.addGroup(sides, pos.length / 3 - sides, 1);
  g.computeVertexNormals();
  return g;
}

/** A vertical prism over a convex CCW polygon: sides in group 0, top and bottom in group 1. */
function prism(poly: readonly Point2[], bottom: number, top: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const push = (v: THREE.Vector3) => pos.push(v.x, v.y, v.z);
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const a0 = toThree(a, bottom);
    const b0 = toThree(b, bottom);
    const a1 = toThree(a, top);
    const b1 = toThree(b, top);
    [a0, b0, b1, a0, b1, a1].forEach(push);
  }
  const sides = pos.length / 3;
  for (let i = 1; i < n - 1; i++) {
    [toThree(poly[0]!, top), toThree(poly[i]!, top), toThree(poly[i + 1]!, top)].forEach(push);
    [toThree(poly[0]!, bottom), toThree(poly[i + 1]!, bottom), toThree(poly[i]!, bottom)].forEach(push);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.addGroup(0, sides, 0);
  g.addGroup(sides, pos.length / 3 - sides, 1);
  g.computeVertexNormals();
  return g;
}
