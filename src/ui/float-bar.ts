// The floating bar over the selection (its place beside what is selected) and the measure hint of the footer.

import type { App } from '../session/app';
import { getLang, t } from '../i18n/messages';
import { angleAt, chainArea, chainLength, reading } from '../elements/measure/tool';
import { angleNum, areaText, lengthText } from '../i18n/units';
import { distance, type Point2 } from '../model/vector';
import { contextEntries } from '../session/context-menu';
import { icon } from '../i18n/icons';
import { boundsOf, openingOutline } from '../project/derived-queries';
import * as THREE from 'three';
import { kindOfId, levelOfSolid } from '../elements/registry';
import { placeBarY } from './bar-place';
import * as appView from '../session/app-view';
import { placedOf, solidOf } from '../project/derived-queries';

/** The footer for the measure tool: what to click, or what the tape read. */
export function measureHint(app: App): string {
  const m = app.ui.measure;
  if (m.kind === 'idle') return t(app.ui.measureMode === 'chain' ? 'hint.chainStart' : 'hint.measureStart');
  if (m.kind === 'from') return t('hint.measureEnd');
  if (m.kind === 'chain') {
    // The stretches so far and the one to the pointer; the angle where the last two meet.
    const to = app.ui.snap?.point ?? app.ui.cursor;
    const pts = to ? [...m.points, to] : [...m.points];
    if (pts.length < 2) return t('hint.chainNext');
    const n = pts.length;
    const angle = n >= 3 ? angleAt(pts[n - 3]!, pts[n - 2]!, pts[n - 1]!) : null;
    return t(angle === null ? 'hint.chainSoFar' : 'hint.chainSoFarAngle', { total: lengthText(chainLength(pts, false)), n: n - 1, last: lengthText(distance(pts[n - 2]!, pts[n - 1]!)), a: angleNum(angle ?? 0) });
  }
  if (m.kind === 'chainDone') {
    if (m.closed) return t('hint.areaDone', { area: areaText(chainArea(m.points)), p: lengthText(chainLength(m.points, true)), n: m.points.length });
    return t('hint.chainDone', { total: lengthText(chainLength(m.points, false)), n: m.points.length - 1 });
  }
  const r = reading(m.a, m.b);
  return t('hint.measured', { d: lengthText(r.length), dx: lengthText(Math.abs(r.dx)), dy: lengthText(Math.abs(r.dy)), a: angleNum(r.angle) });
}

