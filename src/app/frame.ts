// One frame of the views: the plan's overlay (selection, previews, snaps, tags, temporary dimensions and their value fields) or the 3D's, and the panel. Functions over the app (app.ts delegates).

import { sunDirection } from './sun';
import { calibrateDraft } from './reference-ui';
import { roomTagText } from './room-tag';
import { overrideColours } from './layer-sets';
import { findingText } from '../ui/rules-dialog';
import { keepSelectionInView3d } from './view-ui';
import { objectHandles } from './object-handles';
import { angleNum, areaText, lengthNum, lengthText, typingExamples } from '../ui/units';
import { parseLength } from '../core/measure';
import { distance } from '../core/vector';
import { MIN_WALL_LENGTH } from '../core/tolerance';
import { resetWallsToType, setWalls, updateWalls } from '../elements/wall/commands';
import { alignHeads, alignOpenings, distributeOpenings, ruleKeepingPosition, setGroupSpacing, ungroupOpenings, updateOpening } from '../elements/opening/commands';
import { GROUP_PREFIX } from '../elements/opening/schema';
import { chainArea, chainLength, MEASURE_IDLE, reading } from '../tools/measure-tool';
import { alignWalls, distributeWalls } from '../tools/arrange-walls';
import { guideLine, guideMeasure } from '../tools/guide-tool';
import { OPENING_PREVIEW_ID, ruleGuide } from './opening-ui';
import { toolCursor } from '../ui/cursors';
import { getLang, name, t } from '../ui/i18n';
import { renderPanel } from '../ui/panel';
import { snapLabel } from '../tools/snap';
import { bulgeKeepingSide } from '../tools/arc-edit';
import { KINDS } from '../elements/registry';
import { drawingOf, levelOf, wallNumber } from './document';
import { shownFor } from './geometry';
import { stackedSteps } from './stacked';
import { type TempDim, tempDims } from './temp-dims';
import { cutAt } from './view-3d';
import { changeReferenceLine, changeWallType, moveWalls, roomFace } from '../tools/edit';
import { insideRing } from '../elements/room/derive';
import { loadPrefs, savePrefs } from './persist';
import { budgetOf } from '../costs/budget';
import { money } from '../ui/budget-dialog';
import { newId } from '../core/id';
import { clearFloorHoles, setFloorLayers, setFloorTiling, updateFloor, updateRoom, updateRooms } from '../elements/room/commands';
import type { App } from './app';
import { PREVIEW_ID, SNAP_OF } from './app';

