// The plan as drawn each frame (frame.ts calls it): the previews of what is being drawn or placed, the
// measures beside the pointer, the snap and its label, the guides, the marks of the modify tools, and the
// drawing itself through app.plan.

import { calibrateDraft } from './reference-tool';
import { roomTagText } from '../app/room-tag';
import { overrideColours, roomOverrideColours, wallPhases } from '../project/layer-sets';
import { objectHandles } from '../session/object-handles';
import { angleNum, areaText, lengthNum, lengthText } from '../i18n/units';
import { distance } from '../model/vector';
import { MIN_WALL_LENGTH } from '../model/tolerance';
import { chainArea, chainLength, MEASURE_IDLE, reading } from '../elements/measure/tool';
import { guideLine, guideMeasure } from '../elements/guide/tool';
import { OPENING_PREVIEW_ID, ruleGuide } from '../elements/opening/aim';
import { name, t } from '../i18n/messages';
import { snapLabel } from '../session/snap-types';
import { drawingOf, levelOf, wallNumber } from '../project/doc';
import { type App, PREVIEW_ID } from '../session/app';
import { SNAP_OF } from '../session/snap-types';
import { bendMeasure, drawingEnd, previewWall, rectCorner, turnMeasure, wallTags } from '../elements/wall/tool-ui';
import { guideOffset } from '../elements/guide/tool-ui';
import { modifyMarks } from '../session/modify';
import { dimensionDraft, gridDraft } from '../session/annotation-tools';
import { sectionDraft } from '../session/section-tools';
import { currentDims } from './temp-dims';
import { syncScene } from '../session/scene-frame';
import * as appPlacing from '../session/app-placing';
import * as appView from '../session/app-view';
import { fromOf, pointsOf } from '../elements/tool-draft';
import { pointDraft, pointTool } from '../session/point-tools';
import { eventTool } from '../session/event-tools';
import { NO_LEVEL } from '../project/doc';

