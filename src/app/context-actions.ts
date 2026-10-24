// What to offer for the selection, in the right-click menu and the floating bar (ref/chat.txt:206,
// 222): the actions that fit that kind of element, most used first, 3 to 6 of them.

import type { Doc } from './document';

export type ContextId =
  | 'flipWall'
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
  | 'commands';

export function contextIds(doc: Doc, selection: readonly string[]): ContextId[] {
  if (selection.length === 0) return ['drawWall', 'frameAll', 'commands'];
  if (selection.length > 1) {
    const openings = selection.map((id) => doc.openings.find((o) => o.id === id));
    const oneWall = openings.every((o) => o !== undefined && o.wallId === openings[0]!.wallId);
    return [...(oneWall ? (['distribute'] as const) : []), 'frameSelection', 'clearSelection', 'delete'];
  }
  const id = selection[0]!;
  const common: ContextId[] = ['frameSelection', 'properties', 'delete'];
  if (doc.walls.some((w) => w.id === id)) return ['flipWall', ...common];
  const opening = doc.openings.find((o) => o.id === id);
  if (opening) return opening.kind === 'door' ? ['flipHinge', 'flipSwing', ...common] : ['centerOpening', ...common];
  if (doc.rooms.some((r) => r.id === id)) {
    const floored = doc.floors.some((f) => f.source.kind === 'room' && f.source.roomId === id);
    return [...(floored ? [] : (['addFloor'] as const)), ...common];
  }
  return common;
}
