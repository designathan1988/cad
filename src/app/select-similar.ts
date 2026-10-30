// Select similar (ref/chat.txt:107), as Revit's "Select All Instances": from what is selected, every
// element on the level shown that is like one of them. Walls of the same type; doors and windows of the
// same kind and size; rooms of the same use (all rooms, for one without a use); floors of the same
// thickness; notes of the same letter height; guides, all of them. Pure.

import { similarKinds } from '../elements/registry';
import type { Doc } from '../project/doc';

/** The ids to select: what is selected and everything like it on the level, in the document's order. */
export function similarTo(doc: Doc, selected: ReadonlySet<string>, levelId: string): string[] {
  const out = new Set(selected);
  // The registry's kinds by their own likeness (contract.ts: similar): walls of the same type, doors and windows of the same kind
  // and size, rooms of the same use, floors of the same thickness, columns and beams of the same section,
  // texts of the same letter height, guides all.
  for (const id of similarKinds(doc, selected, levelId)) out.add(id);
  return [...out];
}
