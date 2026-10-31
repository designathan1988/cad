import type { RoomId } from '../room/schema';
import type { LevelId } from '../../project/doc';
import { type Brand, newId } from '../../core/id';
// Zones (phase 6): rooms of a level taken together under a name, a category (social, private, service)
// and a colour, as Revit's areas and ArchiCAD's zone categories. The plan tints its rooms; its area is
// theirs. It holds the rooms by id: a room deleted leaves it.

export const ZONE_PREFIX = 'zone';

/** A zone's id (zone…). */
export type ZoneId = Brand<'zone'>;

/** A new zone's id. */
export const newZoneId = (): ZoneId => newId(ZONE_PREFIX) as ZoneId;
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
  readonly id: ZoneId;
  readonly levelId: LevelId;
  readonly name: string;
  readonly category: ZoneCategory;
  readonly color: string;
  readonly rooms: readonly RoomId[];
}
