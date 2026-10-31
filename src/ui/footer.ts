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

export function renderFooter(app: App): void {
  const { ui, shell } = app;
  // Footer: what to do now, the keys that work now, and the measure field.
  const drawing = ui.tool === 'wall';
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
        ? ui.holeFor
          ? t('hint.holeStart')
          : ui.ceilingTool
            ? t(ui.floorDraft.length > 0 ? 'hint.floorNext' : 'hint.ceilingPlace')
            : t(ui.floorDraft.length > 0 ? 'hint.floorNext' : 'hint.floorPlace')
        : ui.tool === 'measure'
          ? measureHint(app)
          : ui.tool === 'dimension'
            ? t(ui.dimension.kind === 'idle' ? 'hint.dimensionStart' : ui.dimension.kind === 'from' ? 'hint.dimensionEnd' : 'hint.dimensionPlace')
            : ui.tool === 'grid'
              ? t(ui.gridFrom ? 'hint.gridEnd' : 'hint.gridStart')
              : ui.tool === 'section'
              ? t(ui.sectionFrom ? 'hint.sectionEnd' : 'hint.sectionStart')
              : ui.tool === 'callout'
              ? t(ui.calloutFrom ? 'hint.calloutText' : 'hint.calloutPoint')
              : ui.tool === 'calibrate'
              ? t(ui.calibrate?.a ? 'hint.calibrateSecond' : 'hint.calibrateFirst')
              : ui.tool === 'guide'
                ? t(ui.guideMode === 'point' ? 'hint.guidePoint' : ui.guideMode === 'circle' ? (ui.guideFrom ? 'hint.guideRadius' : 'hint.guideCentre') : ui.guideFrom ? 'hint.guideSecond' : 'hint.guideFirst')
              : ui.tool === 'column'
                ? t('hint.columnPlace')
                : ui.tool === 'object'
                  ? t('hint.object', { name: objectName(app) })
                : ui.tool === 'beam'
                  ? t(ui.beamFrom ? 'hint.beamEnd' : 'hint.beamStart')
                : ui.tool === 'separator'
                  ? t(ui.beamFrom ? 'hint.separatorEnd' : 'hint.separatorStart')
                : ui.tool === 'mark'
                  ? t(ui.markMode === 'radius' ? 'hint.markRadius' : ui.markMode === 'coord' ? (ui.markDraft.length === 0 ? 'hint.markCoordPoint' : 'hint.markCoordLabel') : ui.markDraft.length === 0 ? 'hint.markAngleVertex' : ui.markDraft.length === 1 ? 'hint.markAngleArm1' : 'hint.markAngleArm2')
                : ui.tool === 'curtain'
                  ? t(ui.beamFrom ? 'hint.curtainEnd' : 'hint.curtainStart')
                : ui.tool === 'note'
                  ? t('hint.notePlace')
                : ui.tool === 'levelMark'
                  ? t('hint.levelMarkPlace')
                  : ui.tool === 'roof'
                    ? t(ui.roofDraft.length > 0 ? 'hint.roofNext' : 'hint.roofStart')
                    : ui.tool === 'stair'
                      ? t(ui.stairFrom ? 'hint.stairDirection' : 'hint.stairStart')
                      : ui.tool === 'railing'
                        ? t(ui.railingDraft.length > 0 ? 'hint.railingNext' : 'hint.railingStart')
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
  const snapKey = keyHint('S', t(ui.snaps ? 'key.snapsOn' : 'key.snapsOff'));
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
        snapKey,
        keyHint('Esc', t(mod.state.step === 'base' ? 'key.exit' : 'key.back')),
      ]
    : placing && appPlacing.placesLeaf(app, placing)
    ? [keyHint(t('key.spaceKey'), t('key.flipSwing')), keyHint('H', t('key.flipHinge')), keyHint('Esc', t('key.exit'))]
    : placing || ui.tool === 'room'
    ? [keyHint('Esc', t('key.exit'))]
    : ui.tool === 'dimension'
    ? [keyHint('Shift', t('key.straight')), ...lockKeys, snapKey, keyHint('Esc', t(ui.dimension.kind === 'idle' ? 'key.exit' : 'key.back'))]
    : ui.tool === 'grid'
    ? [keyHint('Shift', t('key.straight')), ...lockKeys, snapKey, keyHint('Esc', t(ui.gridFrom ? 'key.back' : 'key.exit'))]
    : ui.tool === 'section'
    ? [keyHint('Shift', t('key.straight')), ...lockKeys, snapKey, keyHint('Esc', t(ui.sectionFrom ? 'key.back' : 'key.exit'))]
    : ui.tool === 'callout'
    ? [snapKey, keyHint('Esc', t(ui.calloutFrom ? 'key.back' : 'key.exit'))]
    : ui.tool === 'calibrate'
    ? [snapKey, keyHint('Esc', t('key.exit'))]
    : ui.tool === 'column'
    ? [snapKey, keyHint('Esc', t('key.exit'))]
    : ui.tool === 'guide'
    ? [keyHint('Shift', t('key.straight')), ...lockKeys, snapKey, keyHint('Esc', t(ui.guideFrom ? 'key.back' : 'key.exit'))]
    : ui.tool === 'object'
    ? [keyHint(t('key.spaceKey'), t('key.turn90')), snapKey, keyHint('Esc', t('key.exit'))]
    : ui.tool === 'beam' || ui.tool === 'separator' || ui.tool === 'curtain'
    ? [keyHint('Shift', t('key.straight')), ...lockKeys, snapKey, keyHint('Esc', t(ui.beamFrom ? 'key.finish' : 'key.exit'))]
    : ui.tool === 'mark'
    ? [snapKey, keyHint('Esc', t(ui.markDraft.length > 0 ? 'key.back' : 'key.exit'))]
    : ui.tool === 'stair'
    ? [keyHint('Shift', t('key.straight')), ...lockKeys, snapKey, keyHint('Esc', t(ui.stairFrom ? 'key.back' : 'key.exit'))]
    : ui.tool === 'railing'
    ? [keyHint('Enter', t('key.finish')), keyHint('Shift', t('key.straight')), ...lockKeys, snapKey, keyHint('Esc', t(ui.railingDraft.length > 0 ? 'key.finish' : 'key.exit'))]
    : ui.tool === 'roof'
    ? [keyHint('Enter', t('key.finish')), keyHint('Shift', t('key.straight')), ...lockKeys, snapKey, keyHint('Esc', t(ui.roofDraft.length > 0 ? 'key.back' : 'key.exit'))]
    : ui.tool === 'measure'
    ? [
        keyHint('C', t(ui.measureMode === 'chain' ? 'key.measureDistance' : 'key.measureChain')),
        ...(ui.measure.kind === 'chain' ? [keyHint('Enter', t('key.finish'))] : []),
        keyHint('Shift', t('key.straight')), ...lockKeys,
        ...altGuide,
        snapKey,
        keyHint('Esc', t(ui.measure.kind === 'idle' ? 'key.exit' : 'key.clearMeasure')),
      ]
    : ui.tool === 'floor'
    ? [keyHint('Enter', t('key.finish')), ...altGuide, snapKey, keyHint('Esc', t('key.exit'))]
    : drawing && w.kind === 'rect'
    ? [keyHint('Q', t('key.rectOff')), keyHint(t('key.spaceKey'), t(ui.wallFlip ? 'key.flipSideOn' : 'key.flipSide')), snapKey, keyHint('Esc', t('key.back'))]
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
          snapKey,
          keyHint('Esc', t('key.finish')),
        ]
      : [
          // Each key says what it does now: with the rectangle on, Q went on saying "rectangle".
          keyHint('A', t(arc ? 'key.arcOff' : 'key.arc')),
          keyHint('Q', t(rect ? 'key.rectOff' : 'key.rect')),
          keyHint(t('key.spaceKey'), t(ui.wallFlip ? 'key.flipSideOn' : 'key.flipSide')),
          ...altGuide,
          snapKey,
          keyHint('Esc', t('key.exit')),
        ]
    : ui.selection.size > 0
      ? [
          keyHint('Shift', t('key.addRemove')),
          // Said before the drag, where it is decided: during it was too late to be found.
          ...(app.selectedWalls().length > 0 ? [keyHint('Alt', t('key.dragAlone'))] : []),
          ...(appPlacing.selectedDoor(app) ? [keyHint(t('key.spaceKey'), t('key.flipSwing')), keyHint('H', t('key.flipHinge'))] : []),
          keyHint('Del', t('key.delete')),
          keyHint('F', t('key.frame')),
          keyHint('Esc', t('key.clear')),
        ]
      : ui.view === '3d'
        ? // In 3D a left drag selects by window, as in plan: how to turn the view was nowhere on screen.
          [keyHint(t('key.rightDrag'), t('key.orbit')), keyHint(t('key.middleDrag'), t('key.pan')), keyHint('Ctrl K', t('key.commands')), keyHint('?', t('key.shortcuts'))]
        : [keyHint('Ctrl K', t('key.commands')), keyHint('Ctrl A', t('key.selectAll')), keyHint('?', t('key.shortcuts'))];
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
