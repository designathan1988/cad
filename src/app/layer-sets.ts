// Layer combinations and graphic overrides (phase 9; ArchiCAD's layer combinations, Revit's filters):
// named sets of the categories hidden, kept in the project, applied with a click; and walls of a type
// drawn in a colour of their own in plan (walls to demolish in red), rooms of a use too (the wet areas
// in blue), on or off. Each change one command.

import type { Command } from '../core/store';
import { isColor } from '../elements/material/schema';
import type { Doc } from './document';
import type { Category } from './geometry';
import { ROOM_USES } from '../elements/room/schema';

export const CATEGORIES: readonly Category[] = ['walls', 'openings', 'rooms', 'floors', 'objects', 'services', 'guides'];

export interface LayerSet {
  readonly id: string;
  readonly name: string;
  /** The categories it hides; the others it shows. */
  readonly hidden: readonly Category[];
}

export interface WallOverride {
  readonly id: string;
  readonly wallTypeId: string;
  /** The plan's fill for walls of that type, #rrggbb. */
  readonly color: string;
}

/** Rooms of a use filled in plan with a colour of their own (the wet areas in blue, the bedrooms in green). */
export interface RoomOverride {
  readonly id: string;
  readonly use: string;
  /** #rrggbb, drawn translucent over the room's floor. */
  readonly color: string;
}

export const isRoomOverride = (x: unknown): x is RoomOverride => {
  const o = x as Partial<RoomOverride> | null;
  return !!o && typeof o === 'object' && typeof o.id === 'string' && typeof o.use === 'string' && (ROOM_USES as readonly string[]).includes(o.use) && isColor(o.color);
};

/** The room overrides as a whole (none left: none kept). */
export const setRoomOverrides = (overrides: readonly RoomOverride[]): Command<Doc> => ({
  label: 'cmd.setOverrides',
  apply: (doc) => {
    if (!overrides.every(isRoomOverride) || JSON.stringify(doc.roomOverrides ?? []) === JSON.stringify(overrides)) return doc;
    if (overrides.length > 0) return { ...doc, roomOverrides: overrides };
    const { roomOverrides: _gone, ...without } = doc;
    return without;
  },
});

/** The colour rooms of each use are filled with in plan, when the overrides are on. */
export const roomOverrideColours = (doc: Pick<Doc, 'roomOverrides'>): ReadonlyMap<string, string> => new Map((doc.roomOverrides ?? []).map((o) => [o.use, o.color]));

export const isCategoryList = (x: unknown): x is Category[] => Array.isArray(x) && x.every((c) => (CATEGORIES as readonly unknown[]).includes(c));

export const isLayerSet = (x: unknown): x is LayerSet => {
  const o = x as Partial<LayerSet> | null;
  return !!o && typeof o === 'object' && typeof o.id === 'string' && typeof o.name === 'string' && o.name.trim() !== '' && isCategoryList(o.hidden);
};

export const isWallOverride = (x: unknown): x is WallOverride => {
  const o = x as Partial<WallOverride> | null;
  return !!o && typeof o === 'object' && typeof o.id === 'string' && typeof o.wallTypeId === 'string' && isColor(o.color);
};

/** The next free "base n". */
export function nextName(names: readonly string[], base: string): string {
  const taken = new Set(names);
  for (let n = 1; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

export const saveLayerSet = (set: LayerSet): Command<Doc> => ({
  label: 'cmd.saveLayerSet',
  apply: (doc) => (isLayerSet(set) ? { ...doc, layerSets: [...(doc.layerSets ?? []), set] } : doc),
});

export const deleteLayerSet = (id: string): Command<Doc> => ({
  label: 'cmd.deleteLayerSet',
  apply: (doc) => {
    const sets = doc.layerSets ?? [];
    if (!sets.some((s) => s.id === id)) return doc;
    const rest = sets.filter((s) => s.id !== id);
    if (rest.length > 0) return { ...doc, layerSets: rest };
    const { layerSets: _gone, ...without } = doc;
    return without;
  },
});

/** The overrides as a whole: added, changed or removed (none left: none kept). */
export const setOverrides = (overrides: readonly WallOverride[]): Command<Doc> => ({
  label: 'cmd.setOverrides',
  apply: (doc) => {
    if (!overrides.every(isWallOverride) || JSON.stringify(doc.overrides ?? []) === JSON.stringify(overrides)) return doc;
    if (overrides.length > 0) return { ...doc, overrides };
    const { overrides: _gone, ...without } = doc;
    return without;
  },
});

/** The colour walls of each type are filled with in plan, when the overrides are on. */
export const overrideColours = (doc: Pick<Doc, 'overrides'>): ReadonlyMap<string, string> => new Map((doc.overrides ?? []).map((o) => [o.wallTypeId, o.color]));
