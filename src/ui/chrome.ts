// The interface around the views: the tool bar, the level list, the footer's hints and keys, the float bar, the browser drawer. Functions over the app (app.ts delegates).

import { distance } from '../model/vector';
import { words } from '../elements/object/fields';
import { angleNum, areaText, lengthText, typingExamples } from '../i18n/units';
import * as THREE from 'three';
import { type Point2 } from '../model/vector';
import { ruleBase } from '../elements/opening/tool';
import { angleAt, chainArea, chainLength, reading } from '../elements/measure/tool';
import { OPENING_PREVIEW_ID, ruleText } from '../elements/opening/aim';
import { getLang, name, num, t, type MessageKey } from '../i18n/messages';
import { icon } from '../i18n/icons';
import { el } from './controls';
import { keyHint } from './shell';
import { kindOfId, levelOfSolid } from '../elements/registry';
import { drawingOf, elementIds, wallNumber } from '../project/doc';
import { SCALES } from '../elements/drawing/schema';
import { boundsOf, openingOutline } from '../project/derive';
import { renderBrowser } from './browser';
import { renderVisibility } from './visibility-panel';
import { renderRibbonTab, renderRibbonTabs, type RibbonTab } from './ribbon';
import type { Action } from '../session/actions';
import { ribbonTabs } from './ribbon-tabs';
import { exploding, RENDER_QUALITIES, shownLevels, VISUAL_STYLES } from '../session/view/view-3d';
import { contextEntries } from '../session/context-menu';
import { placeBarY } from './bar-place';
import { signedArea } from '../elements/room/derive';
import type { App } from '../session/app';
import { EDIT_LEVELS } from '../session/app';

/** The parts the snaps divide a segment into, as the palette's (actions.ts). */
const SNAP_PARTS = [2, 3, 4, 5, 6, 8, 10];

export function renderBrowserDrawer(app: App): void {
  const { ui, shell } = app;
  shell.browser.hidden = !ui.browserOpen;
  shell.sidebar.setAttribute('aria-pressed', String(ui.browserOpen));
  if (!ui.browserOpen) return;
  const doc = app.store.get();
  // What the drawer shows: also the units (its Units item) and the materials (the types' thumbnails).
  // The layer combinations and the overrides too (its Layers section).
  const key = JSON.stringify([getLang(), ui.view, ui.levelId, [...ui.hidden], ui.refLines, ui.openingTags, ui.overridesOn, doc.levels, doc.wallTypes.map((x) => [x.id, x.name]), doc.walls.map((w) => w.wallTypeId), doc.views.map((v) => [v.id, v.name]), doc.units, doc.materials, doc.layerSets, (doc.overrides ?? []).length]);
  if (key === app.browserKey) return;
  app.browserKey = key;
  // Keep the focus on the same button across the rebuild.
  const focused = document.activeElement instanceof HTMLElement && shell.browser.contains(document.activeElement) ? [...shell.browser.querySelectorAll('button')].indexOf(document.activeElement as HTMLButtonElement) : -1;
  renderBrowser(app, shell.browser, () => app.openLevels(), () => app.openWallTypes(), () => app.openMaterials());
  if (focused >= 0) shell.browser.querySelectorAll('button')[focused]?.focus();
}

