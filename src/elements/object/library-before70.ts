// The library's definitions as files of version 69 have them (io/project-file.ts): one stored unchanged by
// the user is replaced by the one now; one the user changed is kept. The meeting table's long type said 10
// chairs and made 8; the kettle barbecue showed the brick one's sizes and width handle, which act on nothing
// of it; a fire pit under 15 cm had its floor below the ground; the reception desk's NBR 9050 rule gave the
// counter's width as a height.

import type { ObjectDefinition } from './schema';
import { BEFORE_70_A } from './library-before70-a';
import { BEFORE_70_B } from './library-before70-b';
import { BEFORE_70_C } from './library-before70-c';

export const BEFORE_70: readonly ObjectDefinition[] = [...BEFORE_70_A, ...BEFORE_70_B, ...BEFORE_70_C];
