// The project's store as the session uses it: every change keeps the doors and windows to what they are
// measured from, the rooms the walls move past, and locked or equal dimensions; a change that would break a
// locked dimension is refused and handed to onRefused.

import { settleDimensions } from '../elements/dimension/constraints';
import type { Dimension } from '../elements/dimension/schema';
import type { Store } from '../core/store';
import type { Doc } from '../project/doc';
import { keepRooms } from '../project/carry';
import { keepOpenings } from '../elements/opening/keep';

export function keepingStore(store: Store<Doc>, onRefused: (dim: Dimension) => void): Store<Doc> {
  return {
    ...store,
    // Locked and equal dimensions are kept too (elements/dimension/constraints.ts): what holds them
    // follows, or the change is refused and said.
    dispatch: (c) => {
      let refused: Dimension | null = null;
      store.dispatch({
        label: c.label,
        apply: (before) => {
          const changed = c.apply(before);
          if (changed === before) return changed;
          const settled = settleDimensions(before, changed);
          if (!settled.ok) {
            refused = settled.dim;
            return before;
          }
          const next = settled.doc;
          return next.walls === before.walls ? next : keepRooms(before, keepOpenings(before, next)).doc;
        },
      });
      if (refused) onRefused(refused);
    },
    };
}
