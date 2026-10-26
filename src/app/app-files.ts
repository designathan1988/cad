// The project as a file: saving, opening, a new one, and the exports (GLB, DXF). Functions over the app (app.ts delegates).

import { markPrefix, materialLabel, name, num, t } from '../ui/i18n';
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

/** The plan of the level shown as DXF R12 (io/export-dxf.ts), for a CAD program. */
export function exportDxf(app: App): void {
  const doc = app.store.get();
  const levelId = app.ui.levelId;
  if (!doc.walls.some((w) => w.levelId === levelId)) {
    app.ui.info = t('export.nothingHere');
    return app.renderChrome();
  }
  const marks = app.ui.openingTags ? openingMarks(doc.openings, markPrefix()) : undefined;
  const text = planDxf(app.geometry, levelId, { room: (n, s) => `${n} · ${name(s)}`, area: (a) => `${num(a)} m²`, ...(marks ? { marks } : {}) });
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

/** Opens a project file in place of the current project, as one undo step. */
export async function openFile(app: App, file: File): Promise<void> {
  const r = readProject(await file.text());
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
    app.toast(fixed > 1 ? t('toast.importedFixed', { n: fixed }) : fixed === 1 ? t('toast.importedFixedOne') : t('toast.imported'));
    return;
  }
  // One undo step, like any other change: opening by mistake never loses the project that was open.
  app.store.dispatch({ label: 'cmd.openProject', apply: () => opened });
  app.framed.plan = false;
  app.framed['3d'] = false;
  app.frameAll();
  app.toast(fixed > 1 ? t('toast.openedFixed', { n: fixed }) : fixed === 1 ? t('toast.openedFixedOne') : t('toast.openedUndo'));
}