export function renderFrame(app: App): void {
  const { ui, shell } = app;
  const plan = ui.view === 'plan';
  // The point under a pointer that has not moved changes with the view (Home, F, the keys, a drawer):
  // taken again, so the footer's coordinates and a floor outline's last side follow it.
  if (app.pointer) ui.cursor = app.pointerWorld();
  // On narrow screens the panel is a drawer over the drawing: it opens only when it has something
  // to show, so it never covers the model for nothing. Set first: what it covers shapes the view.
  const narrow = matchMedia('(max-width: 900px)').matches;
  // On narrow screens the project browser and the panel are both drawers over the drawing: while the
  // browser is open the panel waits, so the drawing keeps the most room.
  const waits = narrow && ((ui.selection.size === 0 && ui.tool === 'select') || ui.browserOpen);
  // Shown by its button while it waits, until it has something to show: then the rule above is back.
  if (!waits) ui.panelPeek = false;
  shell.panel.hidden = !ui.panelOpen || (waits && !ui.panelPeek);
  shell.planCanvas.classList.toggle('hidden', !plan);
  shell.glCanvas.classList.toggle('hidden', plan);
  app.cube.root.hidden = plan;
  // The view cube and the 3D view's centre stay in the part of the viewport the panel leaves free.
  const covered = app.covered();
  app.cube.root.style.right = `${20 + covered.right}px`;
  // Where the free part is narrow (a drawer open on a small window) the cube came over the 3D view's
  // bar: then it goes under the bar.
  app.cube.root.style.top = '';
  if (!plan && !shell.viewBar.hidden) {
    const bar = shell.viewBar.getBoundingClientRect();
    const cube = app.cube.root.getBoundingClientRect();
    const vp = shell.viewport.getBoundingClientRect();
    if (bar.width > 0 && cube.left < bar.right && cube.right > bar.left && cube.top < bar.bottom) app.cube.root.style.top = `${bar.bottom - vp.top + 8}px`;
  }
  app.scene.setCovered(covered);
  const preview = new Set([...app.previewWall(), ...app.previewOpening()].map((w) => w.id));
  const guide = app.openingKind() ? ruleGuide(app.store.get(), app.geometry, OPENING_PREVIEW_ID) : null;
  const w = ui.wall;
  const drawing = ui.tool === 'wall' && w.kind === 'drawing';
  const end = drawing ? app.drawingEnd() : null;
  const len = end && w.kind === 'drawing' ? distance(w.last, end) : 0;
  const ang = end && w.kind === 'drawing' ? ((Math.atan2(end.y - w.last.y, end.x - w.last.x) * 180) / Math.PI + 360) % 360 : 0;
  const along = end && w.kind === 'drawing' && len > 0 ? { x: (end.x - w.last.x) / len, y: (end.y - w.last.y) / len } : null;
  // A floor outline's side being drawn: from its last corner to where the next would snap.
  const floorFrom = ui.tool === 'floor' ? (ui.floorDraft.at(-1) ?? null) : null;
  const floorTo = floorFrom ? (ui.snap?.point ?? ui.cursor) : null;
  const floorLen = floorFrom && floorTo ? distance(floorFrom, floorTo) : 0;
  const floorAlong = floorFrom && floorTo && floorLen > 0 ? { x: (floorTo.x - floorFrom.x) / floorLen, y: (floorTo.y - floorFrom.y) / floorLen } : null;
  const floorAng = floorAlong ? ((Math.atan2(floorAlong.y, floorAlong.x) * 180) / Math.PI + 360) % 360 : 0;
  // The tape: from its start to where the next click would land, or as measured.
  const m = ui.tool === 'measure' ? ui.measure : MEASURE_IDLE;
  const tapeFrom = m.kind === 'from' || m.kind === 'done' ? m.a : null;
  // A chain being measured: its stretches and the one to the pointer; closed, its outline filled.
  const chainTo = m.kind === 'chain' ? (ui.snap?.point ?? ui.cursor) : null;
  const chainLine = m.kind === 'chain' ? [...m.points, ...(chainTo ? [chainTo] : [])] : m.kind === 'chainDone' ? (m.closed ? [...m.points, m.points[0]!] : [...m.points]) : null;
  const chainLast = chainLine && chainLine.length >= 2 ? { a: chainLine.at(-2)!, b: chainLine.at(-1)! } : null;
  const chainMeasure =
    m.kind === 'chainDone' && m.closed
      ? { at: { x: m.points.reduce((t, p) => t + p.x, 0) / m.points.length, y: m.points.reduce((t, p) => t + p.y, 0) / m.points.length }, text: areaText(chainArea(m.points)), clear: 0 }
      : chainLine && chainLast && distance(chainLast.a, chainLast.b) > 0
        ? {
            at: { x: (chainLast.a.x + chainLast.b.x) / 2, y: (chainLast.a.y + chainLast.b.y) / 2 },
            text: `${lengthText(distance(chainLast.a, chainLast.b))} · Σ ${lengthText(chainLength(chainLine, false))}`,
            normal: { x: -(chainLast.b.y - chainLast.a.y) / distance(chainLast.a, chainLast.b), y: (chainLast.b.x - chainLast.a.x) / distance(chainLast.a, chainLast.b) },
            clear: 0,
          }
        : null;
  const tapeTo = m.kind === 'done' ? m.b : m.kind === 'from' ? (ui.snap?.point ?? ui.cursor) : null;
  const tape = tapeFrom && tapeTo && distance(tapeFrom, tapeTo) > 0 ? reading(tapeFrom, tapeTo) : null;
  // How far the drawn preview reaches on the measure's side: its pieces as derived (reference line,
  // thickness and joins included), so the measure is set off past them.
  const side = along ? { x: -along.y, y: along.x } : null;
  const reach =
    side && w.kind === 'drawing'
      ? Math.max(0, ...(app.geometry.solids.get(PREVIEW_ID)?.pieces ?? []).flatMap((p) => p.polygon.map((v) => (v.x - w.last.x) * side.x + (v.y - w.last.y) * side.y)))
      : 0;
  // A snap on a wall says which one, by its number (shown in the panel's title): "end of wall 3".
  const snapWall = ui.snap?.wallId ? wallNumber(app.store.get(), ui.snap.wallId) : null;
  const ofKey = ui.snap && snapWall !== null && ui.snap.kind in SNAP_OF ? SNAP_OF[ui.snap.kind as keyof typeof SNAP_OF] : null;
  const labelKey = ofKey ?? (ui.snap ? snapLabel[ui.snap.kind] : null);
  // Held to a direction: what it is held to.
  const lockLabel = ui.snap?.kind === 'locked' && ui.lock ? t(ui.lock.label, ui.lock.vars) : null;
  // The guide being placed, at the distance typed or pointed; its distance as a dimension.
  const guideOff = app.guideOffset();
  const marks = app.modifyMarks();
  // A rectangle being drawn: its sides, at its middle.
  const rc = ui.tool === 'wall' && w.kind === 'rect' ? app.rectCorner() : null;
  const rectMeasure =
    rc && w.kind === 'rect'
      ? { at: { x: (w.start.x + rc.x) / 2, y: (w.start.y + rc.y) / 2 }, text: `${lengthNum(Math.abs(rc.x - w.start.x))} × ${lengthText(Math.abs(rc.y - w.start.y))}`, clear: 0 }
      : null;
  const guideDim = ui.guide && guideOff !== null ? guideMeasure(ui.guide, guideOff) : null;
  if (plan) {
    app.plan.drawing = drawingOf(app.store.get());
    app.plan.overrides = ui.overridesOn ? overrideColours(app.store.get()) : new Map();
    app.plan.draw(app.visibleGeometry(), {
      selected: ui.selection,
      hover: ui.hover,
      roomSpace: ui.tool === 'room' ? ui.roomSpace : m.kind === 'chainDone' && m.closed ? m.points : null,
      preview,
      dimensionDraft: app.dimensionDraft(),
      gridDraft: app.gridDraft(),
      sectionDraft: app.sectionDraft(),
      calloutDraft: app.calloutDraft(),
      calibrateDraft: calibrateDraft(app),
      guideDraft: ui.guide && guideOff !== null ? guideLine(ui.guide, guideOff) : null,
      snap:
        // Drawing, measuring, modifying, dividing, or dragging a wall's end: where it snaps, said as it is.
        (ui.tool === 'wall' || ui.tool === 'guide' || ui.tool === 'floor' || ui.tool === 'measure' || ui.tool === 'dimension' || ui.tool === 'grid' || ui.tool === 'section' || ui.tool === 'callout' || ui.tool === 'calibrate' || ui.tool === 'spot' || ui.tool === 'column' || ui.tool === 'beam' || ui.tool === 'separator' || ui.tool === 'curtain' || ui.tool === 'roof' || ui.tool === 'stair' || ui.tool === 'railing' || ui.tool === 'modify' || ui.tool === 'split' || ui.drag?.kind === 'grip') && ui.snap
          ? { point: ui.snap.point, kind: ui.snap.kind, label: lockLabel ?? (labelKey ? t(labelKey, { n: snapWall ?? '' }) : null), ...(ui.snap.guideFrom ? { guideFrom: ui.snap.guideFrom } : {}), ...((along ?? floorAlong) ? { away: (along ?? floorAlong)! } : {}) }
          : null,
      measure: guideDim
        ? { at: { x: (guideDim.a.x + guideDim.b.x) / 2, y: (guideDim.a.y + guideDim.b.y) / 2 }, text: `${lengthText(guideOff!)}`, normal: ui.guide!.base.dir, clear: 0 }
        : rectMeasure
          ? rectMeasure
        : marks?.to && marks.text
          ? { at: { x: (marks.base.x + marks.to.x) / 2, y: (marks.base.y + marks.to.y) / 2 }, text: marks.text, clear: 0 }
        : end && along && len >= MIN_WALL_LENGTH && w.kind === 'drawing'
          ? { at: { x: (w.last.x + end.x) / 2, y: (w.last.y + end.y) / 2 }, text: `${lengthText(len)} · ${angleNum(ang)}°`, normal: side!, clear: reach }
          : floorFrom && floorTo && floorAlong && floorLen >= MIN_WALL_LENGTH
            ? { at: { x: (floorFrom.x + floorTo.x) / 2, y: (floorFrom.y + floorTo.y) / 2 }, text: `${lengthText(floorLen)} · ${angleNum(floorAng)}°`, normal: { x: -floorAlong.y, y: floorAlong.x }, clear: 0 }
            : chainMeasure
              ? chainMeasure
              : tape && tapeFrom && tapeTo
              ? {
                  at: { x: (tapeFrom.x + tapeTo.x) / 2, y: (tapeFrom.y + tapeTo.y) / 2 },
                  text: `${lengthText(tape.length)} · ${angleNum(tape.angle)}°`,
                  normal: { x: -tape.dy / tape.length, y: tape.dx / tape.length },
                  clear: 0,
                }
              : (app.bendMeasure() ?? app.turnMeasure() ?? guide?.measure ?? null),
      axis:
        end && len >= MIN_WALL_LENGTH && w.kind === 'drawing'
          ? { start: w.last, end }
          : tape && tapeFrom && tapeTo
            ? { start: tapeFrom, end: tapeTo }
            : marks?.to && !marks.axis
              ? { start: marks.base, end: marks.to }
              : null,
      axisLine: marks?.axis ?? null,
      refLines: app.refLines(),
      openingTags: app.openingTags(),
      normMarks: app.normMarks(),
      ray: marks?.ref ? { start: marks.base, end: marks.ref } : null,
      handles: app.handles(),
      objectHandles: objectHandles(app),
      hotHandle: app.hotHandle,
      anchor: ui.tool === 'wall' && (w.kind === 'drawing' || w.kind === 'bend') ? w.last : (tapeFrom ?? marks?.base ?? null),
      wallTags: app.wallTags(),
      roomLabels: [...app.visibleGeometry().rooms.values()].map((r) => {
        const said = roomTagText(r.room, r.area, levelOf(app.store.get(), r.room.levelId)?.height ?? 0, drawingOf(app.store.get()).roomTag);
        return {
          at: r.label,
          name: said.name,
          short: said.short,
          // A room sharing its space with another says so on its tag: the two tags fell on one another
          // and one name was simply not seen.
          area: !r.enclosed
            ? t('warn.roomNotEnclosed')
            : r.sharing.length > 0
              ? t('warn.roomShared', { rooms: r.sharing.map((id) => app.store.get().rooms.find((x) => x.id === id)).flatMap((x) => (x ? [`${x.number} · ${name(x.name)}`] : [])).join(', ') })
              : said.area,
          ...(!r.enclosed
            ? { brief: t('warn.roomNotEnclosedBrief') }
            : r.sharing.length > 0
              ? { brief: t('warn.roomSharedBrief', { rooms: r.sharing.flatMap((id) => app.store.get().rooms.find((x) => x.id === id)?.number ?? []).join(', ') }) }
              : {}),
          warn: !r.enclosed || r.sharing.length > 0,
          outline: r.outline,
        };
      }),
      // A floor's outline being drawn, or a beam from its first point to where the next click lands.
      draft:
        chainLine && chainLine.length >= 2
          ? chainLine
          : ui.tool === 'guide' && ui.guideFrom && (ui.snap?.point ?? ui.cursor)
            ? [ui.guideFrom, (ui.snap?.point ?? ui.cursor)!]
          : ui.tool === 'floor' && ui.floorDraft.length > 0
          ? [...ui.floorDraft, ...(floorTo ? [floorTo] : [])]
          : (ui.tool === 'beam' || ui.tool === 'separator' || ui.tool === 'curtain') && ui.beamFrom && (ui.snap?.point ?? ui.cursor)
            ? [ui.beamFrom, (ui.snap?.point ?? ui.cursor)!]
            : ui.tool === 'roof' && ui.roofDraft.length > 0
              ? [...ui.roofDraft, ...((ui.snap?.point ?? ui.cursor) ? [(ui.snap?.point ?? ui.cursor)!] : [])]
              : ui.tool === 'stair' && ui.stairFrom && (ui.snap?.point ?? ui.cursor)
                ? [ui.stairFrom, (ui.snap?.point ?? ui.cursor)!]
                : ui.tool === 'railing' && ui.railingDraft.length > 0
                  ? [...ui.railingDraft, ...((ui.snap?.point ?? ui.cursor) ? [(ui.snap?.point ?? ui.cursor)!] : [])]
                  : null,
      draftCorners: ui.tool === 'floor' ? ui.floorDraft : [],
      openingPreview: preview.has(OPENING_PREVIEW_ID) ? OPENING_PREVIEW_ID : null,
      // The opening being placed shows its distance as a dimension too (drawn only, not typed in: the
      // footer field takes the distance while placing).
      dims: [
        ...app.currentDims().map((d) => ({ ...d, text: lengthNum(d.value) })),
        ...(guide ? [guide.dim] : []),
        ...(guideDim && guideOff! > 0 ? [{ ...guideDim, side: ui.guide!.base.dir, clear: 0 }] : []),
      ],
      underlay: app.underlay(),
      acquired: ui.acquired,
      circleDraft:
        ui.tool === 'guide' && ui.guideMode === 'circle' && ui.guideFrom && (ui.snap?.point ?? ui.cursor)
          ? { center: ui.guideFrom, radius: distance(ui.guideFrom, (ui.snap?.point ?? ui.cursor)!) }
          : null,
      smart: ui.smart && ui.drag?.kind === 'move' ? { lines: ui.smart.lines, gaps: ui.smart.gaps.map((g) => ({ ...g, text: lengthText(distance(g.a, g.b)) })) } : null,
    });
    app.plan.drawPoints(app.pointsShown());
  } else {
    const shown = app.visibleGeometry();
    app.scene.setXray(ui.view3d.xray);
    app.scene.setDoorsOpen(app.walker !== null, ui.opened);
    app.scene.setBox(ui.view3d.box);
    app.scene.setOrtho(ui.view3d.ortho);
    app.scene.setSection(ui.view3d.section);
    app.scene.sync(shown, ui.selection, preview, (id) => app.lift(id));
    const site = app.store.get().site;
    app.scene.setSun(site ? sunDirection(site) : null, site?.shadows ?? false);
    // Cut at the level's cut height: where it goes through the level's walls, their plan pieces.
    const doc = app.store.get();
    const cut = cutAt(doc.levels, ui.levelId, ui.view3d);
    app.scene.setCut(
      cut,
      cut === null ? [] : [...shown.solids.values()].filter((s) => s.wall.levelId === ui.levelId && s.plan === 'cut').flatMap((s) => s.pieces.map((p) => p.polygon)),
    );
    app.cube.update(app.scene.camera);
    // Where the tool snaps and what it draws, over the 3D view as in plan.
    const level = levelOf(app.store.get(), ui.levelId);
    const active = ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'measure' || ui.tool === 'modify';
    app.overlayState = {
      project: (p, z) => app.projectAt(p, z),
      floor: (level?.elevation ?? 0) + app.lift(ui.levelId),
      height: level?.height ?? 2.8,
      snap: active && ui.snap ? { point: ui.snap.point, kind: ui.snap.kind, label: lockLabel ?? (labelKey ? t(labelKey, { n: snapWall ?? '' }) : null) } : null,
      axis:
        end && len >= MIN_WALL_LENGTH && w.kind === 'drawing'
          ? { start: w.last, end }
          : tape && tapeFrom && tapeTo
            ? { start: tapeFrom, end: tapeTo }
            : marks?.to
              ? { start: marks.base, end: marks.to }
              : null,
      measure: marks?.to && marks.text
        ? { at: { x: (marks.base.x + marks.to.x) / 2, y: (marks.base.y + marks.to.y) / 2 }, text: marks.text }
        : end && len >= MIN_WALL_LENGTH && w.kind === 'drawing'
          ? { at: { x: (w.last.x + end.x) / 2, y: (w.last.y + end.y) / 2 }, text: `${lengthText(len)} · ${angleNum(ang)}°` }
          : floorFrom && floorTo && floorLen >= MIN_WALL_LENGTH
            ? { at: { x: (floorFrom.x + floorTo.x) / 2, y: (floorFrom.y + floorTo.y) / 2 }, text: `${lengthText(floorLen)} · ${angleNum(floorAng)}°` }
            : tape && tapeFrom && tapeTo
              ? { at: { x: (tapeFrom.x + tapeTo.x) / 2, y: (tapeFrom.y + tapeTo.y) / 2 }, text: `${lengthText(tape.length)} · ${angleNum(tape.angle)}°` }
              : app.bendMeasure(),
      anchor: ui.tool === 'wall' && (w.kind === 'drawing' || w.kind === 'bend') ? w.last : (tapeFrom ?? marks?.base ?? null),
      // A floor's outline being drawn, or a beam from its first point to where the next click lands.
      draft:
        chainLine && chainLine.length >= 2
          ? chainLine
          : ui.tool === 'guide' && ui.guideFrom && (ui.snap?.point ?? ui.cursor)
            ? [ui.guideFrom, (ui.snap?.point ?? ui.cursor)!]
          : ui.tool === 'floor' && ui.floorDraft.length > 0
          ? [...ui.floorDraft, ...(floorTo ? [floorTo] : [])]
          : (ui.tool === 'beam' || ui.tool === 'separator' || ui.tool === 'curtain') && ui.beamFrom && (ui.snap?.point ?? ui.cursor)
            ? [ui.beamFrom, (ui.snap?.point ?? ui.cursor)!]
            : ui.tool === 'roof' && ui.roofDraft.length > 0
              ? [...ui.roofDraft, ...((ui.snap?.point ?? ui.cursor) ? [(ui.snap?.point ?? ui.cursor)!] : [])]
              : ui.tool === 'stair' && ui.stairFrom && (ui.snap?.point ?? ui.cursor)
                ? [ui.stairFrom, (ui.snap?.point ?? ui.cursor)!]
                : ui.tool === 'railing' && ui.railingDraft.length > 0
                  ? [...ui.railingDraft, ...((ui.snap?.point ?? ui.cursor) ? [(ui.snap?.point ?? ui.cursor)!] : [])]
                  : null,
      box: ui.view3d.box,
      boxHot: app.boxHot,
      points: app.pointsShown(),
      objectHandles: objectHandles(app),
      hotHandle: app.hotHandle,
    };
    app.overlay3d.draw(app.overlayState);
  }
  app.overlay3d.canvas.classList.toggle('hidden', plan);
  shell.viewport.style.cursor = toolCursor(ui.tool);
  app.mark(plan ? 'plan' : '3d');
  app.placeDims(plan ? app.currentDims() : []);
  app.mark('dims');
  app.renderBrowserDrawer();
  app.mark('browser');
  app.renderChrome();
  app.mark('chrome');
  // The panel is rebuilt only when what it shows changed: rebuilding on every mouse move would
  // close an open list and drop the focus of a field being typed in.
  const doc = app.store.get();
  const openingKey = JSON.stringify([ui.openingDefaults, app.geometry.openingWarnings, app.selectedOpenings().map((o) => [o.start, o.end])]);
  const panelKey = [ui.tool, [...ui.selection].sort().join(','), getLang(), JSON.stringify(ui.defaults), JSON.stringify(app.geometry.warnings), openingKey].join('|');
  const placing = app.openingKind();
  if (doc === app.panelDoc && panelKey === app.panelKey) return app.afterPanel();
  app.panelDoc = doc;
  app.panelKey = panelKey;
  renderPanel(
    shell.panel,
    {
      doc,
      selected: app.selectedWalls(),
      drawing: ui.tool === 'wall',
      defaults: ui.defaults,
      warnings: app.geometry.warnings,
      openings: app.selectedWalls().length === 0 ? app.selectedOpenings() : [],
      levelRooms: [...app.geometry.rooms.values()].filter((r) => r.room.levelId === ui.levelId),
      placed: app.geometry.openings,
      openingWarnings: app.geometry.openingWarnings,
      openingTool: placing ? { kind: placing, size: ui.openingDefaults[placing] } : null,
      total: ui.selection.size,
      // The first registry kind with a selected element, and those of its elements, as derived.
      kind: (() => {
        for (const k of KINDS) {
          const items = [...(app.geometry.kinds.get(k.key) ?? new Map()).entries()].filter(([id]) => ui.selection.has(id)).map(([, x]) => x);
          if (items.length > 0) return { kind: k, items };
        }
        return null;
      })(),
      stacked: stackedSteps(doc),
      norms: app.normFindings().filter((f) => ui.selection.has(f.elementId)).map(findingText),
    },
    {
      updateWalls: (patch) => app.store.dispatch(updateWalls([...ui.selection], patch)),
      setReferenceLine: (line) => {
        const ids = app.selectedWalls().map((w) => w.id);
        app.store.dispatch(setWalls(changeReferenceLine(app.store.get(), ids, line), 'cmd.referenceLine'));
      },
      setWallType: (typeId) => {
        const doc = app.store.get();
        const ids = app.selectedWalls().map((w) => w.id);
        // The rooms as they are now, before the walls move: the face each wall has against one stays.
        const rooms = [...app.geometry.rooms.values()].filter((r) => r.enclosed);
        const inRoom = (levelId: string, p: { x: number; y: number }) => rooms.some((r) => r.room.levelId === levelId && insideRing(r.outline, p));
        const keep = loadPrefs().keepClear !== false;
        // With a priced budget, what the change did to it, at once (costs/budget.ts).
        const before = doc.costs && doc.costs.lines.length > 0 ? budgetOf(doc, app.geometry).total : null;
        app.store.dispatch(setWalls(changeWallType(doc, ids, typeId, (w) => (keep ? roomFace(doc, w, inRoom) : null)), 'cmd.wallType'));
        if (before !== null) {
          const delta = budgetOf(app.store.get(), app.geometry).total - before;
          if (Math.abs(delta) >= 0.005) app.toast(t('budget.delta', { d: `${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}` }));
        }
      },
      keepClear: loadPrefs().keepClear !== false,
      setKeepClear: (on) => {
        savePrefs({ keepClear: on });
        app.render();
      },
      resetToType: (fields) => app.store.dispatch(resetWallsToType([...ui.selection], fields)),
      editType: () => app.openWallTypes(app.store.get().walls.find((w) => ui.selection.has(w.id))?.wallTypeId),
      updateRadius: (radius) => {
        const w = app.store.get().walls.find((x) => ui.selection.has(x.id));
        const bulge = w?.bulge ? bulgeKeepingSide(distance(w.start, w.end), w.bulge, radius) : null;
        if (w && bulge !== null) app.store.dispatch(updateWalls([w.id], { bulge }));
      },
      setEndJoin: (end, join) => {
        const w = app.store.get().walls.find((x) => ui.selection.has(x.id));
        if (!w) return;
        const joins = { ...w.joins, [end]: join === 'auto' ? undefined : join };
        // An end back to automatic is left out; a wall with neither end chosen has no `joins`.
        const kept = Object.fromEntries(Object.entries(joins).filter(([, v]) => v !== undefined));
        app.store.dispatch(setWalls(app.store.get().walls.map((x) => (x.id === w.id ? (Object.keys(kept).length > 0 ? { ...x, joins: kept } : (({ joins: _j, ...rest }) => rest)(x)) : x)), 'cmd.setEndJoin'));
      },
      arrangeWalls: (how) => {
        // In the order they were picked: the first is the reference.
        const ids = [...ui.selection].filter((id) => app.store.get().walls.some((w) => w.id === id));
        const walls = how === 'align' ? alignWalls(app.store.get(), ids) : distributeWalls(app.store.get(), ids);
        if (walls) app.store.dispatch(setWalls(walls, how === 'align' ? 'cmd.alignWalls' : 'cmd.distributeWalls'));
      },
      ...(() => {
        const ws = app.selectedWalls();
        if (ws.length !== 1) return {};
        const { start, end } = ws[0]!;
        const [dx, dy] = [end.x - start.x, end.y - start.y];
        type Side = 'top' | 'bottom' | 'left' | 'right';
        const sides: [Side, Side] = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? ['left', 'right'] : ['right', 'left']) : dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
        return { endSides: sides };
      })(),
      ...(() => {
        const first = [...ui.selection].find((id) => app.store.get().walls.some((w) => w.id === id));
        const n = first ? wallNumber(app.store.get(), first) : null;
        return n !== null ? { firstWall: t('wall.tag', { n }) } : {};
      })(),
      updateDefaults: (patch) => {
        ui.defaults = { ...ui.defaults, ...patch };
        app.refresh();
      },
      close: () => app.togglePanel(false),
      openSection: (id) => app.openSections(id),
      calibrate: (id) => app.startCalibration(id),
      addSpot: (id) => app.startSpot(id),
      room: {
        updateRoom: (id, patch) => app.store.dispatch(updateRoom(id, patch)),
        updateRooms: (ids, patch) => app.store.dispatch(updateRooms(ids, patch)),
        levelHeight: (levelId) => levelOf(app.store.get(), levelId)?.height ?? 0,
        startFloorHole: (id) => app.startFloorHole(id),
        clearFloorHoles: (ids) => app.store.dispatch(clearFloorHoles(ids)),
        materials: () => app.store.get().materials,
        setFloorLayers: (ids, layers) => app.store.dispatch(setFloorLayers(ids, layers)),
        setFloorTiling: (ids, tiling) => app.store.dispatch(setFloorTiling(ids, tiling)),
        updateFloor: (ids, patch) => {
          const doc = app.store.get();
          const next = ids.reduce((d, id) => updateFloor(id, patch).apply(d), doc);
          if (next !== doc) app.store.dispatch({ label: 'cmd.updateFloor', apply: () => next });
        },
      },
      opening: {
        update: (ids, patch) => {
          // One command for the whole selection: one undo step.
          const doc = app.store.get();
          // A patch made per opening (its own style changed in one property) or the same for all.
          const next = ids.reduce((d, id) => {
            const o = d.openings.find((x) => x.id === id);
            return o ? updateOpening(id, typeof patch === 'function' ? patch(o) : patch).apply(d) : d;
          }, doc);
          if (next !== doc) app.store.dispatch({ label: 'cmd.updateOpening', apply: () => next });
        },
        setRule: (id, kind, referenceId) => {
          const rule = ruleKeepingPosition(app.store.get(), id, kind, referenceId);
          if (rule) app.store.dispatch(updateOpening(id, { rule }));
        },
        align: (refId, ids, edge) => app.store.dispatch(alignOpenings(refId, ids, edge)),
        alignHeads: (refId, ids) => app.store.dispatch(alignHeads(refId, ids)),
        distribute: (ids, spacing) => app.store.dispatch(distributeOpenings(newId(GROUP_PREFIX), ids, spacing)),
        setSpacing: (groupId, spacing) => app.store.dispatch(setGroupSpacing(groupId, spacing)),
        ungroup: (groupId) => app.store.dispatch(ungroupOpenings(groupId)),
      },
      updateOpeningDefaults: (kind, patch) => {
        ui.openingDefaults = { ...ui.openingDefaults, [kind]: { ...ui.openingDefaults[kind], ...patch } };
        app.refresh();
      },
      dispatch: (c) => app.store.dispatch(c),
      // The wall moved across, with its joins kept as a move keeps them: the face then meets the one below.
      alignBelow: (step) => app.store.dispatch(setWalls(moveWalls(app.store.get(), [step.upperId], step.shift), 'cmd.alignBelow')),
    },
  );
  app.afterPanel();
}

