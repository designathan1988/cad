// Element ids in test fixtures: a literal written in a test is given its kind here, as the file's
// reader (project/typed-ids.ts) gives one read from a file. Only tests use it.

import type { OpeningGroupId, OpeningId } from '../src/elements/opening/schema';
import type { FloorId, RoomId } from '../src/elements/room/schema';
import type { DefinitionId, ObjectId } from '../src/elements/object/schema';
import type { LevelId } from '../src/project/doc';
import type { MaterialId, WallId, WallTypeId } from '../src/elements/wall/schema';

/** A wall's id written in a test. */
export const wid = (id: string): WallId => id as WallId;

/** A door's or window's id written in a test. */
export const oid = (id: string): OpeningId => id as OpeningId;

/** A room's id written in a test. */
export const rid = (id: string): RoomId => id as RoomId;

/** A floor's id written in a test. */
export const fid = (id: string): FloorId => id as FloorId;

/** A group's id written in a test. */
export const gid = (id: string): OpeningGroupId => id as OpeningGroupId;

/** A placed object's id written in a test. */
export const objid = (id: string): ObjectId => id as ObjectId;

/** A level's id written in a test. */
export const lid = (id: string): LevelId => id as LevelId;

/** A wall type's id written in a test. */
export const tid = (id: string): WallTypeId => id as WallTypeId;

/** A material's id written in a test. */
export const mid = (id: string): MaterialId => id as MaterialId;

/** An object definition's id written in a test. */
export const did = (id: string): DefinitionId => id as DefinitionId;

/** Any other element's id written in a test (a guide's, a dimension's…): its type comes from where it goes. */
export const xid = <I extends string>(id: string): I => id as I;