export function renderChrome(app: App): void {
  const { ui, shell, store } = app;
  const doc = store.get();
  shell.panelToggle.setAttribute('aria-pressed', String(!shell.panel.hidden));
  const projectName = doc.name || t('app.untitled');
  if (shell.projectName.textContent !== projectName) shell.projectName.textContent = projectName;
  // Where the project is kept: in this browser's database, else in its local storage.
  shell.savedNote.textContent = t(app.db ? 'top.savedHere' : 'top.savedLocal');
  document.title = `${projectName} · cad2`;
  shell.undo.disabled = !store.canUndo();
  shell.redo.disabled = !store.canRedo();
  shell.view3d.setAttribute('aria-pressed', String(ui.view === '3d'));
  shell.viewPlan.setAttribute('aria-pressed', String(ui.view === 'plan'));
  renderRibbon(app);
  shell.lang.textContent = getLang().toUpperCase();
  // Rewritten only when it changes: replacing the icon under the pointer between press and release
  // would cancel the click.
  const themeIcon = ui.theme === 'dark' ? 'sun' : 'moon';
  if (shell.theme.dataset.icon !== themeIcon) {
    shell.theme.innerHTML = icon(themeIcon);
    shell.theme.dataset.icon = themeIcon;
  }
  shell.snapBtn.setAttribute('aria-pressed', String(ui.snaps));
  shell.collideBtn.setAttribute('aria-pressed', String(ui.collisions));
  if (shell.snapParts.dataset.lang !== getLang()) {
    shell.snapParts.dataset.lang = getLang();
    shell.snapParts.replaceChildren(...SNAP_PARTS.map((n) => new Option(t('foot.parts', { n }), String(n))));
    shell.snapParts.title = t('foot.partsTip');
    shell.snapParts.setAttribute('aria-label', t('foot.partsTip'));
  }
  shell.snapParts.value = String(ui.snapParts);
  shell.snapParts.disabled = !ui.snaps;
  // The view's control bar: the 3D's groups in 3D, the plan's scale in plan; visibility in both.
  shell.only3d.hidden = ui.view !== '3d';
  shell.onlyPlan.hidden = ui.view === '3d';
  if (shell.planScale.select.dataset.lang !== getLang()) {
    shell.planScale.select.dataset.lang = getLang();
    shell.planScale.caption.textContent = t('vcb.scale');
    shell.planScale.box.title = t('vcb.scaleTip');
    shell.planScale.select.replaceChildren(...SCALES.map((d) => new Option(`1:${d}`, String(d))));
    shell.visBtn.querySelector('.label')!.textContent = t('vcb.visibility');
    shell.visBtn.title = t('vis.title');
    shell.shownReset.querySelector('.label')!.textContent = t('vcb.showAll');
    shell.shownReset.title = t('temp.reset');
  }
  shell.planScale.select.value = String(drawingOf(doc).scale);
  // The Visibility popover, drawn again only when what it shows changes (not on every pointer move).
  shell.visBtn.setAttribute('aria-expanded', String(!shell.visPanel.hidden));
  if (!shell.visPanel.hidden) {
    const visKey = JSON.stringify([getLang(), [...ui.hidden], ui.refLines, ui.openingTags, ui.overridesOn, doc.layerSets ?? [], (doc.overrides ?? []).length + (doc.roomOverrides ?? []).length]);
    if (shell.visPanel.dataset.key !== visKey) {
      shell.visPanel.dataset.key = visKey;
      renderVisibility(app, shell.visPanel);
    }
  } else delete shell.visPanel.dataset.key;
  shell.shownReset.hidden = ui.temp === null;
  for (const [mode, b] of Object.entries(shell.levelsShown)) b.setAttribute('aria-pressed', String(ui.view3d.levels === mode));
  // Pressed only while it spreads something: with one level shown it is off, and says why when clicked.
  const spread = exploding(doc.levels, ui.levelId, ui.view3d);
  const alone = shownLevels(doc.levels, ui.levelId, ui.view3d.levels).size < 2;
  shell.explode.setAttribute('aria-pressed', String(spread));
  shell.xray.setAttribute('aria-pressed', String(ui.view3d.xray));
  shell.box.setAttribute('aria-pressed', String(ui.view3d.box !== null));
  shell.ortho.setAttribute('aria-pressed', String(ui.view3d.ortho));
  shell.explode.setAttribute('aria-disabled', String(alone));
  shell.cut.setAttribute('aria-pressed', String(ui.view3d.cut));
  // The visual style and the quality: their lists filled in the interface's language, set to the view's.
  const { style, quality } = shell.look;
  if (style.select.dataset.lang !== getLang()) {
    style.select.dataset.lang = getLang();
    style.caption.textContent = t('view3d.styleLabel');
    quality.caption.textContent = t('view3d.qualityLabel');
    style.box.title = t('view3d.styleTip');
    quality.box.title = t('view3d.qualityTip');
    // Named on their own: on a narrow bar the captions go (styles.css, .view-bar).
    style.select.setAttribute('aria-label', t('view3d.styleLabel'));
    quality.select.setAttribute('aria-label', t('view3d.qualityLabel'));
    style.select.replaceChildren(...VISUAL_STYLES.map((v) => new Option(t(`view3d.style.${v}` as MessageKey), v)));
    quality.select.replaceChildren(...RENDER_QUALITIES.map((v) => new Option(t(`view3d.quality.${v}` as MessageKey), v)));
  }
  style.select.value = ui.view3d.style;
  quality.select.value = ui.view3d.quality;
  // The light's sliders, their captions and values (%), the panel open or not.
  const { light } = shell;
  light.button.querySelector('.label')!.textContent = t('view3d.light');
  light.button.title = t('view3d.lightTip');
  light.brightness.caption.textContent = t('view3d.brightness');
  light.sun.caption.textContent = t('view3d.sunStrength');
  for (const [s, v] of [[light.brightness, ui.view3d.brightness], [light.sun, ui.view3d.sun]] as const) {
    if (document.activeElement !== s.input) s.input.value = String(v);
    s.value.textContent = `${Math.round(v * 100)} %`;
  }
  light.button.setAttribute('aria-expanded', String(!light.panel.hidden));
  const levelKey = JSON.stringify([getLang(), doc.levels.map((l) => [l.id, l.name, l.elevation])]);
  if (shell.level.dataset.key !== levelKey) {
    const sorted = [...doc.levels].sort((a, b) => b.elevation - a.elevation);
    shell.level.replaceChildren(...sorted.map((l) => new Option(name(l.name), l.id)), new Option(t('levels.edit'), EDIT_LEVELS));
    shell.level.dataset.key = levelKey;
  }
  if (!doc.levels.some((l) => l.id === ui.levelId)) ui.levelId = doc.levels[0]!.id;
  shell.level.value = ui.levelId;
  // Gone once the wall tool is on: "press W" no longer applies, and the footer says what to click.
  // Only on an empty project: a column, a roof or a note drawn first is under it otherwise.
  shell.emptyHint.hidden = doc.walls.length > 0 || elementIds(doc).size > 0 || ui.tool !== 'select';
  // Hidden or isolated for a while: the drawing framed, and a way back, as Revit's cyan frame says.
  shell.viewport.classList.toggle('temp-view', ui.temp !== null);
  shell.tempChip.hidden = ui.temp === null;
  if (ui.temp) shell.tempLabel.textContent = t(ui.temp.mode === 'hide' ? 'temp.hidden' : 'temp.isolated', { n: ui.temp.ids.size });

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
            app.selectionKinds() > 1
            ? 'hint.selectedMixed'
            : 'hint.selectedMany'
          : ui.selection.size === 1
            ? // "click a dimension" only where there is one: a room or a floor has none.
              ui.view === 'plan' && app.currentDims().length > 0
              ? 'hint.selected'
              : 'hint.selected3d'
            : 'hint.select';
  const placing = app.openingKind();
  const aiming = placing !== null && ui.opening.kind === 'aiming';
  const openingHint = placing
    ? ui.opening.kind === 'aiming'
      ? app.previewProblem() ??
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
          ? app.measureHint()
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
        d: lengthText(app.guideOffset() ?? 0),
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
    : placing && app.placesLeaf(placing)
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
          ...(app.selectedDoor() ? [keyHint(t('key.spaceKey'), t('key.flipSwing')), keyHint('H', t('key.flipHinge'))] : []),
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
  shell.coords.textContent = ui.cursor ? `x ${lengthText(ui.cursor.x)}  y ${lengthText(ui.cursor.y)}` : '';
  shell.fitFoot();
  shell.fitViewBar();
  app.placeFloatBar();
}

