// The next element a placing tool makes, as Revit's type and instance properties before the click: a
// template of its kind, shown with the same fields as one selected (on the tool's ribbon tab and in the
// panel), and what the tool builds from, its place being the click's. Until it is changed it is the
// last one of its kind (as the tools did), or the kind's own defaults.

import type { Field } from '../elements/fields';
import { kindOfKey, withList } from '../elements/registry';
import type { KindKey } from '../elements/contract';
import { levelOf } from '../project/doc';
import { COLUMN_SIZE } from '../elements/column/schema';
import { BEAM_DEPTH, BEAM_WIDTH } from '../elements/beam/schema';
import { STAIR_TREAD, STAIR_WIDTH } from '../elements/stair/schema';
import { RAILING_HEIGHT } from '../elements/railing/schema';
import { edgesFor, ROOF_GRADE, ROOF_OVERHANG, ROOF_THICKNESS } from '../elements/roof/schema';
import { CEILING_THICKNESS, FLOOR_DEFAULTS } from '../elements/room/schema';
import { CURTAIN_DEFAULTS } from '../elements/curtain/schema';
import type { App } from './app';
import type { LevelId } from '../project/doc';
import { ceilingOf, holeOf } from '../elements/tool-draft';

/** What a template holds: one per kind, the floor tool's two (floors and ceilings) apart. */
export type NextSlot = 'columns' | 'beams' | 'stairs' | 'railings' | 'roofs' | 'floors' | 'ceilings' | 'curtains' | 'objects' | 'rooms';

const KEY: Readonly<Record<NextSlot, KindKey>> = { columns: 'columns', beams: 'beams', stairs: 'stairs', railings: 'railings', roofs: 'roofs', floors: 'floors', ceilings: 'floors', curtains: 'curtains', objects: 'objects', rooms: 'rooms' };

/** The template's id: never an element's (theirs start with their kind's prefix and an underscore). */
export const NEXT_ID = '__next__';

/** The slot of the tool in use; null for a tool that makes nothing of a kind (or makes walls, doors, windows: WallDefaults, OpeningSize). */
export function slotOf(app: App): NextSlot | null {
  const { tool } = app.ui;
  const ceilingTool = ceilingOf(app.ui.draft);
  switch (tool) {
    case 'column':
      return 'columns';
    case 'beam':
      return 'beams';
    case 'stair':
      return 'stairs';
    case 'railing':
      return 'railings';
    case 'roof':
      return 'roofs';
    case 'floor':
      return holeOf(app.ui.draft) ? null : ceilingTool ? 'ceilings' : 'floors';
    case 'curtain':
      return 'curtains';
    case 'room':
      return 'rooms';
    case 'object':
      return app.store.get().definitions.some((d) => d.id === app.ui.objectDef) ? 'objects' : null;
    default:
      return null;
  }
}

type Element = { readonly id: string; readonly levelId: LevelId } & Record<string, unknown>;

const square = (s: number) => [
  { x: 0, y: 0 },
  { x: s, y: 0 },
  { x: s, y: s },
  { x: 0, y: s },
];

/** The kind's own defaults, on the level shown. */
function blank(app: App, slot: NextSlot): Element {
  const levelId = app.ui.levelId;
  const base = { id: NEXT_ID, levelId };
  const doc = app.store.get();
  switch (slot) {
    case 'columns':
      return { ...base, at: { x: 0, y: 0 }, width: COLUMN_SIZE, depth: COLUMN_SIZE, angle: 0 };
    case 'beams':
      return { ...base, start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, width: BEAM_WIDTH, depth: BEAM_DEPTH };
    case 'stairs':
      return { ...base, kind: 'straight', at: { x: 0, y: 0 }, angle: 0, width: STAIR_WIDTH, tread: STAIR_TREAD, turn: 'left' };
    case 'railings':
      return { ...base, points: [{ x: 0, y: 0 }, { x: 3, y: 0 }], height: RAILING_HEIGHT, baseOffset: 0, infill: 'balusters' };
    case 'roofs': {
      const outline = square(6);
      return { ...base, outline, edges: edgesFor('hip', outline, ROOF_GRADE, ROOF_OVERHANG), kind: 'hip', thickness: ROOF_THICKNESS, baseOffset: 0 };
    }
    case 'floors':
      return { ...base, source: { kind: 'outline', points: square(4) }, ...FLOOR_DEFAULTS };
    case 'ceilings': {
      const height = levelOf(doc, levelId)?.height ?? 2.8;
      return { ...base, source: { kind: 'outline', points: square(4) }, thickness: CEILING_THICKNESS, offset: height + CEILING_THICKNESS, kind: 'ceiling' };
    }
    case 'curtains':
      return { ...base, start: { x: 0, y: 0 }, end: { x: 3, y: 0 }, ...CURTAIN_DEFAULTS };
    case 'rooms':
      return { ...base, seed: { x: 0, y: 0 }, name: '', number: '' };
    case 'objects': {
      const def = doc.definitions.find((d) => d.id === app.ui.objectDef)!;
      return { ...base, definitionId: def.id, typeId: def.types[0]!.id, at: { x: 0, y: 0 }, angle: app.ui.objectAngle, elevation: 0, values: {} };
    }
  }
}

