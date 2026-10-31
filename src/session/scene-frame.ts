// The 3D scene brought in step with the session each frame (frame.ts, through plan-overlay.ts): x-ray,
// phases, opened doors, section box, camera kind, look, light, section line, the geometry and the cut.

import { wallPhases } from '../project/layer-sets';
import type { DerivedGeometry } from '../project/derive';
import { cutAt } from './view/view-3d';
import type { App } from './app';
import * as sceneLook from '../render/scene-look';
import * as sceneSync from '../render/scene-sync';
import * as sceneCut from '../render/scene-cut';
import * as appView from './app-view';
import type { ElementId } from '../core/id';
import { t } from '../i18n/messages';

export function syncScene(app: App, preview: ReadonlySet<ElementId>, shown: DerivedGeometry): void {
  const { ui } = app;
  sceneLook.setXray(app.scene, ui.view3d.xray);
  // A renovation's walls by phase, as the plan draws them while the overrides are on.
  const css = getComputedStyle(document.documentElement);
  sceneLook.setPhases(app.scene, ui.overridesOn ? wallPhases(app.store.get()) : new Map(), (p) => css.getPropertyValue(`--phase-${p}`).trim());
  app.scene.setOpened(ui.opened);
  sceneCut.setBox(app.scene, ui.view3d.box);
  sceneCut.setOrtho(app.scene, ui.view3d.ortho);
  sceneLook.setLook(app.scene, ui.view3d.style, ui.view3d.quality);
  sceneLook.setLight(app.scene, ui.view3d.brightness, ui.view3d.sun);
  sceneCut.setSection(app.scene, ui.view3d.section);
  sceneSync.sync(app.scene, shown, ui.selection, preview, (id) => appView.lift(app, id));
  // Cut at the level's cut height: where it goes through the level's walls, their plan pieces.
  const doc = app.store.get();
  const cut = cutAt(doc.levels, ui.levelId, ui.view3d);
  sceneCut.setCut(app.scene, cut, cut === null ? [] : [...shown.solids.values()].filter((s) => s.wall.levelId === ui.levelId && s.plan === 'cut').flatMap((s) => s.pieces.map((p) => p.polygon)));
}

/** The photorealistic view's notes: said when its tracer cannot be used, and its first minutes (its shader compiled in the background) beside the style. */
export function wireTraceNotes(app: App): void {
  app.scene.onTraceUnavailable = () => app.toast(t('view3d.traceUnavailable'));
  app.scene.onTracePreparing = (on) => {
    app.shell.look.preparing.hidden = !on;
    app.shell.look.preparing.textContent = t('view3d.preparing');
    app.shell.look.preparing.title = t('view3d.preparingTip');
    // It takes room on the view's bar: what is there gives way if it no longer fits.
    app.shell.fitViewBar(true);
  };
}
