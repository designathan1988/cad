// The actions contextIds picks for the selection, made runnable: label, icon, key and what they do.
// The right-click menu and the floating bar both show these, so the same action has the same name,
// icon and key in both (ref/chat.txt:200).

import { newId } from '../core/id';
import { distributeOpenings, updateOpening } from '../elements/opening/commands';
import { GROUP_PREFIX } from '../elements/opening/schema';
import { flipWalls } from '../elements/wall/flip';
import { t, type MessageKey } from '../ui/i18n';
import type { IconName } from '../ui/icons';
import type { App } from './app';
import { type ContextId, contextIds } from './context-actions';

export interface ContextEntry {
  readonly id: ContextId;
  readonly label: string;
  readonly icon: IconName;
  readonly keys?: string;
  readonly run: () => void;
}

const LOOK: Readonly<Record<ContextId, { icon: IconName; keys?: string }>> = {
  move: { icon: 'move', keys: 'Shift+M' },
  copy: { icon: 'copy', keys: 'Shift+C' },
  rotate: { icon: 'rotate', keys: 'Shift+R' },
  mirror: { icon: 'mirror', keys: 'Shift+X' },
  scale: { icon: 'scale', keys: 'Shift+E' },
  merge: { icon: 'merge', keys: 'Shift+J' },
  flipWall: { icon: 'flip' },
  editType: { icon: 'wall' },
  flipHinge: { icon: 'door', keys: 'H' },
  flipSwing: { icon: 'swing' },
  centerOpening: { icon: 'center' },
  addFloor: { icon: 'slab' },
  distribute: { icon: 'distribute' },
  frameSelection: { icon: 'zoomSel', keys: 'F' },
  properties: { icon: 'panel' },
  clearSelection: { icon: 'close', keys: 'Esc' },
  delete: { icon: 'trash', keys: 'Del' },
  drawWall: { icon: 'wall', keys: 'W' },
  // The same icon as the Home button in the top bar, which does the same.
  frameAll: { icon: 'home', keys: 'Home' },
  clearGuides: { icon: 'guide' },
  section: { icon: 'cut' },
  commands: { icon: 'command', keys: 'Ctrl+K' },
};

export function contextEntries(app: App, openCommands: () => void): ContextEntry[] {
  const ids = [...app.ui.selection];
  const one = ids.length === 1 ? ids[0]! : null;
  const opening = one ? app.store.get().openings.find((o) => o.id === one) : undefined;
  const run: Record<ContextId, () => void> = {
    move: () => app.startModify('move'),
    copy: () => app.startModify('copy'),
    rotate: () => app.startModify('rotate'),
    mirror: () => app.startModify('mirror'),
    scale: () => app.startModify('scale'),
    merge: () => app.mergeSelection(),
    flipWall: () => app.store.dispatch(flipWalls(ids)),
    editType: () => app.openWallTypes(app.store.get().walls.find((w) => w.id === one)?.wallTypeId),
    flipHinge: () => opening && app.store.dispatch(updateOpening(opening.id, { hinge: opening.hinge === 'start' ? 'end' : 'start' })),
    flipSwing: () => opening && app.store.dispatch(updateOpening(opening.id, { swing: opening.swing === 'left' ? 'right' : 'left' })),
    centerOpening: () => opening && app.store.dispatch(updateOpening(opening.id, { rule: { kind: 'centered' } })),
    addFloor: () => one && app.addFloorToRoom(one),
    distribute: () => app.store.dispatch(distributeOpenings(newId(GROUP_PREFIX), ids, { kind: 'equal' })),
    frameSelection: () => app.frameSelection(),
    properties: () => app.showProperties(),
    clearSelection: () => app.clearSelection(),
    delete: () => app.deleteSelection(),
    drawWall: () => app.setTool('wall'),
    frameAll: () => app.frameAll(),
    clearGuides: () => app.clearGuides(),
    section: () => app.sectionAtGuide(),
    commands: openCommands,
  };
  return contextIds(app.store.get(), ids, app.ui.levelId).map((id) => ({
    id,
    label: t(`ctx.${id}` as MessageKey),
    ...LOOK[id],
    run: run[id],
  }));
}
