// What to offer for the selection, in the right-click menu and the floating bar (ref/chat.txt:206,
// 222): the actions that fit that kind of element, most used first, 3 to 6 of them.

import type { Doc } from '../project/doc';
import { canTransform } from '../elements/transform';
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
  | 'toggleOpen'
  | 'flipSwing'
  | 'centerOpening'
  | 'addFloor'
  | 'addCeiling'
  | 'distribute'
  | 'frameSelection'
  | 'properties'
  | 'clearSelection'
  | 'delete'
  | 'drawWall'
  | 'frameAll'
  | 'clearGuides'
  | 'section'
  | 'selectSimilar'
  | 'addNote'
  | 'addLevelMark'
  | 'copyClip'
  | 'paste'
  | 'hide'
  | 'isolate'
  | 'commands';

/** The commands of the element itself (its type, its flip, its own), before the general ones. */
const OWN: ReadonlySet<ContextId> = new Set(['flipWall', 'editType', 'toggleOpen', 'flipHinge', 'flipSwing', 'centerOpening', 'addFloor', 'addCeiling', 'distribute', 'merge', 'section']);

/**
 * The right-click menu, whole and grouped (Microsoft's menu guide: up to 15 items in groups, the complete
 * clipboard set, Delete and Properties last): the element's own commands, the Modify tools, the clipboard,
 * what the view shows, the selection, delete and properties. The floating bar keeps contextIds' few; the
 * menu took the same six and had no Copy, Rotate or Hide (docs/revisao-interface.md, M1).
 */
export function menuGroups(doc: Doc, selection: readonly string[], levelId?: string): ContextId[][] {
  const guides = levelId !== undefined && doc.guides.some((g) => g.levelId === levelId) ? (['clearGuides'] as const) : [];
  if (selection.length === 0) return [['drawWall', 'addNote', 'addLevelMark'], ['paste'], ['frameAll', ...guides], ['commands']];
  const own = contextIds(doc, selection, levelId).filter((id) => OWN.has(id));
  const modify: ContextId[] = canTransform(doc, selection) ? ['move', 'copy', 'rotate', 'mirror', 'scale'] : [];
  const groups: ContextId[][] = [
    own,
    modify,
    [...(canTransform(doc, selection) ? (['copyClip'] as const) : []), 'paste'],
    ['hide', 'isolate', 'frameSelection'],
    ['selectSimilar', 'clearSelection'],
    ['delete', 'properties'],
  ];
  return groups.filter((g) => g.length > 0);
}

/** `levelId`: the level shown, whose guides can be deleted at once. */
export function contextIds(doc: Doc, selection: readonly string[], levelId?: string): ContextId[] {
  const walls = selection.filter((id) => doc.walls.some((w) => w.id === id));
  const merge = selection.length === 2 && walls.length === 2 && canMerge(doc, walls[0]!, walls[1]!) ? (['merge'] as const) : [];
  const guides = levelId !== undefined && doc.guides.some((g) => g.levelId === levelId) ? (['clearGuides'] as const) : [];
  // Six at most: a text where the menu was opened (the level mark is in the ribbon); the commands give
  // way to clearing the guides (Ctrl+K is in the footer).
  if (selection.length === 0) return ['drawWall', 'addNote', 'frameAll', ...(guides.length > 0 ? guides : (['commands'] as const))];
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
  if (doc.guides.some((g) => g.id === id)) return [...modify, 'section', 'properties', ...guides, 'delete'];
  const common: ContextId[] = ['frameSelection', 'properties', 'delete'];
  // Select similar, Revit's Select All Instances, on the menu as there; where the six are full (a wall,
  // a door), in the place of framing one element, which F does.
  if (doc.walls.some((w) => w.id === id)) return [...modify, 'flipWall', 'editType', 'selectSimilar', 'properties', 'delete'];
  const opening = doc.openings.find((o) => o.id === id);
  if (opening)
    // Open or close it (shown in 3D), in the place of select similar (a door) or of framing it (a window), which F does.
    return opening.kind === 'door' ? [...modify, 'toggleOpen', 'flipHinge', 'flipSwing', 'properties', 'delete'] : [...modify, 'toggleOpen', 'centerOpening', 'selectSimilar', 'properties', 'delete'];
  if (doc.rooms.some((r) => r.id === id)) {
    const floored = doc.floors.some((f) => f.kind !== 'ceiling' && f.source.kind === 'room' && f.source.roomId === id);
    const ceiled = doc.floors.some((f) => f.kind === 'ceiling' && f.source.kind === 'room' && f.source.roomId === id);
    const make = [...(floored ? [] : (['addFloor'] as const)), ...(ceiled ? [] : (['addCeiling'] as const))];
    return [...modify, ...make, 'properties', 'delete'];
  }
  return [...modify, 'selectSimilar', ...common];
}
