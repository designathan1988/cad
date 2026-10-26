// What to offer for the selection, in the right-click menu and the floating bar (ref/chat.txt:206,
// 222): the actions that fit that kind of element, most used first, 3 to 6 of them.

import type { Doc } from './document';
import { canTransform } from '../tools/transform';
import { canMerge } from '../tools/split';

export type ContextId =
  | 'move'
  | 'copy'
  | 'rotate'
  | 'mirror'
  | 'scale'
  | 'merge'
  | 'flipWall'
  | 'editType'
  | 'flipHinge'
  | 'flipSwing'
  | 'centerOpening'
  | 'addFloor'
  | 'distribute'
  | 'frameSelection'
  | 'properties'
  | 'clearSelection'
  | 'delete'
  | 'drawWall'
  | 'frameAll'
  | 'clearGuides'
  | 'commands';

/** `levelId`: the level shown, whose guides can be deleted at once. */
export function contextIds(doc: Doc, selection: readonly string[], levelId?: string): ContextId[] {
  const walls = selection.filter((id) => doc.walls.some((w) => w.id === id));
  const merge = selection.length === 2 && walls.length === 2 && canMerge(doc, walls[0]!, walls[1]!) ? (['merge'] as const) : [];
  const guides = levelId !== undefined && doc.guides.some((g) => g.levelId === levelId) ? (['clearGuides'] as const) : [];
  if (selection.length === 0) return ['drawWall', 'frameAll', ...guides, 'commands'];
  // Move first, for what the Modify tools take (walls, doors and windows, rooms, outline floors, guides); the five of them
  // are in the tool bar, as Revit's Modify panel, so this menu keeps to six.
  const modify: ContextId[] = canTransform(doc, selection) ? ['move'] : [];
  if (selection.length > 1) {
    const openings = selection.map((id) => doc.openings.find((o) => o.id === id));
    const oneWall = openings.every((o) => o !== undefined && o.wallId === openings[0]!.wallId);
    return [...modify, ...merge, ...(oneWall ? (['distribute'] as const) : []), 'frameSelection', 'clearSelection', 'delete'];
  }
  const id = selection[0]!;
  // A guide has no extent to frame.
  if (doc.guides.some((g) => g.id === id)) return [...modify, 'properties', ...guides, 'delete'];
  const common: ContextId[] = ['frameSelection', 'properties', 'delete'];
  if (doc.walls.some((w) => w.id === id)) return [...modify, 'flipWall', 'editType', ...common];
  const opening = doc.openings.find((o) => o.id === id);
  if (opening) return opening.kind === 'door' ? [...modify, 'flipHinge', 'flipSwing', ...common] : [...modify, 'centerOpening', ...common];
  if (doc.rooms.some((r) => r.id === id)) {
    const floored = doc.floors.some((f) => f.source.kind === 'room' && f.source.roomId === id);
    return [...modify, ...(floored ? [] : (['addFloor'] as const)), ...common];
  }
  return [...modify, ...common];
}
