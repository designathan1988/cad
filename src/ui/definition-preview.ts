// The object editor's 3D preview (definition-editor.ts): the draft's pieces in their materials, lit,
// framed and turned by dragging.

import { previewMesh } from '../elements/object/textures';
import { SEE_THROUGH } from '../elements/material/schema';
import { creaseEdges, cutGeometries, pieceGeometry } from '../elements/kinds/object';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { App } from '../session/app';
import { evaluateObject } from '../elements/object/evaluate';
import type { ObjectDefinition } from '../elements/object/schema';
import type { ObjectInstance } from '../elements/object/schema';

/** The 3D preview of the draft: its pieces in their materials, lit, framed, turned by dragging. */
export class Preview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  private readonly group = new THREE.Group();
  private centre = new THREE.Vector3();
  private radius = 1;
  get canvasEl(): HTMLCanvasElement {
    return this.canvas;
  }
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: () => [number, number],
    private readonly turned: (yaw: number, pitch: number) => void,
    private readonly app: App,
    private readonly instance: () => ObjectInstance,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    // A room's light around it, as the realistic 3D has: what metals, mirrors and glazes reflect.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.4;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(3, 6, 4);
    this.scene.add(sun, this.group);
    let from: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      from = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!from) return;
      const [y, p] = this.view();
      this.turned(y - (e.clientX - from.x) * 0.01, Math.max(-0.1, Math.min(1.4, p + (e.clientY - from.y) * 0.01)));
      from = { x: e.clientX, y: e.clientY };
      this.render();
    });
    canvas.addEventListener('pointerup', () => (from = null));
  }
  update(def: ObjectDefinition, values: Record<string, number>): void {
    const doc = this.app.store.get();
    const ev = evaluateObject(def, { ...this.instance(), values }, { definitions: [...doc.definitions.filter((d) => d.id !== def.id), def], materials: doc.materials });
    for (const c of [...this.group.children]) {
      const m = c as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.group.remove(c);
    }
    const box = new THREE.Box3();
    // The solid parts with the voids taken out, and each void a faint ghost to place it by.
    const drawn = [...cutGeometries(ev.pieces), ...ev.pieces.filter((p) => p.cut).map((piece) => ({ piece, geometry: pieceGeometry(piece) }))];
    for (const { piece: p, geometry: g } of drawn) {
      // A void a faint red ghost; a part in its material, its pattern laid as the 3D view lays it.
      const mesh = p.cut ? new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xd04040, transparent: true, opacity: 0.18, depthWrite: false })) : previewMesh(g, p.material, SEE_THROUGH[p.material.id]);
      const edges = new THREE.LineSegments(g.userData.cut ? creaseEdges(g, 30) : new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0x2b2f36, transparent: true, opacity: 0.5 }));
      mesh.add(edges);
      this.group.add(mesh);
      box.expandByObject(mesh);
    }
    if (!box.isEmpty()) {
      box.getCenter(this.centre);
      this.radius = Math.max(0.2, box.getSize(new THREE.Vector3()).length() / 2);
    }
    this.render();
  }
  render(): void {
    const w = this.canvas.clientWidth || 320;
    const h = this.canvas.clientHeight || 240;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const [yaw, pitch] = this.view();
    const dist = this.radius / Math.sin((this.camera.fov * Math.PI) / 360) * 1.15;
    this.camera.position.set(this.centre.x + dist * Math.cos(pitch) * Math.sin(yaw), this.centre.y + dist * Math.sin(pitch), this.centre.z + dist * Math.cos(pitch) * Math.cos(yaw));
    this.camera.lookAt(this.centre);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    for (const c of this.group.children) {
      const m = c as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
    // Given back to the browser now, not when it is collected: the next editor gets a context.
    this.renderer.forceContextLoss();
  }
}
