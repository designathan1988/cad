// The project as a file: saving, opening, a new one, and the exports (GLB, DXF). Functions over the app (app.ts delegates).

import { newId } from '../core/id';
import { importIfc } from '../io/import-ifc';
import { exportIfc as ifcOf } from '../io/export-ifc';
import { deriveGeometry } from './geometry';
import type { KindKey } from '../elements/contract';
import { words } from '../elements/object/fields';
import { areaText } from '../ui/units';
import { markPrefix, materialLabel, type MessageKey, name, t } from '../ui/i18n';
import { materialIn } from '../elements/material/schema';
import { planDxf, toCp1252 } from '../io/export-dxf';
import { anyKinds, kindOfKey } from '../elements/registry';
import { newDocument, startLevel } from './document';
import { openingMarks } from '../elements/opening/marks';
import { savePrefs } from './persist';
import { readProject, writeProject } from '../io/project-file';
import type { App } from './app';
import { importAsProject, newStoredProject } from './projects';
import { safeFileName } from './app';

/** The project's name, as one undo step; an empty name is "Untitled project" again. */
export function renameProject(app: App, next: string): void {
  const name = next.trim();
  if (name === app.store.get().name) return;
  app.store.dispatch({ label: 'cmd.renameProject', apply: (d) => ({ ...d, name }) });
}

export function saveFile(app: App): void {
  const doc = app.store.get();
  // Named after the project, without what a file name cannot hold: every save was "project.json".
  app.download(`${app.fileBase()}.json`, writeProject(doc), 'application/json');
  app.toast(t('toast.saved'));
}

