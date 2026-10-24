// 3D view. Reads derived geometry, draws, syncs meshes by wall id, disposes what it drops, and
// renders only when something changed. World (x, y, height) maps to three.js (x, height, −y).
// Each convex piece is a prism; pieces are disjoint by construction, so no 3D boolean exists.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Point2 } from '../core/vector';
import type { DerivedGeometry, OpeningSolid, WallSolid } from '../app/geometry';
import { add, scale } from '../core/vector';
import type { WallId } from '../elements/wall/schema';

const toThree = (p: Point2, z: number) => new THREE.Vector3(p.x, z, -p.y);

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
  readonly controls: OrbitControls;
  private readonly scene = new THREE.Scene();
  private readonly walls = new Map<WallId, { group: THREE.Group; key: string }>();
  private readonly materials = {
    side: new THREE.MeshStandardMaterial({ color: 0xd6d0c6, roughness: 0.9, side: THREE.DoubleSide }),
    top: new THREE.MeshStandardMaterial({ color: 0xb4aea6, roughness: 0.9, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ color: 0xc9c5bd, roughness: 0.95, side: THREE.DoubleSide }),
    sideSel: new THREE.MeshStandardMaterial({ color: 0x9db6e8, roughness: 0.8, side: THREE.DoubleSide }),
    topSel: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.8, side: THREE.DoubleSide }),
    preview: new THREE.MeshStandardMaterial({ color: 0x7ea0e6, roughness: 0.8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9cc7e6, roughness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    leaf: new THREE.MeshStandardMaterial({ color: 0xa0764f, roughness: 0.7, side: THREE.DoubleSide }),
    invalid: new THREE.MeshStandardMaterial({ color: 0xea7a0c, roughness: 0.6, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  };
  private covered = { right: 0, bottom: 0 };
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
      this.onChange();
    });
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9fa8, 2.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-8, 14, 10);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(10, 6, -8);
    this.scene.add(fill);
    this.grid = new THREE.GridHelper(200, 200, 0xd3d6dc, 0xe3e5e9);
    this.grid.position.y = -0.001;
    this.scene.add(this.grid);
  }

  setTheme(dark: boolean): void {
    this.scene.background = new THREE.Color(dark ? 0x1b1c20 : 0xf3f4f6);
    // As in the reference captures: a faint ground grid in light, none in dark.
    this.grid.visible = !dark;
    const m = this.grid.material as THREE.Material | THREE.Material[];
    (Array.isArray(m) ? m : [m]).forEach((x) => {
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
    if (size.x !== w || size.y !== h || this.offsetDirty) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // A panel over the right or bottom edge: shift the view so its centre is the visible part's.
      const { right, bottom } = this.covered;
      if (right > 0 || bottom > 0) this.camera.setViewOffset(w, h, right / 2, bottom / 2, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.offsetDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Brings the meshes in line with the geometry: only walls whose shape or state changed are rebuilt. */
  sync(g: DerivedGeometry, selected: ReadonlySet<WallId>, preview: ReadonlySet<WallId>): void {
    const seen = new Set<WallId>();
    for (const o of g.openings.values()) {
      if (!o.frame) continue;
      const id = o.opening.id;
      seen.add(id);
      const state = preview.has(id) ? 'p' : selected.has(id) ? 's' : o.valid ? 'n' : 'i';
      const key = state + JSON.stringify([o.frame, o.opening, o.bottom, o.top]);
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
      const key = state + JSON.stringify([f.outline, f.bottom, f.top]);
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
    for (const s of g.solids.values()) {
      seen.add(s.wall.id);
      const state = preview.has(s.wall.id) ? 'p' : selected.has(s.wall.id) ? 's' : 'n';
      const key = state + JSON.stringify(s.blocks);
      const old = this.walls.get(s.wall.id);
      if (old?.key === key) continue;
      if (old) this.drop(old.group);
      const group = this.build(s, state);
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

  private build(s: WallSolid, state: 'p' | 's' | 'n'): THREE.Group {
    const group = new THREE.Group();
    const side = state === 'p' ? this.materials.preview : state === 's' ? this.materials.sideSel : this.materials.side;
    const top = state === 'p' ? this.materials.preview : state === 's' ? this.materials.topSel : this.materials.top;
    for (const b of s.blocks) group.add(new THREE.Mesh(prism(b.polygon, b.bottom, b.top), [side, top]));
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
  setCovered(covered: { right: number; bottom: number }): void {
    if (covered.right === this.covered.right && covered.bottom === this.covered.bottom) return;
    this.covered = covered;
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
    const visW = Math.max(w - this.covered.right, w * 0.3);
    const visH = Math.max(h - this.covered.bottom, h * 0.3);
    const fit = (radius / Math.sin((this.camera.fov * Math.PI) / 360) / Math.min(1, visW / visH)) * (h / visH);
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(dir.clone().normalize().multiplyScalar(fit * 1.05));
    this.camera.up.set(0, 1, 0);
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