export function placeFloatBar(app: App): void {
  const bar = app.shell.floatBar;
  const entries = app.ui.selection.size > 0 ? contextEntries(app, () => app.openCommands()) : [];
  const key = `${getLang()}|${entries.map((e) => e.id).join(',')}`;
  if (key !== app.floatKey) {
    app.floatKey = key;
    bar.replaceChildren(
      ...entries.map((e) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'icon-btn';
        b.innerHTML = icon(e.icon);
        b.title = e.keys ? `${e.label} (${e.keys})` : e.label;
        b.setAttribute('aria-label', b.title);
        // The buttons outlive the selection they were made for (they are rebuilt only when the set of
        // actions changes): the action is looked up at the click, for what is selected then. Kept from
        // when the bar was built, "Centre" centred the window selected before.
        b.addEventListener('click', () => contextEntries(app, () => app.openCommands()).find((x) => x.id === e.id)?.run());
        return b;
      }),
    );
  }
  const box = app.ui.tool === 'select' && !app.ui.drag ? boundsOf(app.geometry, app.ui.selection) : null;
  bar.hidden = box === null;
  if (box === null) return;
  const vp = app.shell.viewport.getBoundingClientRect();
  let x: number;
  let yTop: number;
  let yBottom: number;
  if (app.ui.view === 'plan') {
    const a = app.plan.toScreen({ x: box.min.x, y: box.max.y });
    const b = app.plan.toScreen({ x: box.max.x, y: box.min.y });
    x = (a.x + b.x) / 2;
    yTop = a.y;
    yBottom = b.y;
  } else {
    // The selection's screen box: every vertex of its pieces, at the bottom and at the top.
    const xs: number[] = [];
    const ys: number[] = [];
    const project = (v: Point2, z: number) => {
      const p = new THREE.Vector3(v.x, z, -v.y).project(app.scene.camera);
      // Behind the camera a point projects mirrored: leave it out.
      if (p.z > 1) return;
      xs.push(((p.x + 1) / 2) * vp.width);
      ys.push(((1 - p.y) / 2) * vp.height);
    };
    for (const id of app.ui.selection) {
      // Each at its level's height in the view (lifted when exploded).
      const opening = placedOf(app.geometry, id);
      if (opening) {
        const up = appView.lift(app, app.geometry.solids.get(opening.opening.wallId)?.wall.levelId ?? '');
        for (const v of openingOutline(opening)) [opening.bottom, opening.top].forEach((z) => project(v, z + up));
      }
      // The registry's with a height (a room at its level's floor, a floor): their outlines at both faces.
      const k = kindOfId(id);
      const s = k?.span ? app.geometry.kinds.get(k.key)?.get(id) : undefined;
      if (k?.span && s !== undefined) {
        const { bottom, top } = k.span(s);
        const up = appView.lift(app, levelOfSolid(k, s) ?? app.ui.levelId);
        for (const v of k.outlines(s).flat()) [bottom, top].forEach((z) => project(v, z + up));
      }
      const solid = solidOf(app.geometry, id);
      if (!solid) continue;
      const up = appView.lift(app, solid.wall.levelId);
      for (const piece of solid.pieces) {
        for (const v of piece.polygon) {
          for (const z of [solid.bottom, solid.top]) project(v, z + up);
        }
      }
    }
    // Nothing of the selection in front of the camera: no bar, rather than one at a stale place.
    if (xs.length === 0) {
      bar.hidden = true;
      return;
    }
    x = (Math.min(...xs) + Math.max(...xs)) / 2;
    yTop = Math.min(...ys);
    yBottom = Math.max(...ys);
  }
  const w = bar.offsetWidth || 104;
  const h = bar.offsetHeight || 36;
  // Never under the panel where it lies over the drawing (the sheet on a phone, the drawer on a tablet).
  const panel = app.shell.panel.hidden ? null : app.shell.panel.getBoundingClientRect();
  const covered = panel && panel.top > vp.top + 8 && panel.top < vp.bottom ? panel.top - vp.top : vp.height;
  const right = panel && panel.left > vp.left && panel.left < vp.right && panel.top <= vp.top + 8 ? panel.left - vp.left : vp.width;
  const left = Math.min(Math.max(8, x - w / 2), right - w - 8);
  // Never over a temporary dimension's value, a room's tag or a handle of the selection (bar-place.ts):
  // on a phone after F it sat on the handle at an arc's end (the tester's R04).
  const h0 = appView.handles(app);
  const grip = (p: Point2) => ({ top: p.y - 12, bottom: p.y + 12, left: p.x - 12, right: p.x + 12 });
  const boxes = [
    ...[...h0.squares, ...h0.arrows, ...(h0.bulge ? [h0.bulge] : []), ...(h0.rotate ? [h0.rotate] : [])].map((x) => grip(x.at)),
    ...[...app.shell.dims.children].map((c) => c.getBoundingClientRect()).map((r) => ({ top: r.top - vp.top, bottom: r.bottom - vp.top, left: r.left - vp.left, right: r.right - vp.left })),
    ...(app.ui.view === 'plan' ? app.plan.labelBoxes.map((b) => ({ top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w })) : []),
  ];
  const y = placeBarY({ left, w, h }, { top: yTop, bottom: yBottom }, boxes, { h: covered });
  bar.style.left = `${left}px`;
  bar.style.top = `${Math.min(Math.max(8, y), covered - h - 8)}px`;
}
