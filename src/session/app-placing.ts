import type { App } from './app';
import { made, nextOf } from './next';
import { OBJECT_PREVIEW } from './kind-tools';
import type { ObjectInstance } from '../elements/object/schema';
import { updateOpening } from '../elements/opening/commands';
import { swings } from '../elements/opening/style';
import type { Field } from '../elements/fields';
import { newOpening, type Opening, type OpeningKind } from '../elements/opening/schema';
import { OPENING_PREVIEW_ID } from '../elements/opening/aim';
import { t } from '../i18n/messages';
import type { Doc } from '../project/doc';
import { savePrefs } from '../project/persist';
import type { DefinitionId } from '../elements/object/schema';


export function previewOpening(app: App): Opening[] {
  const kind = app.openingKind();
  const o = app.ui.opening;
  if (!kind || o.kind !== 'aiming') return [];
  return [newOpening(OPENING_PREVIEW_ID, o.aim.wallId, kind, o.rule, { ...app.ui.openingDefaults[kind], ...app.placedSides(kind, o.aim.side) })];
}

/** Whether the door or window tool places a leaf on hinges (a door, a casement window): its side and hinge can be chosen. */
export function placesLeaf(app: App, kind: OpeningKind): boolean {
  return kind === 'door' || app.ui.openingDefaults[kind].style?.operation === 'casement';
}

/** The next door's (or casement's) side and hinge as fields, for the Place tab and the panel: what Space and H change. */
export function placeSideFields(app: App, kind: OpeningKind): Field<unknown>[] {
  if (!placesLeaf(app, kind)) return [];
  const f = () => app.ui.doorFlip;
  return [
    { id: 'placeSwing', label: 'place.swing', kind: 'segmented', options: [{ value: '0', label: t('place.swingPointer') }, { value: '1', label: t('place.swingAway') }], get: () => (f().swing ? '1' : '0'), set: (v) => void ((v === '1') !== f().swing && flipPlacing(app, 'swing')) },
    { id: 'placeHinge', label: 'place.hinge', kind: 'segmented', options: [{ value: '0', label: t('place.hingeNormal') }, { value: '1', label: t('place.hingeOther') }], get: () => (f().hinge ? '1' : '0'), set: (v) => void ((v === '1') !== f().hinge && flipPlacing(app, 'hinge')) },
  ];
}

/** Space or H with the door tool: the next door opens to the other side, or hangs on the other jamb; true when it was the door tool. */
export function flipPlacing(app: App, which: 'swing' | 'hinge'): boolean {
  const kind = app.openingKind();
  if (!kind || !placesLeaf(app, kind)) return false;
  const f = app.ui.doorFlip;
  app.ui.doorFlip = which === 'swing' ? { ...f, swing: !f.swing } : { ...f, hinge: !f.hinge };
  app.refresh();
  return true;
}

/** While aiming: why the opening cannot go there, said before the click. */
export function previewProblem(app: App): string | null {
  const p = app.geometry.openings.get(OPENING_PREVIEW_ID);
  const k = p?.warnings.find((w) => w === 'openingOverlap' || w === 'openingOutside');
  return k ? t('hint.openingRefused', { reason: afterColon(t(`warn.${k}`)) }) : null;
}

/** The one element selected, when it is a door. */
export function selectedDoor(app: App): boolean {
  const one = app.ui.selection.size === 1 ? [...app.ui.selection][0] : undefined;
  return app.store.get().openings.some((o) => o.id === one && swings(o));
}

/** Flips the one door selected: the side it opens to, or its hinge to the other jamb. False if none. */
export function flipDoor(app: App, which: 'swing' | 'hinge', id?: string): boolean {
  const one = id ?? (app.ui.selection.size === 1 ? [...app.ui.selection][0] : undefined);
  const o = app.store.get().openings.find((x) => x.id === one && swings(x));
  if (!o) return false;
  app.store.dispatch(updateOpening(o.id, which === 'swing' ? { swing: o.swing === 'left' ? 'right' : 'left' } : { hinge: o.hinge === 'start' ? 'end' : 'start' }));
  return true;
}

/** The doors and windows among `ids` opened, or closed when all of them are open. */
export function toggleOpen(app: App, ids: readonly string[]): void {
  const doc = app.store.get();
  const mine = ids.filter((id) => doc.openings.some((o) => o.id === id));
  if (mine.length === 0) return;
  const allOpen = mine.every((id) => app.ui.opened.has(id));
  const next = new Set(app.ui.opened);
  for (const id of mine) if (allOpen) next.delete(id);
  else next.add(id);
  app.ui.opened = next;
  app.ui.info = t(allOpen ? 'hint.closedOpenings' : 'hint.openedOpenings', { n: mine.length });
  app.refresh();
}

/** Doors' and windows' type marks in plan, on or off; kept with the preferences. */
export function toggleOpeningTags(app: App): void {
  app.ui.openingTags = !app.ui.openingTags;
  savePrefs({ openingTags: app.ui.openingTags });
  app.render();
}

/** The object tool's object where the pointer is (snapped), as it would be placed; null otherwise. */
export function previewObject(app: App, doc: Doc): Doc | null {
  // An object's handle dragged: the object as it would be with the value and position so far.
  const h = app.ui.drag?.kind === 'handle' ? app.ui.drag : null;
  if (h?.handle.opening) return { ...doc, openings: doc.openings.map((o) => (o.id === h.handle.id ? { ...o, ...h.patch } : o)) };
  if (h) return { ...doc, objects: doc.objects.map((o) => (o.id === h.handle.id ? { ...o, at: h.at, values: { ...o.values, [h.handle.param]: h.value } } : o)) };
  const at = app.ui.tool === 'object' && app.ui.view === 'plan' ? (app.ui.snap?.point ?? app.ui.cursor) : null;
  const def = doc.definitions.find((d) => d.id === app.ui.objectDef);
  if (!at || !def) return null;
  // As it will be placed: the next object's type and values (next-element.ts).
  const preview = made<ObjectInstance>(app, 'objects', { id: OBJECT_PREVIEW, at: { x: at.x, y: at.y }, angle: app.ui.objectAngle });
  return { ...doc, objects: [...doc.objects, preview] };
}

/** The object tool with a definition (the ribbon's and the palette's Place table, Place bookcase…). */
export function placeObject(app: App, definitionId: DefinitionId, typeId?: string): void {
  app.ui.objectDef = definitionId;
  // A type chosen to place (the objects' store): the next object is of it, with its own values.
  if (typeId !== undefined) app.next = { ...app.next, objects: { ...nextOf(app, 'objects'), typeId, values: {} } };
  app.setTool('object');
}

/** Space with the object tool: the next object a quarter turn on. */
export function turnObject(app: App): void {
  app.ui.objectAngle = (app.ui.objectAngle + Math.PI / 2) % (2 * Math.PI);
  app.refresh();
}

/** A message going after a colon in another ("Cannot place it here: overlaps…"): lower case first. */
export const afterColon = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
