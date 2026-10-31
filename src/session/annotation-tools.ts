// The annotation tools: grid axes, dimensions and level or opening marks.

import type { App } from './app';
import { distance, type Point2 } from '../model/vector';
import { MIN_WALL_LENGTH } from '../model/tolerance';
import { newGridId, nextGridName, type Grid } from '../elements/grid/schema';
import { addGrid } from '../elements/grid/commands';
import { t } from '../i18n/messages';
import { solidsOf } from '../elements/registry';
import { gridKind } from '../elements/kinds/grid';
import { DIMENSION_IDLE, type DimensionToolEvent, dimensionTransition } from '../tools/dimension-tool';
import { newDimensionId, type Dimension } from '../elements/dimension/schema';
import { anchorAt, offsetThrough, placeDimension } from '../elements/dimension/anchor';
import { addDimension } from '../elements/dimension/commands';
import type { PlanOverlay } from '../render/plan-types';
import { lengthNum } from '../i18n/units';
import { arcWallAt } from '../elements/measure/place';
import { addMeasure } from '../elements/measure/commands';
import { newMeasureId } from '../elements/measure/schema';
import { NO_LEVEL } from '../project/doc';
import { DRAFT_DIMENSION_ID } from '../elements/dimension/schema';
import { drawFrom, drawPoints, fromOf, pointsOf } from '../elements/tool-draft';

/** The grid tool: a click starts an axis, the next ends it (named on from the last of its kind). */
export function gridClick(app: App, p: Point2): void {
  const from = fromOf(app.ui.draft, 'grid');
  if (!from) {
    app.ui.draft = drawFrom('grid', p);
    return app.render();
  }
  if (distance(from, p) < MIN_WALL_LENGTH) return;
  const doc = app.store.get();
  const name = nextGridName(doc.grids, from, p);
  app.store.dispatch(addGrid({ id: newGridId(), name, start: from, end: p }));
  app.ui.draft = drawFrom('grid', null);
  app.ui.info = t('hint.gridMade', { name });
  app.render();
}

/** Esc in the grid tool: the axis begun is dropped; none begun, the tool is left. */
export function gridEscape(app: App): void {
  if (fromOf(app.ui.draft, 'grid')) {
    app.ui.draft = drawFrom('grid', null);
    return app.render();
  }
  app.setTool('select');
}

/** The axis being drawn with the grid tool, and the name it will get; plan only. */
export function gridDraft(app: App): { name: string; start: Point2; end: Point2 } | null {
  const from = app.ui.view === 'plan' && app.ui.tool === 'grid' ? fromOf(app.ui.draft, 'grid') : null;
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
      id: newDimensionId(),
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
  const p = placeDimension(app.store.get(), app.geometry, { id: DRAFT_DIMENSION_ID, levelId: NO_LEVEL, a: { kind: 'point', at: a }, b: { kind: 'point', at: b }, offset });
  return p ? { ...p, text: lengthNum(p.length) } : null;
}

/**
 * The measure tool. An angle: the vertex, a point on one arm, a point on the other; its arc at half the
 * shorter arm. An arc wall: a click on it, at the line nearest the click (its faces or its reference line).
 * A coordinate: the point, then where its text goes.
 */
export function markClick(app: App, p: Point2): void {
  const ui = app.ui;
  const done = (key: 'hint.markMade') => {
    ui.draft = drawPoints(ui.draft, 'mark', []);
    ui.info = t(key);
    app.render();
  };
  if (ui.markMode === 'radius') {
    const hit = arcWallAt(app.store.get(), ui.levelId, p, 8 / app.plan.scale);
    if (!hit) {
      ui.info = t('hint.markNoArc');
      return app.render();
    }
    app.store.dispatch(addMeasure({ id: newMeasureId(), levelId: ui.levelId, type: 'radius', ...hit }));
    return done('hint.markMade');
  }
  const draft = [...pointsOf(ui.draft, 'mark'), p];
  if (draft.length >= 2 && distance(draft.at(-1)!, draft.at(-2)!) < MIN_WALL_LENGTH) return;
  if (ui.markMode === 'coord') {
    if (draft.length < 2) {
      ui.draft = drawPoints(ui.draft, 'mark', draft);
      return app.render();
    }
    app.store.dispatch(addMeasure({ id: newMeasureId(), levelId: ui.levelId, type: 'coord', at: draft[0]!, label: draft[1]! }));
    return done('hint.markMade');
  }
  if (draft.length < 3) {
    ui.draft = drawPoints(ui.draft, 'mark', draft);
    return app.render();
  }
  const [vertex, a, b] = draft as [Point2, Point2, Point2];
  if (distance(vertex, b) < MIN_WALL_LENGTH) return;
  const radius = Math.max(0.3, Math.min(distance(vertex, a), distance(vertex, b)) / 2);
  app.store.dispatch(addMeasure({ id: newMeasureId(), levelId: ui.levelId, type: 'angle', vertex, a, b, radius }));
  done('hint.markMade');
}