/**
 * After the panel has its content: a new selection the panel would hide (sheet or drawer over the
 * plan) brings the plan into view, and the plan is drawn again where it now is.
 */
export function afterPanel(app: App): void {
  if (app.ui.view === 'plan' && app.keepSelectionInView()) app.render();
  else if (app.ui.view === '3d' && keepSelectionInView3d(app)) app.render();
}

/**
 * Temporary dimensions of the one selected element, while selecting; while dragging only when they
 * follow the drag: a door or a window slid, or one wall moved (its length and its gaps to the walls
 * parallel to it, as they become).
 */
export function currentDims(app: App): TempDim[] {
  const d = app.ui.drag;
  if (app.ui.tool !== 'select' || (d && d.kind !== 'slide' && d.kind !== 'move')) return [];
  const doc = app.store.get();
  const moved = d?.kind === 'slide' ? { ...doc, openings: d.openings } : d?.kind === 'move' ? { ...doc, walls: d.walls } : doc;
  // Measured only to what shows: an isolated wall measured 2,55 m to a wall hidden for now.
  const temp = app.ui.temp;
  const shown = temp ? { ...moved, walls: moved.walls.filter((w) => shownFor(temp, w.id)), openings: moved.openings.filter((o) => shownFor(temp, o.id) || shownFor(temp, o.wallId)) } : moved;
  return tempDims(shown, app.geometry, app.ui.selection);
}

