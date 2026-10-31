// Element ids in test fixtures: a literal written in a test is given its kind here, as the file's
// reader (project/typed-ids.ts) gives one read from a file. Only tests use it.

import type { WallId } from '../src/elements/wall/schema';

/** A wall's id written in a test. */
export const wid = (id: string): WallId => id as WallId;
