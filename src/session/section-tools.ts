// The section, callout and elevation tools: two clicks make a mark; the elevations of the building or of
// a room are added in one go.

import type { App } from './app';
import { distance, type Point2 } from '../model/vector';
import { boundsOf } from '../project/derived-queries';
import { DEPTH_MAX, elevationsAround, elevationsInside, lookOf, newSectionId, nextSectionName, type SectionMark } from '../elements/section/schema';
import { MIN_WALL_LENGTH } from '../model/tolerance';
import { addSections } from '../elements/section/commands';
import { t } from '../i18n/messages';
import { addNoteHere } from './kind-tools';
import { deriveGeometry } from '../project/derive';
import { roomOf } from '../project/derived-queries';
import { DRAFT_SECTION_ID } from '../elements/section/schema';
import { drawFrom, fromOf } from '../elements/tool-draft';
import { inEveryLanguage } from '../i18n/messages';

/** How deep a new section sees: the far side of the model from its line, and a metre past it; 10 m with nothing. */
export function depthFrom(app: App, start: Point2, end: Point2): number {
  const box = boundsOf(app.geometry);
  if (!box) return 10;
  const look = lookOf({ start, end });
  const corners = [box.min, box.max, { x: box.min.x, y: box.max.y }, { x: box.max.x, y: box.min.y }];
  const far = Math.max(...corners.map((c) => (c.x - start.x) * look.x + (c.y - start.y) * look.y));
  return Math.min(DEPTH_MAX, Math.max(1, far + 1));
}

/** The section tool: a click starts its line, the next ends it; it looks to the line's left. */
export function sectionClick(app: App, p: Point2): void {
  const from = fromOf(app.ui.draft, 'section');
  if (!from) {
    app.ui.draft = drawFrom('section', p);
    return app.render();
  }
  if (distance(from, p) < MIN_WALL_LENGTH) return;
  const doc = app.store.get();
  const mark: SectionMark = { id: newSectionId(), name: nextSectionName(doc.sections), kind: 'section', start: from, end: p, depth: depthFrom(app, from, p) };
  app.store.dispatch(addSections([mark]));
  app.ui.draft = drawFrom('section', null);
  app.ui.info = t('hint.sectionMade', { name: mark.name });
  app.render();
}

/** The callout tool: a click puts the arrow's point; the next puts the text there, selected to type. */
export function calloutClick(app: App, p: Point2): void {
  const from = fromOf(app.ui.draft, 'callout');
  if (!from) {
    app.ui.draft = drawFrom('callout', p);
    return app.render();
  }
  if (distance(from, p) < MIN_WALL_LENGTH) return;
  app.ui.draft = drawFrom('callout', null);
  addNoteHere(app, p, from);
}

/** Esc in the section tool: the line begun is dropped; none begun, the tool is left. */
export function sectionEscape(app: App): void {
  if (fromOf(app.ui.draft, 'section')) {
    app.ui.draft = drawFrom('section', null);
    return app.render();
  }
  app.setTool('select');
}

/** The section being drawn with its tool; plan only. */
export function sectionDraft(app: App): SectionMark | null {
  const from = app.ui.view === 'plan' && app.ui.tool === 'section' ? fromOf(app.ui.draft, 'section') : null;
  const to = app.ui.snap?.point ?? app.ui.cursor;
  return from && to && distance(from, to) > 0 ? { id: DRAFT_SECTION_ID, name: nextSectionName(app.store.get().sections), kind: 'section', start: from, end: to, depth: 1 } : null;
}

/** The four elevations round the whole model, 3 m out: those whose side has none yet. */
export function addElevations(app: App): void {
  const doc = app.store.get();
  const box = boundsOf(deriveGeometry(doc));
  if (!box) {
    app.toast(t('section.nothing'));
    return;
  }
  // A side is made when an elevation round the model (one with no level) has its name in any language:
  // by the name in the language on now, switching it made four more beside them.
  const have = new Set(doc.sections.filter((m) => m.kind === 'elevation' && m.levelId === undefined).map((m) => m.name));
  const marks = elevationsAround(box, 3)
    .filter((e) => !inEveryLanguage(`section.side.${e.side}`).some((n) => have.has(n)))
    .map((e): SectionMark => ({ id: newSectionId(), name: t(`section.side.${e.side}`), kind: 'elevation', start: e.start, end: e.end, depth: e.depth }));
  if (marks.length === 0) {
    app.toast(t('section.allMade'));
    return;
  }
  app.store.dispatch(addSections(marks));
  app.toast(t('section.elevationsMade', { n: marks.length }));
}

/**
 * The rooms' four interior elevations each (elevationsInside, a centimetre off the wall behind, 30 cm into
 * the wall seen), on the room's level, named by its number and the side ("3-N"); those already there kept.
 */
export function addInteriorElevations(app: App, roomIds: readonly string[]): void {
  const doc = app.store.get();
  const g = deriveGeometry(doc);
  const have = new Set(doc.sections.map((m) => `${m.levelId ?? ''}|${m.name}`));
  const marks: SectionMark[] = [];
  let rooms = 0;
  for (const id of roomIds) {
    const r = roomOf(g, id);
    if (!r?.enclosed || r.outline.length < 3) continue;
    rooms++;
    const xs = r.outline.map((p) => p.x);
    const ys = r.outline.map((p) => p.y);
    const box = { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
    for (const e of elevationsInside(box, 0.01, 0.3)) {
      const name = `${r.room.number}-${t(`section.sideShort.${e.side}`)}`;
      if (have.has(`${r.room.levelId}|${name}`)) continue;
      marks.push({ id: newSectionId(), name, kind: 'elevation', start: e.start, end: e.end, depth: e.depth, levelId: r.room.levelId });
    }
  }
  if (rooms === 0) return app.toast(t('section.interiorNone'));
  if (marks.length === 0) return app.toast(t('section.interiorAll'));
  app.store.dispatch(addSections(marks));
  app.toast(t('section.interiorMade', { n: marks.length }));
}
