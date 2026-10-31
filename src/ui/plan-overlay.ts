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
import { cutAt } from '../session/view/view-3d';
import { type App, PREVIEW_ID, SNAP_OF } from '../session/app';
import { bendMeasure, drawingEnd, previewWall, rectCorner, turnMeasure, wallTags } from '../elements/wall/tool-ui';
import { guideOffset } from '../elements/guide/tool-ui';
import { modifyMarks } from '../session/modify';
import { dimensionDraft, gridDraft } from '../session/annotation-tools';
import { sectionDraft } from '../session/section-tools';
import { currentDims } from './temp-dims';

export function drawPlanOverlay(app: App): void {
  const { ui } = app;
  const plan = ui.view === 'plan';
  const preview = new Set([...previewWall(app), ...app.previewOpening()].map((w) => w.id));
  const guide = app.openingKind() ? ruleGuide(app.store.get(), app.geometry, OPENING_PREVIEW_ID) : null;
  const w = ui.wall;
  const drawing = ui.tool === 'wall' && w.kind === 'drawing';
  const end = drawing ? drawingEnd(app) : null;
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
  const guideOff = guideOffset(app);
  const marks = modifyMarks(app);
  // A rectangle being drawn: its sides, at its middle.
  const rc = ui.tool === 'wall' && w.kind === 'rect' ? rectCorner(app) : null;
  const rectMeasure =
    rc && w.kind === 'rect'
      ? { at: { x: (w.start.x + rc.x) / 2, y: (w.start.y + rc.y) / 2 }, text: `${lengthNum(Math.abs(rc.x - w.start.x))} × ${lengthText(Math.abs(rc.y - w.start.y))}`, clear: 0 }
      : null;
  const guideDim = ui.guide && guideOff !== null ? guideMeasure(ui.guide, guideOff) : null;
  if (plan) {
    app.plan.drawing = app.drawingNow();
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
      snap:
        // Drawing, measuring, modifying, dividing, or dragging a wall's end: where it snaps, said as it is.
        (ui.tool === 'wall' || ui.tool === 'guide' || ui.tool === 'floor' || ui.tool === 'measure' || ui.tool === 'dimension' || ui.tool === 'grid' || ui.tool === 'section' || ui.tool === 'callout' || ui.tool === 'calibrate' || ui.tool === 'column' || ui.tool === 'beam' || ui.tool === 'separator' || ui.tool === 'mark' || ui.tool === 'curtain' || ui.tool === 'roof' || ui.tool === 'stair' || ui.tool === 'railing' || ui.tool === 'modify' || ui.tool === 'split' || ui.drag?.kind === 'grip') && ui.snap
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
              : (bendMeasure(app) ?? turnMeasure(app) ?? guide?.measure ?? null),
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
      ray: marks?.ref ? { start: marks.base, end: marks.ref } : null,
      handles: app.handles(),
      objectHandles: objectHandles(app),
      hotHandle: app.hotHandle,
      anchor: ui.tool === 'wall' && (w.kind === 'drawing' || w.kind === 'bend') ? w.last : (tapeFrom ?? marks?.base ?? null),
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
      // A floor's outline being drawn, or a beam from its first point to where the next click lands.
      draft:
        chainLine && chainLine.length >= 2
          ? chainLine
          : ui.tool === 'guide' && ui.guideFrom && (ui.snap?.point ?? ui.cursor)
            ? [ui.guideFrom, (ui.snap?.point ?? ui.cursor)!]
          : ui.tool === 'floor' && ui.floorDraft.length > 0
          ? [...ui.floorDraft, ...(floorTo ? [floorTo] : [])]
          : ui.tool === 'mark' && ui.markDraft.length > 0 && (ui.snap?.point ?? ui.cursor)
            ? ui.markDraft.length === 2 && ui.markMode === 'angle'
              ? [ui.markDraft[1]!, ui.markDraft[0]!, (ui.snap?.point ?? ui.cursor)!]
              : [ui.markDraft[0]!, (ui.snap?.point ?? ui.cursor)!]
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
        ...currentDims(app).map((d) => ({ ...d, text: lengthNum(d.value) })),
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
  } else {
    const shown = app.visibleGeometry();
    app.scene.setXray(ui.view3d.xray);
    // A renovation's walls by phase, as the plan draws them while the overrides are on.
    const css = getComputedStyle(document.documentElement);
    app.scene.setPhases(ui.overridesOn ? wallPhases(app.store.get()) : new Map(), (p) => css.getPropertyValue(`--phase-${p}`).trim());
    app.scene.setOpened(ui.opened);
    app.scene.setBox(ui.view3d.box);
    app.scene.setOrtho(ui.view3d.ortho);
    app.scene.setLook(ui.view3d.style, ui.view3d.quality);
    app.scene.setLight(ui.view3d.brightness, ui.view3d.sun);
    app.scene.setSection(ui.view3d.section);
    app.scene.sync(shown, ui.selection, preview, (id) => app.lift(id));
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
              : bendMeasure(app),
      anchor: ui.tool === 'wall' && (w.kind === 'drawing' || w.kind === 'bend') ? w.last : (tapeFrom ?? marks?.base ?? null),
      // A floor's outline being drawn, or a beam from its first point to where the next click lands.
      draft:
        chainLine && chainLine.length >= 2
          ? chainLine
          : ui.tool === 'guide' && ui.guideFrom && (ui.snap?.point ?? ui.cursor)
            ? [ui.guideFrom, (ui.snap?.point ?? ui.cursor)!]
          : ui.tool === 'floor' && ui.floorDraft.length > 0
          ? [...ui.floorDraft, ...(floorTo ? [floorTo] : [])]
          : ui.tool === 'mark' && ui.markDraft.length > 0 && (ui.snap?.point ?? ui.cursor)
            ? ui.markDraft.length === 2 && ui.markMode === 'angle'
              ? [ui.markDraft[1]!, ui.markDraft[0]!, (ui.snap?.point ?? ui.cursor)!]
              : [ui.markDraft[0]!, (ui.snap?.point ?? ui.cursor)!]
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
      objectHandles: objectHandles(app),
      hotHandle: app.hotHandle,
      handles: app.handles(),
    };
    app.overlay3d.draw(app.overlayState);
  }
}