/** The footer for the measure tool: what to click, or what the tape read. */
export function measureHint(app: App): string {
  const m = app.ui.measure;
  if (m.kind === 'idle') return t(app.ui.measureMode === 'chain' ? 'hint.chainStart' : 'hint.measureStart');
  if (m.kind === 'from') return t('hint.measureEnd');
  if (m.kind === 'chain') {
    // The stretches so far and the one to the pointer; the angle where the last two meet.
    const to = app.ui.snap?.point ?? app.ui.cursor;
    const pts = to ? [...m.points, to] : [...m.points];
    if (pts.length < 2) return t('hint.chainNext');
    const n = pts.length;
    const angle = n >= 3 ? angleAt(pts[n - 3]!, pts[n - 2]!, pts[n - 1]!) : null;
    return t(angle === null ? 'hint.chainSoFar' : 'hint.chainSoFarAngle', { total: lengthText(chainLength(pts, false)), n: n - 1, last: lengthText(distance(pts[n - 2]!, pts[n - 1]!)), a: angleNum(angle ?? 0) });
  }
  if (m.kind === 'chainDone') {
    if (m.closed) return t('hint.areaDone', { area: areaText(chainArea(m.points)), p: lengthText(chainLength(m.points, true)), n: m.points.length });
    return t('hint.chainDone', { total: lengthText(chainLength(m.points, false)), n: m.points.length - 1 });
  }
  const r = reading(m.a, m.b);
  return t('hint.measured', { d: lengthText(r.length), dx: lengthText(Math.abs(r.dx)), dy: lengthText(Math.abs(r.dy)), a: angleNum(r.angle) });
}

