// The tools that place the registry's kinds (elements/registry.ts): guardrails, stairs, roofs, beams, columns, grid axes, dimensions, texts and level marks. Functions over the app (app.ts delegates).

import { addSections } from '../elements/section/commands';
import { boundsOf, deriveGeometry } from './geometry';
import { DEPTH_MAX, elevationsAround, lookOf, nextSectionName, SECTION_PREFIX, type SectionMark } from '../elements/section/schema';
import { addObject } from '../elements/object/commands';
import { OBJECT_PREFIX } from '../elements/object/schema';
import { words } from '../elements/object/fields';
import { lengthNum } from '../ui/units';
import { distance, type Point2 } from '../core/vector';
import { MIN_WALL_LENGTH } from '../core/tolerance';
import { type PlanOverlay } from '../render/plan-view';
import { t } from '../ui/i18n';
import { solidsOf } from '../elements/registry';
import { gridKind } from '../elements/kinds/grid';
import { addRailing } from '../elements/railing/commands';
import { RAILING_HEIGHT, RAILING_PREFIX } from '../elements/railing/schema';
import { addStair } from '../elements/stair/commands';
import { STAIR_PREFIX, STAIR_TREAD, STAIR_WIDTH } from '../elements/stair/schema';
import { addRoof } from '../elements/roof/commands';
import { isConvex } from '../elements/roof/geometry';
import { edgesFor, ROOF_GRADE, ROOF_OVERHANG, ROOF_PARAPET, ROOF_PREFIX, ROOF_THICKNESS, type RoofKind } from '../elements/roof/schema';
import { addBeam } from '../elements/beam/commands';
import { addSeparator } from '../elements/separator/commands';
import { addCurtain } from '../elements/curtain/commands';
import { CURTAIN_DEFAULTS, CURTAIN_PREFIX } from '../elements/curtain/schema';
import { SEPARATOR_PREFIX } from '../elements/separator/schema';
import { BEAM_DEPTH, BEAM_PREFIX, BEAM_WIDTH } from '../elements/beam/schema';
import { addColumn } from '../elements/column/commands';
import { COLUMN_PREFIX, COLUMN_SIZE } from '../elements/column/schema';
import { addNote } from '../elements/note/commands';
import { addDimension } from '../elements/dimension/commands';
import { anchorAt, offsetThrough, placeDimension } from '../elements/dimension/anchor';
import { DIM_PREFIX, type Dimension } from '../elements/dimension/schema';
import { addGrid } from '../elements/grid/commands';
import { GRID_PREFIX, type Grid, nextGridName } from '../elements/grid/schema';
import { DIMENSION_IDLE, type DimensionToolEvent, dimensionTransition } from '../tools/dimension-tool';
import { LEVEL_MARK_HEIGHT, NOTE_HEIGHT, NOTE_PREFIX } from '../elements/note/schema';
import { newId } from '../core/id';
import { signedArea } from '../elements/room/derive';
import type { App } from './app';

/** A level mark where the menu was opened (or the middle of the view), selected: it says the level's height. */
export function addLevelMarkHere(app: App, at?: Point2): void {
  const p = at ?? app.plan.center;
  const id = newId(NOTE_PREFIX);
  app.store.dispatch(addNote({ id, levelId: app.ui.levelId, at: { x: p.x, y: p.y }, text: '', height: LEVEL_MARK_HEIGHT, elevation: { offset: 0 } }));
  if (app.ui.view !== 'plan') app.setView('plan');
  app.setTool('select');
  app.ui.selection = new Set([id]);
  app.showProperties();
  app.refresh();
  // Its adjustment ready to type: a step down or up from the level.
  const field = app.shell.panel.querySelector<HTMLInputElement>('input');
  field?.focus();
  field?.select();
}

/** A text note where the menu was opened (or the middle of the view), selected, its text ready to type in the panel. */
export function addNoteHere(app: App, at?: Point2, leader?: Point2): void {
  const p = at ?? app.plan.center;
  const id = newId(NOTE_PREFIX);
  app.store.dispatch(addNote({ id, levelId: app.ui.levelId, at: { x: p.x, y: p.y }, text: t('note.default'), height: NOTE_HEIGHT, ...(leader ? { leader: { x: leader.x, y: leader.y } } : {}) }));
  if (app.ui.view !== 'plan') app.setView('plan');
  app.setTool('select');
  app.ui.selection = new Set([id]);
  app.showProperties();
  app.refresh();
  // Its text selected in the panel: typing replaces the placeholder.
  const field = [...app.shell.panel.querySelectorAll<HTMLInputElement>('input[type="text"]')][0];
  field?.focus();
  field?.select();
}

