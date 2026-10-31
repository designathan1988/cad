// The footer as drawn each frame: what to do now, the keys that work now, the measure field and the
// wall tool's arc and rectangle modes on the ribbon (chrome.ts calls it).

import { lengthText, typingExamples } from '../i18n/units';
import { ruleBase } from '../elements/opening/tool';
import { OPENING_PREVIEW_ID, ruleText } from '../elements/opening/aim';
import { type MessageKey, num, t } from '../i18n/messages';
import { keyHint } from './shell';
import { wallNumber } from '../project/doc';
import { signedArea } from '../elements/room/derive';
import { type App } from '../session/app';
import { objectName } from './ribbon';
import { currentDims } from './temp-dims';
import { measureHint } from './float-bar';
import { guideOffset } from '../elements/guide/tool-ui';
import * as appPlacing from '../session/app-placing';
import * as appView from '../session/app-view';
import { ceilingOf, holeOf, pointsOf } from '../elements/tool-draft';
import { pointBusy, pointTool } from '../session/point-tools';

export function renderFooter(app: App): void {
  const { ui, shell } = app;
  // Footer: what to do now, the keys that work now, and the measure field.
  const drawing = ui.tool === 'wall';
  // A beam, a separator, a curtain wall, a guardrail, a roof, a stair: their line and keys (point-tools.ts).
  const pointing = pointTool(app);
  const w = ui.wall;
  const arc = w.kind !== 'rect' && w.arc === true;
  const rect = w.kind === 'rect' || (w.kind === 'idle' && w.rect === true);
  const d = ui.drag;
  const hintKey: MessageKey = drawing
    ? w.kind === 'rect'
      ? 'hint.rectEnd'
      : w.kind === 'bend'
      ? 'hint.arcBend'
      : w.kind === 'idle'
        ? rect
          ? 'hint.rectStart'
          : arc
          ? 'hint.arcStart'
          : 'hint.wallStart'
        : arc
          ? 'hint.arcEnd'
          : w.count >= 2
            ? 'hint.wallNextClose'
            : 'hint.wallNext'
    : d?.kind === 'slide'
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
  const openingHint = placing
    ? ui.opening.kind === 'aiming'
      ? appPlacing.previewProblem(app) ??
        t(app.geometry.openings.get(OPENING_PREVIEW_ID)?.warnings.includes('openingSwingClash') ? 'hint.openingAimClash' : 'hint.openingAim', {
          rule: ruleText(ui.opening.rule, ruleBase(ui.opening.aim, ui.opening.rule)),
        })
      : t('hint.openingPlace', { kind: t(placing === 'door' ? 'panel.door' : 'panel.window').toLowerCase() })
    : null;
  const toolHint =
    ui.tool === 'split'
      ? t('hint.split')
      : ui.tool === 'corner'
      ? t(ui.selection.size === 0 ? 'hint.corner1' : 'hint.corner2')
      : ui.tool === 'room'
      ? ui.roomSpace
        ? t(ui.tapToConfirm ? 'hint.roomTapAgain' : 'hint.roomHere', { area: num(Math.abs(signedArea(ui.roomSpace))) })
        : t('hint.roomPlace')
      : ui.tool === 'floor'
        ? holeOf(ui.draft)
          ? t('hint.holeStart')
          : ceilingOf(ui.draft)
            ? t(pointsOf(ui.draft, 'floor').length > 0 ? 'hint.floorNext' : 'hint.ceilingPlace')
            : t(pointsOf(ui.draft, 'floor').length > 0 ? 'hint.floorNext' : 'hint.floorPlace', { key: app.keyName('tool.floor') })
        : ui.tool === 'measure'
          ? measureHint(app)
          : ui.tool === 'object'
            ? t('hint.object', { name: objectName(app) })
            : pointing
              ? t(pointing.hint(app))
              : null;
  const guideHint = ui.guide
    ? t('hint.guide', {
        d: lengthText(guideOffset(app) ?? 0),
        base: ui.guide.base.wallId ? t('guide.fromWall', { n: wallNumber(app.store.get(), ui.guide.base.wallId) ?? '' }) : t('guide.fromGuide'),
      })
    : null;
  const mod = ui.tool === 'modify' ? ui.modify : null;
  const modifyHint = mod ? t(`hint.modify.${mod.kind === 'copy' ? 'move' : mod.kind}.${mod.state.step}` as MessageKey) : null;
  shell.instr.textContent = ui.error ?? guideHint ?? modifyHint ?? ui.info ?? openingHint ?? toolHint ?? t(hintKey, { n: ui.selection.size });
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
  const keys = ui.guide
    ? [keyHint('Enter', t('key.placeGuide')), keyHint('Esc', t('key.cancel'))]
    : ui.tool === 'split' || ui.tool === 'corner'
    ? [keyHint('Esc', t('key.exit'))]
    : mod
    ? [
        keyHint('C', t(mod.copy ? 'key.copyOn' : 'key.copyOff')),
        ...(mod.kind === 'move' && !mod.copy ? [keyHint('U', t(mod.disjoin ? 'key.disjoinOn' : 'key.disjoinOff'))] : []),
        // Offset has no centre and no angle: its distance is square to the wall.
        ...(mod.state.step === 'base' && mod.kind !== 'move' && mod.kind !== 'copy' && mod.kind !== 'offset' ? [keyHint('Enter', t('key.centre'))] : []),
        ...(mod.kind !== 'offset' ? [keyHint('Shift', t('key.straight')), ...lockKeys] : []),
        ...snapKeys,
        keyHint('Esc', t(mod.state.step === 'base' ? 'key.exit' : 'key.back')),
      ]
    : placing && appPlacing.placesLeaf(app, placing)
    ? [keyHint(t('key.spaceKey'), t('key.flipSwing')), keyHint('H', t('key.flipHinge')), keyHint('Esc', t('key.exit'))]
    : placing || ui.tool === 'room'
    ? [keyHint('Esc', t('key.exit'))]
    : ui.tool === 'object'
    ? [keyHint(t('key.spaceKey'), t('key.turn90')), ...snapKeys, keyHint('Esc', t('key.exit'))]
    : pointing
    ? [
        ...(pointing.enterShown ? [keyHint('Enter', t('key.finish'))] : []),
        ...(pointing.straight !== false ? [keyHint('Shift', t('key.straight')), ...lockKeys] : []),
        ...snapKeys,
        keyHint('Esc', t(pointBusy(app, pointing) ? pointing.escapeIs : 'key.exit')),
      ]
    : ui.tool === 'measure'
    ? [
        keyHint('C', t(ui.measureMode === 'chain' ? 'key.measureDistance' : 'key.measureChain')),
        ...(ui.measure.kind === 'chain' ? [keyHint('Enter', t('key.finish'))] : []),
        keyHint('Shift', t('key.straight')), ...lockKeys,
        ...altGuide,
        ...snapKeys,
        keyHint('Esc', t(ui.measure.kind === 'idle' ? 'key.exit' : 'key.clearMeasure')),
      ]
    : ui.tool === 'floor'
    ? [keyHint('Enter', t('key.finish')), ...altGuide, ...snapKeys, keyHint('Esc', t('key.exit'))]
    : drawing && w.kind === 'rect'
    ? [keyHint('Q', t('key.rectOff')), keyHint(t('key.spaceKey'), t(ui.wallFlip ? 'key.flipSideOn' : 'key.flipSide')), ...snapKeys, keyHint('Esc', t('key.back'))]
    : drawing
    ? w.kind !== 'idle'
      ? [
          keyHint('Enter', t('key.finish')),
          ...(w.kind === 'drawing' && w.count > 0 ? [keyHint('⌫', t('key.undoSegment'))] : []),
          // What the key does now: with the arc on, it goes back to straight walls.
          keyHint('A', t(arc || w.kind === 'bend' ? 'key.arcOff' : 'key.arc')),
          keyHint(t('key.spaceKey'), t(ui.wallFlip ? 'key.flipSideOn' : 'key.flipSide')),
          keyHint('Shift', t('key.straight')), ...lockKeys,
          ...altGuide,
          ...snapKeys,
          keyHint('Esc', t('key.finish')),
        ]
      : [
          // Each key says what it does now: with the rectangle on, Q went on saying "rectangle".
          keyHint('A', t(arc ? 'key.arcOff' : 'key.arc')),
          keyHint('Q', t(rect ? 'key.rectOff' : 'key.rect')),
          keyHint(t('key.spaceKey'), t(ui.wallFlip ? 'key.flipSideOn' : 'key.flipSide')),
          ...altGuide,
          ...snapKeys,
          keyHint('Esc', t('key.exit')),
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
  // The wall tool's arc and rectangle modes, pressed on the ribbon while on.
  shell.ribbon.querySelector('[data-action="tool.arcWall"]')?.setAttribute('aria-pressed', String(drawing && arc));
  shell.ribbon.querySelector('[data-action="tool.rectWall"]')?.setAttribute('aria-pressed', String(drawing && rect));
}
