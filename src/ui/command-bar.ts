// The fixed bar of general commands under the title bar: what any selection takes (moving and its kin, the
// clipboard, hiding for a while, the selection itself), always in the same place, greyed out while the
// selection does not take them (each action's `enabled`, session/actions.ts).

import type { Action } from '../session/actions';
import type { App } from '../session/app';
import { type BarEntry, barButtons, barKey, drawBar } from './bars';

const COMMANDS: readonly BarEntry[] = [
  { id: 'edit.move', icon: 'move' },
  { id: 'edit.copy', icon: 'copy' },
  { id: 'edit.rotate', icon: 'rotate' },
  { id: 'edit.mirror', icon: 'mirror' },
  { id: 'edit.scale', icon: 'scale' },
  '-',
  { id: 'edit.copyClip', icon: 'clipCopy' },
  { id: 'edit.paste', icon: 'paste' },
  '-',
  { id: 'view.tempHide', icon: 'eyeOff' },
  { id: 'view.tempIsolate', icon: 'isolate' },
  '-',
  { id: 'edit.selectAll', icon: 'selectAll' },
  { id: 'edit.selectAllWalls', icon: 'wall' },
  { id: 'edit.selectSimilar', icon: 'similar' },
  { id: 'view.frameSelection', icon: 'zoomSel' },
  { id: 'edit.clearSelection', icon: 'deselect' },
  { id: 'edit.delete', icon: 'trash' },
];

export function renderCommandBar(app: App, actions: ReadonlyMap<string, Action>): void {
  drawBar(app.shell.commandBar, barKey(COMMANDS, actions), () => barButtons(COMMANDS, actions, 'ti'));
}