/** A file given to the browser to save: the project, a schedule's CSV, an export. */
export function download(_app: App, file: string, content: string | Blob, type: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** The project's file name: its name without what a file name cannot hold. */
export function fileBase(app: App): string {
  return safeFileName(app.store.get().name || t('app.untitled'));
}

/**
 * The model as GLB (render/export-gltf.ts), for a viewer or a renderer: loaded when first asked for,
 * so the exporter does not weigh on every start. A failure is said, not swallowed.
 */
export async function exportGlb(app: App): Promise<void> {
  const doc = app.store.get();
  if (doc.walls.length === 0 && !anyKinds(doc)) {
    app.ui.info = t('export.nothing');
    return app.renderChrome();
  }
  try {
    const { modelScene, toGlb } = await import('../render/export-gltf');
    const scene = modelScene(doc, app.geometry, {
      name,
      wallTag: (n) => t('wall.tag', { n }),
      door: (n) => t('export.door', { n }),
      window: (n) => t('export.window', { n }),
      kindName: (key, n) => t(kindOfKey(key).exportName, { n }),
      kindMaterial: (key) => t(kindOfKey(key).one),
      material: (id) => materialLabel(materialIn(doc.materials, id)),
      glass: t('export.glass'),
      leaf: t('export.leaf'),
      frame: t('export.frame'),
    });
    const bytes = await toGlb(scene);
    scene.traverse((o) => (o as { geometry?: { dispose(): void } }).geometry?.dispose());
    const file = `${app.fileBase()}.glb`;
    app.download(file, new Blob([bytes], { type: 'model/gltf-binary' }), 'model/gltf-binary');
    app.toast(t('export.glbSaved', { file }));
  } catch (e) {
    console.error(e);
    app.toast(t('export.failed', { what: 'GLB', error: e instanceof Error ? e.message : String(e) }));
  }
}

/**
 * The whole model as IFC4 (io/export-ifc.ts), for a BIM program or viewer: its classes, types, layers,
 * spaces and storeys. Made from the model as it is (not the view's hidden categories).
 */
export function exportIfc(app: App): void {
  const doc = app.store.get();
  if (doc.walls.length === 0 && !anyKinds(doc)) {
    app.ui.info = t('export.nothing');
    return app.renderChrome();
  }
  try {
    const text = ifcText(app);
    const file = `${app.fileBase()}.ifc`;
    app.download(file, new Blob([text], { type: 'application/x-step' }), 'application/x-step');
    app.toast(t('export.ifcSaved', { file }));
  } catch (e) {
    console.error(e);
    app.toast(t('export.failed', { what: 'IFC', error: e instanceof Error ? e.message : String(e) }));
  }
}

/** The model as IFC4 text, named in the interface's words (the export, the project's folder). */
export function ifcText(app: App): string {
  const doc = app.store.get();
  const marks = openingMarks(doc.openings, markPrefix());
  const definition = (id: string) => doc.definitions.find((d) => d.id === id);
  return ifcOf(doc, deriveGeometry(doc), {
    project: t('app.untitled'),
    site: t('ifc.site'),
    building: t('ifc.building'),
    name,
    wall: (n) => t('wall.tag', { n }),
    material: (m) => materialLabel(m),
    opening: (id, kind) => marks.get(id) ?? t(kind === 'door' ? 'export.door' : 'export.window', { n: '' }).trim(),
    element: (key, n) => t(kindOfKey(key as KindKey).exportName, { n }),
    object: (id) => {
      const d = definition(id);
      return d ? words(d.name) : id;
    },
    category: (id) => definition(id)?.category ?? null,
    zone: (z) => z,
  }, new Date());
}

/** The model as OBJ (three.js's exporter, the GLB's scene): its groups by element, in metres, y up. */
export async function exportObj(app: App): Promise<void> {
  const doc = app.store.get();
  if (doc.walls.length === 0 && !anyKinds(doc)) {
    app.ui.info = t('export.nothing');
    return app.renderChrome();
  }
  try {
    const [{ modelScene }, { OBJExporter }] = await Promise.all([import('../render/export-gltf'), import('three/examples/jsm/exporters/OBJExporter.js')]);
    const scene = modelScene(doc, app.geometry, {
      name,
      wallTag: (n) => t('wall.tag', { n }),
      door: (n) => t('export.door', { n }),
      window: (n) => t('export.window', { n }),
      kindName: (key, n) => t(kindOfKey(key).exportName, { n }),
      kindMaterial: (key) => t(kindOfKey(key).one),
      material: (id) => materialLabel(materialIn(doc.materials, id)),
      glass: t('export.glass'),
      leaf: t('export.leaf'),
      frame: t('export.frame'),
    });
    // The OBJ and its materials (.mtl) in one ZIP: the OBJ alone opened all grey elsewhere.
    const [{ mtlName, objWithMtl }, { zipFiles }] = await Promise.all([import('../io/export-obj'), import('../io/zip')]);
    // The files inside named without spaces: mtllib names its file, and readers cut it at a space.
    const base = mtlName(app.fileBase());
    const { obj, mtl } = objWithMtl(scene, base, (s) => new OBJExporter().parse(s));
    scene.traverse((o) => (o as { geometry?: { dispose(): void } }).geometry?.dispose());
    const zip = await zipFiles([
      { name: `${base}.obj`, data: obj },
      { name: `${base}.mtl`, data: mtl },
    ]);
    const file = `${app.fileBase()} - OBJ.zip`;
    app.download(file, new Blob([zip as BlobPart], { type: 'application/zip' }), 'application/zip');
    app.toast(t('export.objSaved', { file }));
  } catch (e) {
    console.error(e);
    app.toast(t('export.failed', { what: 'OBJ', error: e instanceof Error ? e.message : String(e) }));
  }
}

/**
 * The 3D view as a picture (render/scene-3d.ts snapshot): 3840 pixels on its long side, the camera,
 * the sun and its shadows as shown; as PNG. From the 3D view only: the plan has its print.
 */
export async function saveImage3d(app: App): Promise<void> {
  if (app.ui.view !== '3d') {
    app.toast(t('image.open3d'));
    return;
  }
  // Traced, it takes the GPU a while (from seconds to about a minute): said before it starts.
  if (app.ui.view3d.style === 'photo') app.toast(t('image.tracing'));
  const blob = await app.scene.snapshot(3840);
  if (!blob) {
    app.toast(t('export.failed', { what: 'PNG', error: t('image.none') }));
    return;
  }
  const file = `${app.fileBase()} - 3D.png`;
  app.download(file, blob, 'image/png');
  app.toast(t('image.saved', { file }));
}

/** The plan of the level shown as DXF R12 (io/export-dxf.ts), for a CAD program. */
export function exportDxf(app: App): void {
  const doc = app.store.get();
  const levelId = app.ui.levelId;
  if (!doc.walls.some((w) => w.levelId === levelId)) {
    app.ui.info = t('export.nothingHere');
    return app.renderChrome();
  }
  const marks = app.ui.openingTags ? openingMarks(doc.openings, markPrefix()) : undefined;
  const text = planDxf(app.geometry, levelId, { room: (n, s) => `${n} · ${name(s)}`, area: (a) => areaText(a), ...(marks ? { marks } : {}) });
  const level = doc.levels.find((l) => l.id === levelId);
  const file = `${app.fileBase()} - ${level ? safeFileName(name(level.name)) : ''}.dxf`;
  app.download(file, new Blob([toCp1252(text)], { type: 'application/dxf' }), 'application/dxf');
  app.toast(t('export.dxfSaved', { file }));
}

/**
 * A new, empty project in place of the current one, as one undo step: like opening a file, nothing is
 * lost (Ctrl+Z gives the previous project back), so it asks nothing.
 */
export function newProject(app: App): void {
  // Kept in the browser's database: another project, the open one staying in the list (projects.ts).
  if (app.db) {
    void newStoredProject(app, app.db);
    return;
  }
  app.ui.error = null;
  app.ui.selection.clear();
  app.ui.drag = null;
  const doc = newDocument();
  app.ui.levelId = startLevel(doc);
  savePrefs({ levelId: app.ui.levelId });
  app.store.dispatch({ label: 'cmd.newProject', apply: () => doc });
  app.framed.plan = false;
  app.framed['3d'] = false;
  app.frameAll();
  app.toast(t('toast.newUndo'));
}

/**
 * Opens a project file in place of the current project, as one undo step. An IFC file (io/import-ifc.ts)
 * becomes a project of what has an element here; what has none is said.
 */
export async function openFile(app: App, file: File): Promise<void> {
  const text = await file.text();
  let ifcSaid: string | null = null;
  let source = text;
  if (/\.ifc$/i.test(file.name) || text.startsWith('ISO-10303-21')) {
    try {
      const imported = importIfc(text, newId);
      // Read as a saved project is, so it is checked the same way.
      source = JSON.stringify({ ...imported.doc, name: imported.doc.name || file.name.replace(/\.ifc$/i, '') });
      const left = Object.entries(imported.skipped).map(([cls, n]) => `${n} ${cls}`).join(', ');
      // What was made, each count as said (1 viga, 2 pilares), none of a kind left out; what was not.
      const m = imported.made;
      const what = (['levels', 'walls', 'doors', 'windows', 'rooms', 'floors', 'columns', 'beams'] as const)
        .filter((k) => m[k] > 0)
        .map((k) => t(`ifc.n.${k}${m[k] === 1 ? 'One' : ''}` as MessageKey, { n: m[k] }))
        .join(', ');
      ifcSaid = [t('ifc.read', { what: what || t('ifc.nothing') }), ...(left ? [t('ifc.left', { left })] : [])].join(' ');
    } catch (e) {
      app.ui.error = t('ifc.unreadable', { why: e instanceof Error ? e.message : String(e) });
      return app.renderChrome();
    }
  }
  const r = readProject(source);
  if (!r.ok) {
    app.ui.error = t(`open.${r.error}`);
    return app.renderChrome();
  }
  app.ui.error = null;
  app.ui.selection.clear();
  app.ui.drag = null;
  app.ui.levelId = startLevel(r.doc);
  savePrefs({ levelId: app.ui.levelId });
  // A project saved without a name is called by its file's: "casa.json" opens as "casa".
  const opened = r.doc.name ? r.doc : { ...r.doc, name: file.name.replace(/\.json$/i, '') };
  // Elements left out; ids only given their kind's prefix (typed-ids.ts) were kept, and are not counted.
  const fixed = r.fixes.filter((f) => f.kind !== 'typedIds').reduce((s, f) => s + f.count, 0);
  if (app.db) {
    // A new project of the list: the open one stays there (projects.ts).
    await importAsProject(app, app.db, opened);
    app.toast(ifcSaid ? `${ifcSaid} ${t('ifc.keptInList')}` : fixed > 1 ? t('toast.importedFixed', { n: fixed }) : fixed === 1 ? t('toast.importedFixedOne') : t('toast.imported'));
    return;
  }
  // One undo step, like any other change: opening by mistake never loses the project that was open.
  app.store.dispatch({ label: 'cmd.openProject', apply: () => opened });
  app.framed.plan = false;
  app.framed['3d'] = false;
  app.frameAll();
  app.toast(ifcSaid ? `${ifcSaid} ${t('ifc.undoBack')}` : fixed > 1 ? t('toast.openedFixed', { n: fixed }) : fixed === 1 ? t('toast.openedFixedOne') : t('toast.openedUndo'));
}
