// The footer as drawn each frame: what to do now, the keys that work now and the measure field (chrome.ts calls it).

import { lengthText, typingExamples } from '../i18n/units';
import { type MessageKey, t } from '../i18n/messages';
import { keyHint } from './shell';
import { wallNumber } from '../project/doc';
import { type App } from '../session/app';
import { currentDims } from './temp-dims';
import { guideOffset } from '../elements/guide/tool-ui';
import * as appPlacing from '../session/app-placing';
import * as appView from '../session/app-view';
import { pointBusy, pointTool } from '../session/point-tools';
import { eventTool } from '../session/event-tools';

export function renderFooter(app: App): void {
  const { ui, shell } = app;
  // Footer: what to do now, the keys that work now, and the measure field.
  const drawing = ui.tool === 'wall';
  // A beam, a separator, a curtain wall, a guardrail, a roof, a stair: their line and keys (point-tools.ts).
  const pointing = pointTool(app);
  const w = ui.wall;
  const d = ui.drag;
  // The general line, with no tool's own (the wall's is event-tools.ts's): a drag, the selection.
  const hintKey: MessageKey =
    d?.kind === 'slide'
      ? 'hint.sliding'
      : d?.kind === 'move'
      ? 'hint.moving'
      : d?.kind === 'grip' || d?.kind === 'stretch' || d?.kind === 'rotate'
      ? 'hint.handle'
      : d?.kind === 'bulge'
        ? 'hint.bending'
      : d?.kind === 'marquee'
        ? d.b.x < d.a.x
          ? 'hint.marqueeCrossing'
          : 'hint.marqueeWindow'
        : ui.selection.size > 1
          ? // Of several kinds, the panel edits one of them (panel.ts): "edit them together" was not so.
            appView.selectionKinds(app) > 1
            ? 'hint.selectedMixed'
            : 'hint.selectedMany'
          : ui.selection.size === 1
            ? // "click a dimension" only where there is one: a room or a floor has none.
              ui.view === 'plan' && currentDims(app).length > 0
              ? 'hint.selected'
              : 'hint.selected3d'
            : 'hint.select';
  const placing = app.openingKind();
  const aiming = placing !== null && ui.opening.kind === 'aiming';
  // The tool's own line (event-tools.ts, point-tools.ts); Modify's before a note of the moment.
  const tool = eventTool(app);
  const own = tool?.hint(app) ?? null;
  const toolHint = tool ? (tool.first ? null : own) : pointing ? t(pointing.hint(app)) : null;
  const guideHint = ui.guide
    ? t('hint.guide', {
        d: lengthText(guideOffset(app) ?? 0),
        base: ui.guide.base.wallId ? t('guide.fromWall', { n: wallNumber(app.store.get(), ui.guide.base.wallId) ?? '' }) : t('guide.fromGuide'),
      })
    : null;
  const mod = ui.tool === 'modify' ? ui.modify : null;
  shell.instr.textContent = ui.error ?? guideHint ?? (tool?.first ? own : null) ?? ui.info ?? toolHint ?? t(hintKey, { n: ui.selection.size });
  shell.instr.classList.toggle('error', ui.error !== null);
  // Alt sets a guide in the tools that draw by points (input.ts), in plan.
  const altGuide = ui.view === 'plan' ? [keyHint('Alt', t('key.guide'))] : [];
  // S says what it is now, wherever points snap: drawing, it was nowhere in the footer, and the snaps
  // seemed impossible to turn off.
  // While a point is drawn from another: the arrows lock its direction.
  const lockKeys = ui.drawFrom ? [keyHint('→ ↑', t('key.lockAxis')), keyHint('← ↓', t('key.lockWall'))] : [];
  // An action's key as the user has it (actions.ts, keymap.ts): a key changed in the keys dialog is taught
  // here too; one turned off is not offered. The tools' own keys (C, Q, A, Enter, Esc in a tool…) are no
  // actions and cannot be changed.
  const actionKeys = new Map(app.actionList().flatMap((a) => (a.keys ? [[a.id, a.keys] as const] : [])));
  const actionHint = (id: string, what: string) => {
    const key = actionKeys.get(id);
    return key ? [keyHint(key, what)] : [];
  };
  const snapKeys = actionHint('settings.snaps', t(ui.snaps ? 'key.snapsOn' : 'key.snapsOff'));
  // The tool's keys (event-tools.ts, point-tools.ts), else the selection's, else the general ones.
  const keys = ui.guide
    ? [keyHint('Enter', t('key.placeGuide')), keyHint('Esc', t('key.cancel'))]
    : tool
    ? tool.keys(app, { lock: lockKeys, alt: altGuide, snap: snapKeys })
    : pointing
    ? [
        ...(pointing.enterShown ? [keyHint('Enter', t('key.finish'))] : []),
        ...(pointing.straight !== false ? [keyHint('Shift', t('key.straight')), ...lockKeys] : []),
        ...snapKeys,
        keyHint('Esc', t(pointBusy(app, pointing) ? pointing.escapeIs : 'key.exit')),
      ]
    : ui.selection.size > 0
      ? [
          keyHint('Shift', t('key.addRemove')),
          // Said before the drag, where it is decided: during it was too late to be found.
          ...(app.selectedWalls().length > 0 ? [keyHint('Alt', t('key.dragAlone'))] : []),
          ...(appPlacing.selectedDoor(app) ? [keyHint(t('key.spaceKey'), t('key.flipSwing')), ...actionHint('edit.flipHinge', t('key.flipHinge'))] : []),
          ...actionHint('edit.delete', t('key.delete')),
          ...actionHint('view.frameSelection', t('key.frame')),
          ...actionHint('edit.clearSelection', t('key.clear')),
        ]
      : ui.view === '3d'
        ? // In 3D a left drag selects by window, as in plan: how to turn the view was nowhere on screen.
          [keyHint(t('key.rightDrag'), t('key.orbit')), keyHint(t('key.middleDrag'), t('key.pan')), ...actionHint('help.commands', t('key.commands')), ...actionHint('help.shortcuts', t('key.shortcuts'))]
        : [...actionHint('help.commands', t('key.commands')), ...actionHint('edit.selectAll', t('key.selectAll')), ...actionHint('help.shortcuts', t('key.shortcuts'))];
  shell.keys.replaceChildren(...keys);
  const lengthMode = drawing && w.kind === 'drawing';
  // Where a point is asked for: the wall's start, a floor's corners, a room's point.
  const pointMode = (drawing && w.kind === 'idle') || ui.tool === 'floor' || ui.tool === 'room' || ui.tool === 'measure' || (lengthMode && shell.measure.value.includes(';'));
  const distanceMode = ui.guide !== null || (mod !== null && (mod.kind === 'move' || mod.kind === 'copy')) || aiming || (ui.selection.size === 1 && app.selectedOpenings().length === 1);
  const angleMode = mod !== null && (mod.kind === 'rotate' || mod.kind === 'mirror');
  const factorMode = mod !== null && mod.kind === 'scale';
  const withAngle = lengthMode && shell.measure.value.includes('<');
  const sidesMode = drawing && w.kind === 'rect';
  shell.measureLabel.textContent = t(
    sidesMode
      ? 'foot.sides'
      : angleMode
      ? 'foot.angle'
      : factorMode
      ? 'foot.factor'
      : ui.guide
      ? 'foot.distance'
      : drawing && w.kind === 'bend'
      ? 'foot.radius'
      : withAngle
        ? 'foot.lengthAngle'
        : pointMode
          ? 'foot.point'
          : lengthMode
            ? 'foot.length'
            : distanceMode
              ? 'foot.distance'
              : 'foot.measure',
  );
  // "Measure: Distance", but never "Measure: Measure".
  const what = shell.measureLabel.textContent ?? '';
  shell.measure.setAttribute('aria-label', what === t('foot.measure') ? what : `${t('foot.measure')}: ${what}`);
  shell.measure.placeholder = t(sidesMode ? 'foot.sidesHint' : angleMode ? 'foot.angleHint' : factorMode ? 'foot.factorHint' : ui.guide ? 'foot.distanceHint' : pointMode && !lengthMode ? 'foot.pointHint' : lengthMode ? 'foot.lengthHint' : distanceMode ? 'foot.distanceHint' : 'foot.measureHint', typingExamples());
}

