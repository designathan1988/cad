import type { RoomId } from '../room/schema';
// Zones (phase 6): rooms of a level taken together under a name, a category (social, private, service)
// and a colour, as Revit's areas and ArchiCAD's zone categories. The plan tints its rooms; its area is
// theirs. It holds the rooms by id: a room deleted leaves it.

export const ZONE_PREFIX = 'zone';
export const ZONE_CATEGORIES = ['social', 'private', 'service', 'circulation', 'other'] as const;
export type ZoneCategory = (typeof ZONE_CATEGORIES)[number];

/** Each category's colour, as plans tint zones: what a new zone of it takes. */
export const ZONE_COLOURS: Readonly<Record<ZoneCategory, string>> = {
  social: '#e9b949',
  private: '#6aa2d8',
  service: '#7cbf7a',
  circulation: '#c9c4bb',
  other: '#c58ad1',
};

export interface Zone {
  readonly id: string;
  readonly levelId: string;
  readonly name: string;
  readonly category: ZoneCategory;
  readonly color: string;
  readonly rooms: readonly RoomId[];
}