/** The guardrail tool: a click adds a point of its path; Enter, Esc or a click on the last point ends it. */
export function railingClick(app: App, p: Point2, mpp: number): void {
  const draft = app.ui.railingDraft;
  if (draft.length >= 2 && distance(p, draft.at(-1)!) <= 10 * mpp) return app.railingFinish();
  if (draft.length > 0 && distance(p, draft.at(-1)!) < MIN_WALL_LENGTH) return;
  app.ui.railingDraft = [...draft, p];
  app.render();
}

export function railingFinish(app: App): void {
  const points = app.ui.railingDraft;
  app.ui.railingDraft = [];
  if (points.length < 2) return app.render();
  const last = app.store.get().railings.at(-1);
  const id = newId(RAILING_PREFIX);
  // Like the last one made; balusters at first, as the norm asks of an opening (railingGap).
  app.store.dispatch(addRailing({ id, levelId: app.ui.levelId, points, height: last?.height ?? RAILING_HEIGHT, baseOffset: 0, infill: last?.infill ?? 'balusters' }));
  app.ui.info = t('hint.railingMade');
  app.render();
}

/**
 * The stair tool: a click on where its first step's front is (its middle), the next on the way it
 * climbs. Straight, of the last stair's width and step; its kind and turn are in the panel.
 */
export function stairClick(app: App, p: Point2): void {
  const from = app.ui.stairFrom;
  if (!from) {
    app.ui.stairFrom = p;
    return app.render();
  }
  if (distance(from, p) < 0.05) return;
  const last = app.store.get().stairs.at(-1);
  const id = newId(STAIR_PREFIX);
  app.store.dispatch(
    addStair({
      id,
      levelId: app.ui.levelId,
      kind: last?.kind ?? 'straight',
      at: from,
      angle: Math.atan2(p.y - from.y, p.x - from.x),
      width: last?.width ?? STAIR_WIDTH,
      tread: last?.tread ?? STAIR_TREAD,
      turn: last?.turn ?? 'left',
    }),
  );
  app.setTool('select');
  app.ui.selection = new Set([id]);
  app.ui.info = t('hint.stairMade');
  app.refresh();
}

/**
 * The roof tool: a click adds a corner of its outline; on the first corner again (10 px), or Enter, the
 * roof is made: four slopes on a convex outline, flat with a parapet otherwise.
 */
export function roofClick(app: App, p: Point2, mpp: number): void {
  const draft = app.ui.roofDraft;
  if (draft.length >= 3 && distance(p, draft[0]!) <= 10 * mpp) return app.roofFinish();
  app.ui.roofDraft = [...draft, p];
  app.render();
}

export function roofFinish(app: App): void {
  const raw = app.ui.roofDraft;
  app.ui.roofDraft = [];
  if (raw.length < 3) return app.render();
  // Counter-clockwise, so side i runs from corner i to corner i + 1 as roof/geometry.ts reads them.
  const outline = signedArea(raw) < 0 ? [...raw].reverse() : raw;
  const kind: RoofKind = isConvex(outline) ? 'hip' : 'flat';
  const id = newId(ROOF_PREFIX);
  app.store.dispatch(
    addRoof({ id, levelId: app.ui.levelId, outline, edges: edgesFor(kind, outline, ROOF_GRADE, ROOF_OVERHANG), kind, thickness: ROOF_THICKNESS, baseOffset: 0, ...(kind === 'flat' ? { parapet: ROOF_PARAPET } : {}) }),
  );
  app.setTool('select');
  app.ui.selection = new Set([id]);
  app.ui.info = t(kind === 'hip' ? 'hint.roofMade' : 'hint.roofFlat');
  app.refresh();
}

/** The beam tool: a click starts a beam, the next ends it (the section of the last one made); Esc drops it. */
export function beamClick(app: App, p: Point2): void {
  const from = app.ui.beamFrom;
  if (!from) {
    app.ui.beamFrom = p;
    return app.render();
  }
  if (distance(from, p) < MIN_WALL_LENGTH) return;
  const last = app.store.get().beams.at(-1);
  app.store.dispatch(addBeam({ id: newId(BEAM_PREFIX), levelId: app.ui.levelId, start: from, end: p, width: last?.width ?? BEAM_WIDTH, depth: last?.depth ?? BEAM_DEPTH }));
  // On from its end, as walls are drawn in a chain.
  app.ui.beamFrom = p;
  app.ui.info = t('hint.beamMade');
  app.render();
}

