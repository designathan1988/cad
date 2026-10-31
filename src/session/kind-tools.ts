// The tools that place the registry's kinds (elements/registry.ts): guardrails, stairs, roofs, beams, columns, grid axes, dimensions, texts and level marks. Functions over the app (app.ts delegates).

import { kindOfKey, withList } from '../elements/registry';
import { freePlace, obstacleShapes, shapesOf } from '../elements/sat';
import { addObject } from '../elements/object/commands';
import { OBJECT_PREFIX, type ObjectInstance } from '../elements/object/schema';
import { words } from '../elements/object/fields';
import { distance, type Point2 } from '../model/vector';
import { MIN_WALL_LENGTH } from '../model/tolerance';
import { t } from '../i18n/messages';
import { addRailing } from '../elements/railing/commands';
import { type Railing, RAILING_PREFIX } from '../elements/railing/schema';
import { addStair } from '../elements/stair/commands';
import { type Stair, STAIR_PREFIX } from '../elements/stair/schema';
import { addRoof } from '../elements/roof/commands';
import { isConvex } from '../elements/roof/geometry';
import { edgesFor, type Roof, ROOF_GRADE, ROOF_OVERHANG, ROOF_PARAPET, ROOF_PREFIX, type RoofKind } from '../elements/roof/schema';
import { addBeam } from '../elements/beam/commands';
import { addSeparator } from '../elements/separator/commands';
import { addCurtain } from '../elements/curtain/commands';
import { type Curtain, CURTAIN_PREFIX } from '../elements/curtain/schema';
import { SEPARATOR_PREFIX } from '../elements/separator/schema';
import { type Beam, BEAM_PREFIX } from '../elements/beam/schema';
import { addColumn } from '../elements/column/commands';
import { type Column, COLUMN_PREFIX } from '../elements/column/schema';
import { addNote } from '../elements/note/commands';
import { LEVEL_MARK_HEIGHT, NOTE_HEIGHT, NOTE_PREFIX } from '../elements/note/schema';
import { newId } from '../core/id';
import { signedArea } from '../elements/room/derive';
import type { App } from './app';
import { made, nextOf } from './next';
import { setView } from './view-ui';
import * as appSettings from './app-settings';

/** A level mark where the menu was opened (or the middle of the view), selected: it says the level's height. */
export function addLevelMarkHere(app: App, at?: Point2): void {
  const p = at ?? app.plan.center;
  const id = newId(NOTE_PREFIX);
  app.store.dispatch(addNote({ id, levelId: app.ui.levelId, at: { x: p.x, y: p.y }, text: '', height: LEVEL_MARK_HEIGHT, elevation: { offset: 0 } }));
  if (app.ui.view !== 'plan') setView(app, 'plan');
  app.setTool('select');
  app.ui.selection = new Set([id]);
  appSettings.showProperties(app);
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
  if (app.ui.view !== 'plan') setView(app, 'plan');
  app.setTool('select');
  app.ui.selection = new Set([id]);
  appSettings.showProperties(app);
  app.refresh();
  // Its text selected in the panel: typing replaces the placeholder.
  const field = [...app.shell.panel.querySelectorAll<HTMLInputElement>('input[type="text"]')][0];
  field?.focus();
  field?.select();
}

/** The guardrail tool: a click adds a point of its path; Enter, Esc or a click on the last point ends it. */
export function railingClick(app: App, p: Point2, mpp: number): void {
  const draft = app.ui.railingDraft;
  if (draft.length >= 2 && distance(p, draft.at(-1)!) <= 10 * mpp) return railingFinish(app);
  if (draft.length > 0 && distance(p, draft.at(-1)!) < MIN_WALL_LENGTH) return;
  app.ui.railingDraft = [...draft, p];
  app.render();
}

export function railingFinish(app: App): void {
  const points = app.ui.railingDraft;
  app.ui.railingDraft = [];
  if (points.length < 2) return app.render();
  const id = newId(RAILING_PREFIX);
  // As the next guardrail is set (next-element.ts): the last one made, else balusters, as the norm asks of an opening (railingGap).
  app.store.dispatch(addRailing(made<Railing>(app, 'railings', { id, points })));
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
  const id = newId(STAIR_PREFIX);
  app.store.dispatch(addStair(made<Stair>(app, 'stairs', { id, at: from, angle: Math.atan2(p.y - from.y, p.x - from.x) })));
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
  if (draft.length >= 3 && distance(p, draft[0]!) <= 10 * mpp) return roofFinish(app);
  app.ui.roofDraft = [...draft, p];
  app.render();
}

export function roofFinish(app: App): void {
  const raw = app.ui.roofDraft;
  app.ui.roofDraft = [];
  if (raw.length < 3) return app.render();
  // Counter-clockwise, so side i runs from corner i to corner i + 1 as roof/geometry.ts reads them.
  const outline = signedArea(raw) < 0 ? [...raw].reverse() : raw;
  const id = newId(ROOF_PREFIX);
  // The next roof's (next-element.ts) form, grade, overhang, thickness and covering (a model from the store
  // sets them); a sloped form only over a convex outline, flat otherwise.
  const next = nextOf(app, 'roofs') as unknown as Roof;
  // Hipped unless a form was chosen for the next roof (a flat roof made last does not make the next flat).
  const chosen = (app.next.roofs as Roof | undefined)?.kind ?? 'hip';
  const kind: RoofKind = isConvex(outline) ? chosen : 'flat';
  const edge = next.edges.find((e) => e.grade !== null) ?? next.edges[0];
  const { parapet: _p, ...rest } = made<Roof>(app, 'roofs', { id, outline, kind, edges: edgesFor(kind, outline, edge?.grade ?? ROOF_GRADE, edge?.overhang ?? ROOF_OVERHANG) });
  app.store.dispatch(addRoof(kind === 'flat' ? { ...rest, parapet: next.parapet ?? ROOF_PARAPET } : rest));
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
  app.store.dispatch(addBeam(made<Beam>(app, 'beams', { id: newId(BEAM_PREFIX), start: from, end: p })));
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
  app.store.dispatch(addCurtain(made<Curtain>(app, 'curtains', { id: newId(CURTAIN_PREFIX), start: from, end: p })));
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
  // Its type, elevation and parameters as the next object is set (next-element.ts), turned as the tool is.
  let o = made<ObjectInstance>(app, 'objects', { id: newId(OBJECT_PREFIX), at: { x: p.x, y: p.y }, angle: app.ui.objectAngle });
  // With collisions on, not into a wall or another object: moved to the nearest clear place, not below its floor.
  if (app.ui.collisions) {
    o = { ...o, elevation: Math.max(0, o.elevation) };
    const kind = kindOfKey('objects');
    const solid = kind.derive(withList(doc, kind, [...doc.objects, o]), o, app.geometry);
    if (solid && kind.span) {
      const shapes = shapesOf(kind.outlines(solid), kind.span(solid));
      const d = freePlace(shapes, obstacleShapes(app.geometry, o.levelId, new Set()));
      o = { ...o, at: { x: o.at.x + d.x, y: o.at.y + d.y } };
    }
  }
  app.store.dispatch(addObject(o));
  app.ui.info = t('hint.objectMade', { name: words(def.name) });
  app.render();
}

/** The column tool: a click stands a column there, the section of the last one made. */
export function columnClick(app: App, p: Point2): void {
  const id = newId(COLUMN_PREFIX);
  app.store.dispatch(addColumn(made<Column>(app, 'columns', { id, at: { x: p.x, y: p.y } })));
  app.ui.info = t('hint.columnMade');
  app.render();
}