export function placeFloatBar(app: App): void {
  const bar = app.shell.floatBar;
  const entries = app.ui.selection.size > 0 ? contextEntries(app, () => app.openCommands()) : [];
  const key = `${getLang()}|${entries.map((e) => e.id).join(',')}`;
  if (key !== app.floatKey) {
    app.floatKey = key;
    bar.replaceChildren(
      ...entries.map((e) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'icon-btn';
        b.innerHTML = icon(e.icon);
        b.title = e.keys ? `${e.label} (${e.keys})` : e.label;
        b.setAttribute('aria-label', b.title);
        // The buttons outlive the selection they were made for (they are rebuilt only when the set of
        // actions changes): the action is looked up at the click, for what is selected then. Kept from
        // when the bar was built, "Centre" centred the window selected before.
        b.addEventListener('click', () => contextEntries(app, () => app.openCommands()).find((x) => x.id === e.id)?.run());
        return b;
      }),
    );
  }
  const box = app.ui.tool === 'select' && !app.ui.drag ? boundsOf(app.geometry, app.ui.selection) : null;
  bar.hidden = box === null;
  if (box === null) return;
  const vp = app.shell.viewport.getBoundingClientRect();
  let x: number;
  let yTop: number;
  let yBottom: number;
  if (app.ui.view === 'plan') {
    const a = app.plan.toScreen({ x: box.min.x, y: box.max.y });
    const b = app.plan.toScreen({ x: box.max.x, y: box.min.y });
    x = (a.x + b.x) / 2;
    yTop = a.y;
    yBottom = b.y;
  } else {
    // The selection's screen box: every vertex of its pieces, at the bottom and at the top.
    const xs: number[] = [];
    const ys: number[] = [];
    const project = (v: Point2, z: number) => {
      const p = new THREE.Vector3(v.x, z, -v.y).project(app.scene.camera);
      // Behind the camera a point projects mirrored: leave it out.
      if (p.z > 1) return;
      xs.push(((p.x + 1) / 2) * vp.width);
      ys.push(((1 - p.y) / 2) * vp.height);
    };
    for (const id of app.ui.selection) {
      // Each at its level's height in the view (lifted when exploded).
      const opening = app.geometry.openings.get(id);
      if (opening) {
        const up = app.lift(app.geometry.solids.get(opening.opening.wallId)?.wall.levelId ?? '');
        for (const v of openingOutline(opening)) [opening.bottom, opening.top].forEach((z) => project(v, z + up));
      }
      // The registry's with a height (a room at its level's floor, a floor): their outlines at both faces.
      const k = kindOfId(id);
      const s = k?.span ? app.geometry.kinds.get(k.key)?.get(id) : undefined;
      if (k?.span && s !== undefined) {
        const { bottom, top } = k.span(s);
        const up = app.lift(levelOfSolid(k, s) ?? app.ui.levelId);
        for (const v of k.outlines(s).flat()) [bottom, top].forEach((z) => project(v, z + up));
      }
      const solid = app.geometry.solids.get(id);
      if (!solid) continue;
      const up = app.lift(solid.wall.levelId);
      for (const piece of solid.pieces) {
        for (const v of piece.polygon) {
          for (const z of [solid.bottom, solid.top]) project(v, z + up);
        }
      }
    }
    // Nothing of the selection in front of the camera: no bar, rather than one at a stale place.
    if (xs.length === 0) {
      bar.hidden = true;
      return;
    }
    x = (Math.min(...xs) + Math.max(...xs)) / 2;
    yTop = Math.min(...ys);
    yBottom = Math.max(...ys);
  }
  const w = bar.offsetWidth || 104;
  const h = bar.offsetHeight || 36;
  // Never under the panel where it lies over the drawing (the sheet on a phone, the drawer on a tablet).
  const panel = app.shell.panel.hidden ? null : app.shell.panel.getBoundingClientRect();
  const covered = panel && panel.top > vp.top + 8 && panel.top < vp.bottom ? panel.top - vp.top : vp.height;
  const right = panel && panel.left > vp.left && panel.left < vp.right && panel.top <= vp.top + 8 ? panel.left - vp.left : vp.width;
  const left = Math.min(Math.max(8, x - w / 2), right - w - 8);
  // Never over a temporary dimension's value, a room's tag or a handle of the selection (bar-place.ts):
  // on a phone after F it sat on the handle at an arc's end (the tester's R04).
  const h0 = app.handles();
  const grip = (p: Point2) => ({ top: p.y - 12, bottom: p.y + 12, left: p.x - 12, right: p.x + 12 });
  const boxes = [
    ...[...h0.squares, ...h0.arrows, ...(h0.bulge ? [h0.bulge] : []), ...(h0.rotate ? [h0.rotate] : [])].map((x) => grip(x.at)),
    ...[...app.shell.dims.children].map((c) => c.getBoundingClientRect()).map((r) => ({ top: r.top - vp.top, bottom: r.bottom - vp.top, left: r.left - vp.left, right: r.right - vp.left })),
    ...(app.ui.view === 'plan' ? app.plan.labelBoxes.map((b) => ({ top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w })) : []),
  ];
  const y = placeBarY({ left, w, h }, { top: yTop, bottom: yBottom }, boxes, { h: covered });
  bar.style.left = `${left}px`;
  bar.style.top = `${Math.min(Math.max(8, y), covered - h - 8)}px`;
}

