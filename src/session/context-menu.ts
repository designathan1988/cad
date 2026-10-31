// The actions contextIds picks for the selection, made runnable: label, icon, key and what they do.
// The right-click menu and the floating bar both show these, so the same action has the same name,
// icon and key in both (ref/chat.txt:200).

import { distributeOpenings, updateOpening } from '../elements/opening/commands';
import { flipWalls } from '../elements/wall/flip';
import { t, type MessageKey } from '../i18n/messages';
import type { IconName } from '../i18n/icons';
import type { App } from './app';
import { type ContextId, contextIds, menuGroups } from './context-actions';
import { mergeSelection, startModify } from './modify';
import { addCeilingToRoom, addFloorToRoom } from './room-tool';
import { frameSelection } from './view-ui';
import { clearSelection, copySelection, deleteSelection, hideTemporarily, paste, selectSimilar } from './selection';
import { clearGuidesHere } from '../elements/guide/tool-ui';
import { addLevelMarkHere, addNoteHere } from './kind-tools';
import * as appPlacing from './app-placing';
import * as appSettings from './app-settings';
import * as appEdit from './app-edit';
import { wallsIn } from '../elements/wall/schema';
import { isOpeningId } from '../elements/opening/schema';
import { newGroupId } from '../elements/opening/schema';

export interface ContextEntry {
  readonly id: ContextId;
  readonly label: string;
  readonly icon: IconName;
  readonly keys?: string;
  readonly run: () => void;
}

/**
 * Each entry's icon and the action of the action list it is (actions.ts): its key comes from there, so a key
 * the user remapped shows as remapped (these were literal strings).
 */
const LOOK: Readonly<Record<ContextId, { icon: IconName; action?: string }>> = {
  move: { icon: 'move', action: 'edit.move' },
  copy: { icon: 'copy', action: 'edit.copy' },
  rotate: { icon: 'rotate', action: 'edit.rotate' },
  mirror: { icon: 'mirror', action: 'edit.mirror' },
  scale: { icon: 'scale', action: 'edit.scale' },
  merge: { icon: 'merge', action: 'edit.merge' },
  copyClip: { icon: 'copy', action: 'edit.copyClip' },
  paste: { icon: 'plus', action: 'edit.paste' },
  hide: { icon: 'eyeOff', action: 'view.tempHide' },
  isolate: { icon: 'eye', action: 'view.tempIsolate' },
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

/** The floating bar's few (contextIds): the selection's most used commands. */
export function contextEntries(app: App, openCommands: () => void): ContextEntry[] {
  const entry = entriesFor(app, openCommands);
  return contextIds(app.store.get(), [...app.ui.selection], app.ui.levelId).filter(shownIn(app)).map(entry);
}

/** Open or close a door is seen in 3D only: in plan it is not offered. */
const shownIn = (app: App) => (id: ContextId): boolean => id !== 'toggleOpen' || app.ui.view === '3d';

/** The right-click menu's groups (menuGroups): every command that applies, grouped. */
export function menuEntries(app: App, openCommands: () => void): ContextEntry[][] {
  const entry = entriesFor(app, openCommands);
  return menuGroups(app.store.get(), [...app.ui.selection], app.ui.levelId)
    .map((g) => g.filter(shownIn(app)).map(entry))
    .filter((g) => g.length > 0);
}

function entriesFor(app: App, openCommands: () => void): (id: ContextId) => ContextEntry {
  const ids = [...app.ui.selection];
  const one = ids.length === 1 ? ids[0]! : null;
  const opening = one ? app.store.get().openings.find((o) => o.id === one) : undefined;
  const run: Record<ContextId, () => void> = {
    move: () => startModify(app, 'move'),
    copy: () => startModify(app, 'copy'),
    rotate: () => startModify(app, 'rotate'),
    mirror: () => startModify(app, 'mirror'),
    scale: () => startModify(app, 'scale'),
    merge: () => mergeSelection(app),
    flipWall: () => app.store.dispatch(flipWalls(wallsIn(app.store.get().walls, ids))),
    editType: () => app.openWallTypes(app.store.get().walls.find((w) => w.id === one)?.wallTypeId),
    // Offered in 3D only, where it shows (shown below): it switched the plan to 3D on its own (M9).
    toggleOpen: () => appPlacing.toggleOpen(app, ids),
    flipHinge: () => opening && app.store.dispatch(updateOpening(opening.id, { hinge: opening.hinge === 'start' ? 'end' : 'start' })),
    flipSwing: () => opening && app.store.dispatch(updateOpening(opening.id, { swing: opening.swing === 'left' ? 'right' : 'left' })),
    centerOpening: () => opening && app.store.dispatch(updateOpening(opening.id, { rule: { kind: 'centered' } })),
    addFloor: () => one && addFloorToRoom(app, one),
    addCeiling: () => one && addCeilingToRoom(app, one),
    distribute: () => app.store.dispatch(distributeOpenings(newGroupId(), ids.filter(isOpeningId), { kind: 'equal' })),
    frameSelection: () => frameSelection(app),
    properties: () => appSettings.showProperties(app),
    clearSelection: () => clearSelection(app),
    delete: () => deleteSelection(app),
    drawWall: () => app.setTool('wall'),
    frameAll: () => app.frameAll(),
    clearGuides: () => clearGuidesHere(app),
    section: () => appEdit.sectionAtGuide(app),
    selectSimilar: () => selectSimilar(app),
    addNote: (() => {
      const at = app.contextPoint;
      return () => addNoteHere(app, at ?? undefined);
    })(),
    addLevelMark: (() => {
      const at = app.contextPoint;
      return () => addLevelMarkHere(app, at ?? undefined);
    })(),
    copyClip: () => copySelection(app),
    paste: () => paste(app),
    hide: () => hideTemporarily(app, 'hide'),
    isolate: () => hideTemporarily(app, 'isolate'),
    commands: openCommands,
  };
  // The keys as they are now, the user's own included (keymap.ts through the action list).
  const actions = new Map(app.actionList().map((a) => [a.id, a]));
  return (id) => {
    const look = LOOK[id];
    const keys = look.action ? actions.get(look.action)?.keys : undefined;
    return { id, label: t(`ctx.${id}` as MessageKey), icon: look.icon, ...(keys ? { keys } : {}), run: run[id] };
  };
}