/** The last one of the slot's kind in the document (the ceilings apart from the floors; an object of the definition placed). */
function last(app: App, slot: NextSlot): Element | undefined {
  const doc = app.store.get();
  const list = doc[KEY[slot]] as unknown as readonly Element[];
  const fits = (e: Element) =>
    slot === 'floors' ? e['kind'] !== 'ceiling' : slot === 'ceilings' ? e['kind'] === 'ceiling' : slot === 'objects' ? e['definitionId'] === app.ui.objectDef : true;
  return [...list].reverse().find(fits);
}

/** The template of a slot: as changed by the user, else the last one made, else the kind's defaults. */
export function nextOf(app: App, slot: NextSlot): Element {
  const kept = app.next[slot] as Element | undefined;
  // An object's follows the definition being placed.
  if (kept && (slot !== 'objects' || kept['definitionId'] === app.ui.objectDef)) return { ...kept, levelId: app.ui.levelId };
  const from = last(app, slot);
  return from ? { ...from, id: NEXT_ID, levelId: app.ui.levelId } : blank(app, slot);
}

/**
 * The element the tool makes: the template's properties with its own id, level and place (`at`, a
 * line's ends, an outline: what the click gives). Keys the template has and `place` sets are the place's.
 */
export function made<E>(app: App, slot: NextSlot, place: Record<string, unknown>): E {
  // What the last one had of its own place stays with it: a floor's holes, a guardrail's host and rise.
  const { holes: _h, host: _o, rise: _r, ...props } = nextOf(app, slot);
  return { ...props, levelId: app.ui.levelId, ...place } as E;
}

/** Fields of the selected element that are not for one not yet placed: its measures, its holes, its actions. */
// A room's name and number are its own (the next is numbered on); a roof's sides are its outline's.
const NOT_NEXT = new Set(['length', 'area', 'perimeter', 'volume', 'source', 'holes', 'addHole', 'clearHoles', 'tiles', 'edgeRailing', 'interiorElevations', 'runLength', 'warn', 'name', 'number']);
const notNext = (id: string) => NOT_NEXT.has(id) || /^side\d+$/.test(id);

/** The template's fields (those of the kind's panel that a next element has), the derived template they read, and a key of its values. */
export function nextFields(app: App): { readonly slot: NextSlot; readonly fields: readonly Field<unknown>[]; readonly items: readonly unknown[]; readonly key: string } | null {
  const slot = slotOf(app);
  if (!slot) return null;
  const kind = kindOfKey(KEY[slot]);
  const template = nextOf(app, slot);
  const doc = app.store.get();
  // Derived as if it were in the document, alone of its kind there.
  const inDoc = withList(doc, kind, [template]);
  const s = kind.derive(inDoc, template, app.geometry);
  if (s === null) return null;
  const fields = kind
    .fields([s], {
      doc: inDoc,
      floorLocked: app.ui.collisions,
      // A field's change is a command on its element: run on that document, the template comes back changed.
      dispatch: (c) => {
        const out = c.apply(inDoc);
        const changed = (out[kind.key] as unknown as readonly Element[]).find((e) => e.id === NEXT_ID);
        if (changed) app.next = { ...app.next, [slot]: changed };
        app.render();
      },
      geometry: app.geometry,
    })
    .filter((f) => f.kind !== 'readout' && f.kind !== 'note' && f.kind !== 'action' && !notNext(f.id));
  return { slot, fields, items: [s], key: JSON.stringify(template) };
}