/** The separator tool: a click starts a line bounding rooms, the next ends it and goes on from there. */
export function separatorClick(app: App, p: Point2): void {
  const from = app.ui.beamFrom;
  if (!from) {
    app.ui.beamFrom = p;
    return app.render();
  }
  if (distance(from, p) < MIN_WALL_LENGTH) return;
  app.store.dispatch(addSeparator({ id: newId(SEPARATOR_PREFIX), levelId: app.ui.levelId, start: from, end: p }));
  app.ui.beamFrom = p;
  app.ui.info = t('hint.separatorMade');
  app.render();
}

/** The curtain wall tool: a click starts it, the next ends it and goes on from there, as walls chain. */
export function curtainClick(app: App, p: Point2): void {
  const from = app.ui.beamFrom;
  if (!from) {
    app.ui.beamFrom = p;
    return app.render();
  }
  if (distance(from, p) < MIN_WALL_LENGTH) return;
  app.store.dispatch(addCurtain({ id: newId(CURTAIN_PREFIX), levelId: app.ui.levelId, start: from, end: p, ...CURTAIN_DEFAULTS }));
  app.ui.beamFrom = p;
  app.ui.info = t('hint.curtainMade');
  app.render();
}

/** The object tool's preview: drawn as an object, never kept. */
export const OBJECT_PREVIEW = `${OBJECT_PREFIX}_preview`;

/** The object tool: a click places the chosen definition's first type there, turned as the tool is. */
export function objectClick(app: App, p: Point2): void {
  const doc = app.store.get();
  const def = doc.definitions.find((d) => d.id === app.ui.objectDef);
  if (!def) return;
  app.store.dispatch(addObject({ id: newId(OBJECT_PREFIX), levelId: app.ui.levelId, definitionId: def.id, typeId: def.types[0]!.id, at: { x: p.x, y: p.y }, angle: app.ui.objectAngle, elevation: 0, values: {} }));
  app.ui.info = t('hint.objectMade', { name: words(def.name) });
  app.render();
}

/** The column tool: a click stands a column there, the section of the last one made. */
export function columnClick(app: App, p: Point2): void {
  const last = app.store.get().columns.at(-1);
  const id = newId(COLUMN_PREFIX);
  app.store.dispatch(
    addColumn({ id, levelId: app.ui.levelId, at: { x: p.x, y: p.y }, width: last?.width ?? COLUMN_SIZE, depth: last?.depth ?? COLUMN_SIZE, angle: last?.angle ?? 0 }),
  );
  app.ui.info = t('hint.columnMade');
  app.render();
}

/** The grid tool: a click starts an axis, the next ends it (named on from the last of its kind). */
export function gridClick(app: App, p: Point2): void {
  const from = app.ui.gridFrom;
  if (!from) {
    app.ui.gridFrom = p;
    return app.render();
  }
  if (distance(from, p) < MIN_WALL_LENGTH) return;
  const doc = app.store.get();
  const name = nextGridName(doc.grids, from, p);
  app.store.dispatch(addGrid({ id: newId(GRID_PREFIX), name, start: from, end: p }));
  app.ui.gridFrom = null;
  app.ui.info = t('hint.gridMade', { name });
  app.render();
}

/** Esc in the grid tool: the axis begun is dropped; none begun, the tool is left. */
export function gridEscape(app: App): void {
  if (app.ui.gridFrom) {
    app.ui.gridFrom = null;
    return app.render();
  }
  app.setTool('select');
}

/** How deep a new section sees: the far side of the model from its line, and a metre past it; 10 m with nothing. */
function depthFrom(app: App, start: Point2, end: Point2): number {
  const box = boundsOf(app.geometry);
  if (!box) return 10;
  const look = lookOf({ start, end });
  const corners = [box.min, box.max, { x: box.min.x, y: box.max.y }, { x: box.max.x, y: box.min.y }];
  const far = Math.max(...corners.map((c) => (c.x - start.x) * look.x + (c.y - start.y) * look.y));
  return Math.min(DEPTH_MAX, Math.max(1, far + 1));
}

/** The section tool: a click starts its line, the next ends it; it looks to the line's left. */
export function sectionClick(app: App, p: Point2): void {
  const from = app.ui.sectionFrom;
  if (!from) {
    app.ui.sectionFrom = p;
    return app.render();
  }
  if (distance(from, p) < MIN_WALL_LENGTH) return;
  const doc = app.store.get();
  const mark: SectionMark = { id: newId(SECTION_PREFIX), name: nextSectionName(doc.sections), kind: 'section', start: from, end: p, depth: depthFrom(app, from, p) };
  app.store.dispatch(addSections([mark]));
  app.ui.sectionFrom = null;
  app.ui.info = t('hint.sectionMade', { name: mark.name });
  app.render();
}