export function drawPlanOverlay(app: App): void {
  const { ui } = app;
  const guideFrom = fromOf(ui.draft, 'guide');
  const plan = ui.view === 'plan';
  const preview = new Set([...previewWall(app), ...appPlacing.previewOpening(app)].map((w) => w.id));
  const guide = app.openingKind() ? ruleGuide(app.store.get(), app.geometry, OPENING_PREVIEW_ID) : null;
  const w = ui.wall;
  const drawing = ui.tool === 'wall' && w.kind === 'drawing';
  const end = drawing ? drawingEnd(app) : null;
  const len = end && w.kind === 'drawing' ? distance(w.last, end) : 0;
  const ang = end && w.kind === 'drawing' ? ((Math.atan2(end.y - w.last.y, end.x - w.last.x) * 180) / Math.PI + 360) % 360 : 0;
  const along = end && w.kind === 'drawing' && len > 0 ? { x: (end.x - w.last.x) / len, y: (end.y - w.last.y) / len } : null;
  // A floor outline's side being drawn: from its last corner to where the next would snap.
  const floorFrom = ui.tool === 'floor' ? (pointsOf(ui.draft, 'floor').at(-1) ?? null) : null;
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
      ? { at: { x: m.points.reduce((t, p) => t + p.x, 0) / m.points.length, y: m.points.reduce((t, p) => t + p.y, 0) / m.points.length }, text: ((a) => (a === null ? t('meas.crosses') : areaText(a)))(chainArea(m.points)), clear: 0 }
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
  const guideOff = guideOffset(app);
  const marks = modifyMarks(app);
  // A rectangle being drawn: its sides, at its middle.
  const rc = ui.tool === 'wall' && w.kind === 'rect' ? rectCorner(app) : null;
  const rectMeasure =
    rc && w.kind === 'rect'
      ? { at: { x: (w.start.x + rc.x) / 2, y: (w.start.y + rc.y) / 2 }, text: `${lengthNum(Math.abs(rc.x - w.start.x))} × ${lengthText(Math.abs(rc.y - w.start.y))}`, clear: 0 }
      : null;
  const guideDim = ui.guide && guideOff !== null ? guideMeasure(ui.guide, guideOff) : null;
  // Where the tool snaps, its measure, the line being drawn and its draft: the same over the plan and the 3D.
  const snap =
    // Drawing, measuring, modifying, dividing, or dragging a wall's end: where it snaps, said as it is.
        (pointTool(app) || eventTool(app)?.snaps || ui.drag?.kind === 'grip') && ui.snap
          ? { point: ui.snap.point, kind: ui.snap.kind, label: lockLabel ?? (labelKey ? t(labelKey, { n: snapWall ?? '' }) : null), ...(ui.snap.guideFrom ? { guideFrom: ui.snap.guideFrom } : {}), ...((along ?? floorAlong) ? { away: (along ?? floorAlong)! } : {}) }
          : null;
  const measure = guideDim
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
              : (bendMeasure(app) ?? turnMeasure(app) ?? guide?.measure ?? null);
  const axis =
    end && len >= MIN_WALL_LENGTH && w.kind === 'drawing'
          ? { start: w.last, end }
          : tape && tapeFrom && tapeTo
            ? { start: tapeFrom, end: tapeTo }
            : marks?.to && !marks.axis
              ? { start: marks.base, end: marks.to }
              : null;
  const anchor = ui.tool === 'wall' && (w.kind === 'drawing' || w.kind === 'bend') ? w.last : (tapeFrom ?? marks?.base ?? null);
  // A floor's outline being drawn, or a beam from its first point to where the next click lands.
  const draft =
    chainLine && chainLine.length >= 2 ? chainLine : ui.tool === 'floor' && pointsOf(ui.draft, 'floor').length > 0 ? [...pointsOf(ui.draft, 'floor'), ...(floorTo ? [floorTo] : [])] : pointDraft(app);
  if (plan) {
    app.plan.drawing = appView.drawingNow(app);
    app.plan.overrides = ui.overridesOn ? overrideColours(app.store.get()) : new Map();
    app.plan.phases = ui.overridesOn ? wallPhases(app.store.get()) : new Map();
    app.plan.roomOverrides = ui.overridesOn ? roomOverrideColours(app.store.get()) : new Map();
    app.plan.draw(app.visibleGeometry(), {
      selected: ui.selection,
      hover: ui.hover,
      roomSpace: ui.tool === 'room' ? ui.roomSpace : m.kind === 'chainDone' && m.closed ? m.points : null,
      preview,
      dimensionDraft: dimensionDraft(app),
      gridDraft: gridDraft(app),
      sectionDraft: sectionDraft(app),
      calloutDraft: app.calloutDraft(),
      calibrateDraft: calibrateDraft(app),
      guideDraft: ui.guide && guideOff !== null ? guideLine(ui.guide, guideOff) : null,
      snap,
      measure,
      axis,
      axisLine: marks?.axis ?? null,
      refLines: app.refLines(),
      openingTags: app.openingTags(),
      ray: marks?.ref ? { start: marks.base, end: marks.ref } : null,
      handles: appView.handles(app),
      objectHandles: objectHandles(app),
      hotHandle: app.hotHandle,
      anchor,
      wallTags: wallTags(app),
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
      draft,
      draftCorners: ui.tool === 'floor' ? pointsOf(ui.draft, 'floor') : [],
      openingPreview: preview.has(OPENING_PREVIEW_ID) ? OPENING_PREVIEW_ID : null,
      // The opening being placed shows its distance as a dimension too (drawn only, not typed in: the
      // footer field takes the distance while placing).
      dims: [
        ...currentDims(app).map((d) => ({ ...d, text: lengthNum(d.value) })),
        ...(guide ? [guide.dim] : []),
        ...(guideDim && guideOff! > 0 ? [{ ...guideDim, side: ui.guide!.base.dir, clear: 0 }] : []),
      ],
      underlay: appView.underlay(app),
      acquired: ui.acquired,
      circleDraft:
        ui.tool === 'guide' && ui.guideMode === 'circle' && guideFrom && (ui.snap?.point ?? ui.cursor)
          ? { center: guideFrom, radius: distance(guideFrom, (ui.snap?.point ?? ui.cursor)!) }
          : null,
      smart: ui.smart && ui.drag?.kind === 'move' ? { lines: ui.smart.lines, gaps: ui.smart.gaps.map((g) => ({ ...g, text: lengthText(distance(g.a, g.b)) })) } : null,
    });
  } else {
    const shown = app.visibleGeometry();
    syncScene(app, preview, shown);
    app.cube.update(app.scene.camera);
    // Where the tool snaps and what it draws, over the 3D view as in plan.
    const level = levelOf(app.store.get(), ui.levelId) ?? NO_LEVEL;
    app.overlayState = {
      project: (p, z) => appView.projectAt(app, p, z),
      floor: level.elevation + appView.lift(app, ui.levelId),
      height: level.height,
      // The same as the plan's: one snap, measure, line and draft for both views. Kept twice, the 3D showed
      // the snap for four tools, no rectangle size and no guide or chain measure.
      snap,
      // A modify mark's line along an axis is drawn as its line in plan (axisLine); the 3D has only the one line.
      axis: axis ?? (marks?.to ? { start: marks.base, end: marks.to } : null),
      measure,
      anchor,
      draft,
      box: ui.view3d.box,
      boxHot: app.boxHot,
      objectHandles: objectHandles(app),
      hotHandle: app.hotHandle,
      handles: appView.handles(app),
    };
    app.overlay3d.draw(app.overlayState);
  }
}
