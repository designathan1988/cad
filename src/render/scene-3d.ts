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

const toThree = (p: Point2, z: number) => new THREE.Vector3(p.x, z, -p.y);

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
  private readonly sky = new THREE.HemisphereLight(undefined, undefined, 2.7);
  private readonly sun = new THREE.DirectionalLight(undefined, 1.5);
  private readonly fill = new THREE.DirectionalLight(undefined, 0.6);
  private covered = { right: 0, bottom: 0, left: 0 };
  private offsetDirty = false;
  private readonly grid: THREE.GridHelper;
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

  /** Brings the meshes in line with the geometry: only walls whose shape or state changed are rebuilt. */
  sync(g: DerivedGeometry, selected: ReadonlySet<WallId>, preview: ReadonlySet<WallId>): void {
    const seen = new Set<WallId>();
    for (const o of g.openings.values()) {
      if (!o.frame) continue;
      const id = o.opening.id;
      seen.add(id);
      const state = preview.has(id) ? 'p' : selected.has(id) ? 's' : o.valid ? 'n' : 'i';
      let shape = this.shapeKeys.get(o);
      if (shape === undefined) this.shapeKeys.set(o, (shape = JSON.stringify([o.frame, o.opening, o.bottom, o.top])));
      const key = state + shape;
      const old = this.walls.get(id);
      if (old?.key === key) continue;
      if (old) this.drop(old.group);
      const group = this.buildOpening(o, state);
      group.userData.wallId = id;
      this.scene.add(group);
      this.walls.set(id, { group, key });
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
      if (old?.key === key) continue;
      if (old) this.drop(old.group);
      const group = new THREE.Group();
      const shape = new THREE.Shape(f.outline.map((p) => new THREE.Vector2(p.x, p.y)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: f.top - f.bottom, bevelEnabled: false });
      // The shape lies in x–y; turned −90° about x it lies in three.js x–(−z), extruded upward.
      const mesh = new THREE.Mesh(geo, state === 's' ? this.materials.sideSel : this.materials.floor);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = f.bottom;
      group.add(mesh);
      group.userData.wallId = id;
      this.scene.add(group);
      this.walls.set(id, { group, key });
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
      if (old?.key === key) continue;
      if (old) this.drop(old.group);
      const group = this.build(s, state, mine);
      group.userData.wallId = s.wall.id;
      this.scene.add(group);
      this.walls.set(s.wall.id, { group, key });
    }
    for (const [id, w] of this.walls) {
      if (!seen.has(id)) {
        this.drop(w.group);
        this.walls.delete(id);
      }
    }
    this.invalidate();
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
    group.add(new THREE.Mesh(prism(poly, o.bottom, o.top), [m, m]));
    return group;
  }

  private drop(group: THREE.Group): void {
    this.scene.remove(group);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
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

  /** Looks at a box from a direction (three.js space), far enough to see all of it. */
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