/**
 * The value of each temporary dimension, as a button at the middle of its line; the one being
 * edited is a field. Elements are kept between renders so a field being typed in keeps its focus.
 */
export function placeDims(app: App, dims: readonly TempDim[]): void {
  const box = app.shell.dims;
  if (app.ui.dimEdit && !dims.some((d) => d.id === app.ui.dimEdit)) app.ui.dimEdit = null;
  const keep = new Set(dims.map((d) => `${d.id}|${d.id === app.ui.dimEdit ? 'edit' : 'show'}`));
  for (const child of [...box.children] as HTMLElement[]) if (!keep.has(child.dataset.key ?? '')) child.remove();
  const nodes: HTMLElement[] = [];
  for (const d of dims) {
    const editing = d.id === app.ui.dimEdit;
    const key = `${d.id}|${editing ? 'edit' : 'show'}`;
    let node = [...box.children].find((c) => (c as HTMLElement).dataset.key === key) as HTMLElement | undefined;
    if (!node) {
      node = editing ? app.dimField(d) : app.dimButton(d);
      node.dataset.key = key;
      box.append(node);
      if (node instanceof HTMLInputElement) {
        node.focus();
        node.select();
      }
    }
    if (node instanceof HTMLButtonElement) {
      node.textContent = lengthNum(d.value);
      node.title = t('dim.edit');
      node.setAttribute('aria-label', `${lengthText(d.value)}. ${t('dim.edit')}`);
    }
    nodes.push(node);
  }
  // Where the plan places them (plan-view.ts: dimValueBoxes), which its tags keep off too.
  const boxes = app.plan.dimValueBoxes(dims.map((d) => ({ ...d, text: lengthNum(d.value) })));
  nodes.forEach((node, i) => {
    node.style.left = `${boxes[i]!.x + boxes[i]!.w / 2}px`;
    node.style.top = `${boxes[i]!.y + boxes[i]!.h / 2}px`;
  });
}

export function dimButton(app: App, d: TempDim): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.addEventListener('click', () => {
    app.ui.dimEdit = d.id;
    app.render();
  });
  return b;
}

export function dimField(app: App, d: TempDim): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = lengthNum(d.value);
  input.setAttribute('aria-label', t('foot.measure'));
  const close = () => {
    if (app.ui.dimEdit !== d.id) return;
    app.ui.dimEdit = null;
    app.render();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      app.ui.error = null;
      return close();
    }
    if (e.key !== 'Enter') return;
    const text = input.value.trim();
    const v = parseLength(text);
    // The dimension as it is now: the one app field was made for may be stale.
    const dim = app.currentDims().find((x) => x.id === d.id);
    const cmd = v.ok && dim ? dim.apply(v.value) : null;
    if (!cmd) {
      app.ui.error = t(v.ok ? 'hint.dimRefused' : 'hint.badMeasure', { ...typingExamples(), text });
      return app.renderChrome();
    }
    app.ui.error = null;
    app.ui.dimEdit = null;
    app.store.dispatch(cmd);
  });
  input.addEventListener('blur', close);
  return input;
}