/** The callout tool: a click puts the arrow's point; the next puts the text there, selected to type. */
export function calloutClick(app: App, p: Point2): void {
  const from = app.ui.calloutFrom;
  if (!from) {
    app.ui.calloutFrom = p;
    return app.render();
  }
  if (distance(from, p) < MIN_WALL_LENGTH) return;
  app.ui.calloutFrom = null;
  addNoteHere(app, p, from);
}

/** Esc in the section tool: the line begun is dropped; none begun, the tool is left. */
export function sectionEscape(app: App): void {
  if (app.ui.sectionFrom) {
    app.ui.sectionFrom = null;
    return app.render();
  }
  app.setTool('select');
}

/** The section being drawn with its tool; plan only. */
export function sectionDraft(app: App): SectionMark | null {
  const from = app.ui.view === 'plan' && app.ui.tool === 'section' ? app.ui.sectionFrom : null;
  const to = app.ui.snap?.point ?? app.ui.cursor;
  return from && to && distance(from, to) > 0 ? { id: '', name: nextSectionName(app.store.get().sections), kind: 'section', start: from, end: to, depth: 1 } : null;
}

/** The four elevations round the whole model, 3 m out: those whose side has none yet. */
export function addElevations(app: App): void {
  const doc = app.store.get();
  const box = boundsOf(deriveGeometry(doc));
  if (!box) {
    app.toast(t('section.nothing'));
    return;
  }
  const have = new Set(doc.sections.filter((m) => m.kind === 'elevation').map((m) => m.name));
  const marks = elevationsAround(box, 3)
    .map((e): SectionMark => ({ id: newId(SECTION_PREFIX), name: t(`section.side.${e.side}`), kind: 'elevation', start: e.start, end: e.end, depth: e.depth }))
    .filter((m) => !have.has(m.name));
  if (marks.length === 0) {
    app.toast(t('section.allMade'));
    return;
  }
  app.store.dispatch(addSections(marks));
  app.toast(t('section.elevationsMade', { n: marks.length }));
}

/** The axis being drawn with the grid tool, and the name it will get; plan only. */
export function gridDraft(app: App): { name: string; start: Point2; end: Point2 } | null {
  const from = app.ui.view === 'plan' && app.ui.tool === 'grid' ? app.ui.gridFrom : null;
  const to = app.ui.snap?.point ?? app.ui.cursor;
  return from && to && distance(from, to) > 0 ? { name: nextGridName(app.store.get().grids, from, to), start: from, end: to } : null;
}

/** The axes as drawn now (a move being dragged or the Modify tool taking them): what snapping sees; plan only. */
export function shownGrids(app: App): readonly Grid[] {
  return app.ui.view === 'plan' ? solidsOf<Grid>(app.visibleGeometry().kinds, gridKind) : [];
}

/** The dimension tool: a click or Esc (dimension-tool.ts). The third click makes the dimension. */
export function dimensionEvent(app: App, event: DimensionToolEvent): void {
  const r = dimensionTransition(app.ui.dimension, event);
  app.ui.dimension = r.state;
  app.shell.measure.value = '';
  if (r.make) {
    const doc = app.store.get();
    const g = app.visibleGeometry();
    const dim: Dimension = {
      id: newId(DIM_PREFIX),
      levelId: app.ui.levelId,
      a: anchorAt(doc, g, app.ui.levelId, r.make.a),
      b: anchorAt(doc, g, app.ui.levelId, r.make.b),
      offset: offsetThrough(r.make.a, r.make.b, r.make.through),
    };
    app.store.dispatch(addDimension(dim));
    app.ui.info = t('hint.dimensionMade');
  }
  app.render();
}

/** The dimension being made with the dimension tool, placed, with its value; plan only. */
export function dimensionDraft(app: App): (NonNullable<PlanOverlay['dimensionDraft']>) | null {
  const s = app.ui.view === 'plan' && app.ui.tool === 'dimension' ? app.ui.dimension : DIMENSION_IDLE;
  const at = app.ui.snap?.point ?? app.ui.cursor;
  if (s.kind === 'idle' || !at) return null;
  const a = s.a;
  const b = s.kind === 'placing' ? s.b : at;
  const offset = s.kind === 'placing' ? offsetThrough(a, b, at) : 0;
  const p = placeDimension(app.store.get(), app.geometry, { id: '', levelId: '', a: { kind: 'point', at: a }, b: { kind: 'point', at: b }, offset });
  return p ? { ...p, text: lengthNum(p.length) } : null;
}