/**
 * The ribbon's tabs and the chosen tab's panels (ui/ribbon.ts), from the app's actions: drawn again only
 * when what they show changes (the tab, the language, an action's name, key, state or pressed state).
 */
export function renderRibbon(app: App): void {
  const { shell } = app;
  const list = app.actionList();
  const actions = new Map(list.map((a) => [a.id, a]));
  // The selection's own actions (the context menu's), for the contextual tab: ctx.<id>.
  if (app.ui.selection.size > 0)
    for (const e of contextEntries(app, () => app.openCommands())) actions.set(`ctx.${e.id}`, { id: `ctx.${e.id}`, label: e.label, group: 'edit', keywords: '', ...(e.keys ? { keys: e.keys } : {}), enabled: true, run: e.run });
  const all = ribbonTabs(app);
  // A placing tool's tab ("Place wall") is the tool strip over the drawing now, not a tab of the ribbon.
  const placing = app.ui.tool !== 'select';
  const placeTab = placing ? all.find((x) => x.context) : undefined;
  const tabs = all.filter((x) => x !== placeTab);
  if (!tabs.some((x) => x.id === app.ribbonTab) || app.ribbonTab === 'context') app.ribbonTab = tabs[0]!.id;
  // The selection's tab (Modify | Wall) is shown, coloured apart, but never brought forward on its own:
  // the ribbon jumped to it on every click on the model (R2). The floating bar and the right-click menu
  // carry the selection's commands; a click on the tab opens it, until the selection changes.
  const contextual = tabs.find((x) => x.context);
  const selected = `${app.ui.tool} ${[...app.ui.selection].join(' ')}`;
  if (!contextual || selected !== app.ribbonSelected) app.ribbonAway = true;
  app.ribbonSelected = selected;
  const shown = contextual && !app.ribbonAway ? contextual.id : app.ribbonTab;
  const tab = tabs.find((x) => x.id === shown)!;
  renderToolStrip(app, placeTab, actions);
  const states = tab.panels.flatMap((p) => p.items.map((i) => {
    const a = actions.get(i.id);
    return a ? [i.id, a.label, a.keys ?? '', a.enabled, i.pressed?.() ?? null] : [i.id];
  }));
  // The selection too: the buttons run the actions made for it (the context's close over its ids), and kept
  // from a selection of two, Distribute on three windows spread two of them.
  const key = JSON.stringify([getLang(), shown, selected, tabs.map((x) => x.text ?? x.id), states, tab.panels.map((p) => p.key ?? '')]);
  if (key === app.ribbonKey) return;
  app.ribbonKey = key;
  // Keep the focus on the same button, or in the same field, across the rebuild.
  const active = document.activeElement instanceof HTMLElement && shell.ribbon.contains(document.activeElement) ? document.activeElement : null;
  const focused = active?.dataset.action;
  const field = active?.closest<HTMLElement>('[data-rf]')?.dataset.rf;
  renderRibbonTabs(shell.tabs, tabs, shown, (id) => app.chooseRibbonTab(id), shell.fileMenu);
  renderRibbonTab(shell.ribbon, tab, actions);
  if (focused) shell.ribbon.querySelector<HTMLElement>(`[data-action="${focused}"]`)?.focus();
  else if (field) shell.ribbon.querySelector<HTMLElement>(`[data-rf="${field}"] input, [data-rf="${field}"] select, [data-rf="${field}"] button`)?.focus();
}

