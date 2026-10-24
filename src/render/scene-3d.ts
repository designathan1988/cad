// 3D view. Reads derived geometry, draws, syncs meshes by wall id, disposes what it drops, and
// renders only when something changed. World (x, y, height) maps to three.js (x, height, −y).
// Each convex piece is a prism; pieces are disjoint by construction, so no 3D boolean exists.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Point2 } from '../core/vector';
import type { DerivedGeometry, WallSolid } from '../app/geometry';
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
    sideSel: new THREE.MeshStandardMaterial({ color: 0x9db6e8, roughness: 0.8, side: THREE.DoubleSide }),
    topSel: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.8, side: THREE.DoubleSide }),
    preview: new THREE.MeshStandardMaterial({ color: 0x7ea0e6, roughness: 0.8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  };
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
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Brings the meshes in line with the geometry: only walls whose shape or state changed are rebuilt. */
  sync(g: DerivedGeometry, selected: ReadonlySet<WallId>, preview: ReadonlySet<WallId>): void {
    const seen = new Set<WallId>();
    for (const s of g.solids.values()) {
      seen.add(s.wall.id);
      const state = preview.has(s.wall.id) ? 'p' : selected.has(s.wall.id) ? 's' : 'n';
      const key = state + JSON.stringify([s.pieces.map((p) => p.polygon), s.bottom, s.top]);
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
    for (const piece of s.pieces) group.add(new THREE.Mesh(prism(piece.polygon, s.bottom, s.top), [side, top]));
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
  frame(box: { min: Point2; max: Point2 } | null, height: number, dir = new THREE.Vector3(0.55, 0.62, 0.75)): void {
    const b = box ?? { min: { x: -1, y: -1 }, max: { x: 9, y: 7 } };
    const center = toThree({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 }, height / 2);
    const radius = Math.max(1, Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y, height) / 2);
    const fit = radius / Math.sin((this.camera.fov * Math.PI) / 360) / Math.min(1, this.camera.aspect || 1);
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
