// The library's definitions as files before version 66 have them (io/project-file.ts): one stored
// unchanged by the user is replaced by the one now; one the user changed is kept.

import type { ObjectDefinition } from "./schema";
import { BEFORE_66_PART_1 } from "./library-before66-a";
import { BEFORE_66_PART_2 } from "./library-before66-b";

export const BEFORE_66: readonly ObjectDefinition[] = [...BEFORE_66_PART_1, ...BEFORE_66_PART_2];
