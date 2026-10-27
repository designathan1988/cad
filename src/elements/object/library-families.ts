// The families added to the library after the first ones (library.ts), each batch with the version of the
// project file that brought it: a file from before a batch gets that batch's families it does not have
// (io/project-file.ts), so one the user deleted after is not brought back.

import type { ObjectDefinition } from './schema';
import { LIBRARY_LIVING } from './library-living';
import { LIBRARY_BEDROOM } from './library-bedroom';
import { LIBRARY_KITCHEN } from './library-kitchen';

export const FAMILY_BATCHES: readonly { readonly version: number; readonly families: readonly ObjectDefinition[] }[] = [
  { version: 50, families: LIBRARY_LIVING },
  { version: 51, families: LIBRARY_BEDROOM },
  { version: 52, families: LIBRARY_KITCHEN },
];

export const LIBRARY_FAMILIES: readonly ObjectDefinition[] = FAMILY_BATCHES.flatMap((b) => b.families);
