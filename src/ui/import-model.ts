// A glTF (.glb, a .gltf with its buffers inside) or OBJ model brought in as a library object (phase 11;
// io/import-mesh.ts): read by three.js's loaders, its meshes in plan axes, one group a material, made a
// definition with its width, depth, height and materials as parameters; then placed with the object tool.

import type { App } from '../session/app';
import type * as THREE from 'three';
import { newId } from '../core/id';
import { el } from '../ui/controls';
import { t } from '../i18n/messages';
import { MAX_TRIANGLES, type MeshGroup, meshDefinition } from '../io/import-mesh';
import { setView } from '../session/view-ui';

/** The model's meshes as groups, in plan axes (three.js's y up is the plan's z; its z is the plan's −y). */
function groupsOf(root: THREE.Object3D): MeshGroup[] {
  const out: MeshGroup[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!(mesh as { isMesh?: boolean }).isMesh || !mesh.geometry) return;
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const pos = geo.getAttribute('position');
    if (!pos) return;
    const positions = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      positions[i * 3] = pos.getX(i);
      positions[i * 3 + 1] = -pos.getZ(i);
      positions[i * 3 + 2] = pos.getY(i);
    }
    const index = geo.getIndex();
    const all = index ? Array.from(index.array) : Array.from({ length: pos.count }, (_, i) => i);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const colour = (m: THREE.Material | undefined) => `#${((m as THREE.MeshStandardMaterial | undefined)?.color?.getHexString?.() ?? 'b5b1aa')}`;
    // A mesh of several materials: a group each, by its geometry's groups.
    if (mats.length > 1 && geo.groups.length > 0) {
      for (const gr of geo.groups) out.push({ positions, indices: all.slice(gr.start, gr.start + gr.count), color: colour(mats[gr.materialIndex ?? 0]) });
    } else out.push({ positions, indices: all, color: colour(mats[0]) });
    geo.dispose();
  });
  return out;
}

async function load(file: File): Promise<THREE.Object3D> {
  if (/\.obj$/i.test(file.name)) {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    return new OBJLoader().parse(await file.text());
  }
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const data = /\.gltf$/i.test(file.name) ? await file.text() : await file.arrayBuffer();
  return new Promise((resolve, reject) => new GLTFLoader().parse(data, '', (g) => resolve(g.scene), (e) => reject(e instanceof Error ? e : new Error(String(e)))));
}

/** A model file made an object of the project's library, then placed. */
export async function importModel(app: App, file: File): Promise<void> {
  try {
    const root = await load(file);
    const name = file.name.replace(/\.(glb|gltf|obj)$/i, '');
    const made = meshDefinition(name, groupsOf(root), 'generic', newId);
    if (!made) {
      app.toast(t('model.tooBig', { n: MAX_TRIANGLES }));
      return;
    }
    // One step: its materials and its definition.
    app.store.dispatch({
      label: 'cmd.importModel',
      apply: (doc) => ({ ...doc, materials: [...doc.materials, ...made.materials], definitions: [...doc.definitions, made.definition] }),
    });
    const unit = made.unit === 1 ? 'm' : made.unit === 0.01 ? 'cm' : 'mm';
    app.toast(t('model.imported', { name, n: Math.round(made.triangles), unit }));
    if (app.ui.view !== 'plan') setView(app, 'plan');
    app.placeObject(made.definition.id);
  } catch (e) {
    app.toast(t('model.failed', { why: e instanceof Error ? e.message : String(e) }));
  }
}

/** Asks for a model to bring in. */
export function pickModel(app: App): void {
  const input = el('input', { type: 'file', accept: '.glb,.gltf,.obj,model/gltf-binary' });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) void importModel(app, f);
  });
  input.click();
}
