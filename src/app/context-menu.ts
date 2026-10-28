// The actions contextIds picks for the selection, made runnable: label, icon, key and what they do.
// The right-click menu and the floating bar both show these, so the same action has the same name,
// icon and key in both (ref/chat.txt:200). The key is the action list's (actions.ts), as the user set
// it: a key changed in the keys dialog shows here as it does in the palette and the ribbon.

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

/** Each entry's icon, and the action of the action list it is (its key comes from there). */
const LOOK: Readonly<Record<ContextId, { icon: IconName; action?: string }>> = {
  move: { icon: 'move', action: 'edit.move' },
  copy: { icon: 'copy', action: 'edit.copy' },
  rotate: { icon: 'rotate', action: 'edit.rotate' },
  mirror: { icon: 'mirror', action: 'edit.mirror' },
  scale: { icon: 'scale', action: 'edit.scale' },
  merge: { icon: 'merge', action: 'edit.merge' },
  flipWall: { icon: 'flip' },
  editType: { icon: 'wall', action: 'type.edit' },
  flipHinge: { icon: 'door', action: 'edit.flipHinge' },
  // Each its own icon: open or close is a door standing ajar; the side it opens to, the swing's arc; the
  // hinge's jamb, a door with its hinge side marked. Two of them shared the arc and could not be told apart.
  toggleOpen: { icon: 'doorOpen' },
  flipSwing: { icon: 'swing' },
  centerOpening: { icon: 'center' },
  addFloor: { icon: 'slab' },
  addCeiling: { icon: 'arrowUp' },
  distribute: { icon: 'distribute' },
  frameSelection: { icon: 'zoomSel', action: 'view.frameSelection' },
  properties: { icon: 'panel' },
  clearSelection: { icon: 'close', action: 'edit.clearSelection' },
  delete: { icon: 'trash', action: 'edit.delete' },
  drawWall: { icon: 'wall', action: 'tool.wall' },
  // The same icon as the Home button in the top bar, which does the same.
  frameAll: { icon: 'home', action: 'view.frameAll' },
  clearGuides: { icon: 'guide', action: 'edit.clearGuides' },
  section: { icon: 'cut', action: 'view.section' },
  selectSimilar: { icon: 'pointer', action: 'edit.selectSimilar' },
  addNote: { icon: 'text', action: 'edit.addNote' },
  addLevelMark: { icon: 'height', action: 'edit.addLevelMark' },
  commands: { icon: 'command', action: 'help.commands' },
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
    toggleOpen: () => {
      if (app.ui.view === 'plan') app.setView('3d');
      app.toggleOpen(ids);
    },
    flipHinge: () => opening && app.store.dispatch(updateOpening(opening.id, { hinge: opening.hinge === 'start' ? 'end' : 'start' })),
    flipSwing: () => opening && app.store.dispatch(updateOpening(opening.id, { swing: opening.swing === 'left' ? 'right' : 'left' })),
    centerOpening: () => opening && app.store.dispatch(updateOpening(opening.id, { rule: { kind: 'centered' } })),
    addFloor: () => one && app.addFloorToRoom(one),
    addCeiling: () => one && app.addCeilingToRoom(one),
    distribute: () => app.store.dispatch(distributeOpenings(newId(GROUP_PREFIX), ids, { kind: 'equal' })),
    frameSelection: () => app.frameSelection(),
    properties: () => app.showProperties(),
    clearSelection: () => app.clearSelection(),
    delete: () => app.deleteSelection(),
    drawWall: () => app.setTool('wall'),
    frameAll: () => app.frameAll(),
    clearGuides: () => app.clearGuides(),
    section: () => app.sectionAtGuide(),
    selectSimilar: () => app.selectSimilar(),
    addNote: (() => {
      const at = app.contextPoint;
      return () => app.addNoteHere(at ?? undefined);
    })(),
    addLevelMark: (() => {
      const at = app.contextPoint;
      return () => app.addLevelMarkHere(at ?? undefined);
    })(),
    commands: openCommands,
  };
  // The keys as the action list has them now: the user's, or none when turned off.
  const keys = new Map(app.actionList().flatMap((a) => (a.keys ? [[a.id, a.keys] as const] : [])));
  return contextIds(app.store.get(), ids, app.ui.levelId).map((id) => {
    const { icon, action } = LOOK[id];
    const key = action ? keys.get(action) : undefined;
    return { id, label: t(`ctx.${id}` as MessageKey), icon, ...(key ? { keys: key } : {}), run: run[id] };
  });
}