/**
 * The tool in use, over the top of the drawing: its name, its ways and types (the place tab's panels but
 * Select, which Esc and the way out stand for), and the way out. Drawn again only when what it shows changes.
 */
function renderToolStrip(app: App, tab: RibbonTab | undefined, actions: ReadonlyMap<string, Action>): void {
  const { shell, ui } = app;
  const on = ui.tool !== 'select';
  shell.toolStrip.hidden = !on;
  shell.toolDone.hidden = !on;
  if (!on) {
    delete shell.toolStrip.dataset.key;
    return;
  }
  const panels = (tab?.panels ?? []).filter((p) => p.title !== 'rib.p.select');
  const states = panels.flatMap((p) => p.items.map((i) => [i.id, actions.get(i.id)?.label ?? '', i.pressed?.() ?? null]));
  const key = JSON.stringify([getLang(), ui.tool, tab?.text ?? '', states]);
  if (shell.toolStrip.dataset.key === key) return;
  shell.toolStrip.dataset.key = key;
  shell.toolName.textContent = tab?.text ?? '';
  shell.toolName.hidden = !tab?.text;
  renderRibbonTab(shell.toolBody, { id: 'tool', title: 'rib.tab.context', panels }, actions);
  shell.toolDone.replaceChildren(el('span', { class: 'label' }, t('opt.finish')), el('span', { class: 'kbd' }, 'Esc'));
  shell.toolDone.title = t('opt.finishTip');
}

/** The object tool's definition, named in the interface's language. */
function objectName(app: App): string {
  const def = app.store.get().definitions.find((d) => d.id === app.ui.objectDef);
  return def ? words(def.name) : '';
}
