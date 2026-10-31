// The project's store as the session uses it: every change keeps the doors and windows to what they are
// measured from, the rooms the walls move past, and locked or equal dimensions; a change that would break a
// locked dimension is refused and handed to onRefused.

import { settleDimensions } from '../elements/dimension/constraints';
import type { Dimension } from '../elements/dimension/schema';
import type { Store } from '../core/store';
import type { Doc } from '../project/doc';
import type { App } from './app';
import { keepRooms } from '../project/carry';
import { keepOpenings } from '../elements/opening/keep';
import { elementIds, levelIn } from '../project/doc';
import { savePrefs, scheduleSave } from '../project/persist';

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
          // Another project in place of this one: nothing of it follows from this one's dimensions,
            // openings or rooms (their ids may well repeat between projects).
            if (changed === before || c.replaces) return changed;
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

/** What follows every change of the document: saved, said afresh, the selection and the level shown kept to what is there. */
export function afterChange(app: App, d: Doc): void {
  scheduleSave(d);
  app.ui.info = null;
  // Only what no longer exists leaves the selection: editing a room or a floor keeps it selected.
  const live = elementIds(d);
  for (const id of [...app.ui.selection]) if (!live.has(id)) app.ui.selection.delete(id);
  // The level shown gone (deleted, or its adding undone): the first one, at the project's scale.
  if (!levelIn(d.levels, app.ui.levelId)) {
    app.ui.levelId = d.levels[0]!.id;
    app.ui.viewDen = null;
    savePrefs({ levelId: app.ui.levelId });
  }
  app.refresh();
}
