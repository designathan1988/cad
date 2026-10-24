// View cube: a CSS 3D cube that turns with the camera; clicking a face looks from that side.

import * as THREE from 'three';
import { icon } from '../ui/icons';
import { t } from '../ui/i18n';

/** Faces in three.js directions: where the camera sits to look from that side. */
const FACES = [
  { key: 'cube.front', dir: new THREE.Vector3(0, 0, 1), css: 'translateZ(30px)' },
  { key: 'cube.right', dir: new THREE.Vector3(1, 0, 0), css: 'rotateY(90deg) translateZ(30px)' },
  { key: 'cube.top', dir: new THREE.Vector3(0, 1, 0), css: 'rotateX(90deg) translateZ(30px)' },
  { key: null, dir: new THREE.Vector3(0, 0, -1), css: 'rotateY(180deg) translateZ(30px)' },
  { key: null, dir: new THREE.Vector3(-1, 0, 0), css: 'rotateY(-90deg) translateZ(30px)' },
  { key: null, dir: new THREE.Vector3(0, -1, 0), css: 'rotateX(-90deg) translateZ(30px)' },
] as const;

export class ViewCube {
  readonly root = document.createElement('div');
  private readonly inner = document.createElement('div');
  private readonly faces: HTMLElement[] = [];
  private readonly home: HTMLButtonElement;

  constructor(onFace: (dir: THREE.Vector3) => void, onHome: () => void) {
    this.root.className = 'cube-wrap';
    const cube = document.createElement('div');
    cube.className = 'cube';
    this.inner.className = 'cube-inner';
    for (const f of FACES) {
      const face = document.createElement('div');
      face.className = 'cube-face';
      face.style.transform = f.css;
      face.addEventListener('click', () => onFace(f.dir.y > 0 ? new THREE.Vector3(0, 1, 0.0001) : f.dir.clone()));
      this.faces.push(face);
      this.inner.append(face);
    }
    cube.append(this.inner);
    this.home = document.createElement('button');
    this.home.className = 'icon-btn';
    this.home.innerHTML = icon('home', 16);
    this.home.addEventListener('click', onHome);
    this.root.append(cube, this.home);
    this.relabel();
  }

  relabel(): void {
    FACES.forEach((f, i) => {
      this.faces[i]!.textContent = f.key ? t(f.key) : '';
      this.faces[i]!.title = f.key ? t(f.key) : '';
    });
    this.home.title = t('cube.home');
    this.home.setAttribute('aria-label', t('cube.home'));
  }

  /** Turns the cube like the scene: the camera's view rotation, with CSS's y axis pointing down. */
  update(camera: THREE.Camera): void {
    // From the quaternion, not matrixWorldInverse: that one is only refreshed when the scene renders.
    const e = new THREE.Matrix4().makeRotationFromQuaternion(camera.quaternion.clone().invert()).elements;
    const s = [1, -1, 1, 1];
    const m = e.map((v, i) => v * s[i % 4]! * s[Math.floor(i / 4)]!);
    this.inner.style.transform = `matrix3d(${m.map((v) => v.toFixed(6)).join(',')})`;
  }
}
