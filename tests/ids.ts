// Element ids in test fixtures: a literal written in a test is given its kind here, as the file's
// reader (project/typed-ids.ts) gives one read from a file. Only tests use it.

import type { OpeningGroupId, OpeningId } from '../src/elements/opening/schema';
import type { FloorId, RoomId } from '../src/elements/room/schema';
import type { ObjectId } from '../src/elements/object/schema';
import type { LevelId } from '../src/project/doc';
import type { WallId } from '../src/elements/wall/schema';

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
