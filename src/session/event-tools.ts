// The tools with event machines of their own (the wall's, the measure's, Modify's, the opening's) and those
// placed by one click on what is there (a room, a floor, an object, a split, a corner): each one's steps in
// one place, read by the pointer (pointer-release.ts), the keys (input-keys.ts) and the footer (ui/footer.ts).
// They were a branch of each of those chains, as the point tools were before point-tools.ts (F-0023): one
// changed in one chain and not another behaved differently there.

import type { Point2 } from '../model/vector';
import { distance } from '../model/vector';
import { type MessageKey, num, t } from '../i18n/messages';
import { angleNum, areaText, lengthText } from '../i18n/units';
import { keyHint } from '../ui/shell';
import type { App } from './app';
import { wallAt } from '../project/derived-queries';
import type { pointerAim } from './pointer-aim';
import { aimAt, wallUnderRay } from '../elements/opening/aim';
import * as appView from './app-view';
import { insideRing, signedArea } from '../elements/room/derive';
import { toggleWallFlip, wallEvent } from '../elements/wall/tool-ui';
import { floorFinish, roomSpaceAt } from './room-tool';
import { objectClick } from './kind-tools';
import { cornerClick, selectionCentre, splitAt, toggleModifyCopy, toggleModifyDisjoin } from './modify';
import { ceilingOf, drawPoints, holeOf, pointsOf } from '../elements/tool-draft';
import { angleAt, chainArea, chainLength, reading } from '../elements/measure/tool';
import { words } from '../elements/object/fields';
import { ruleBase } from '../elements/opening/tool';
import { OPENING_PREVIEW_ID, ruleText } from '../elements/opening/aim';
import * as sceneCamera from '../render/scene-camera';
import * as appPlacing from './app-placing';
import * as appEdit from './app-edit';

/** Where a pointer event lands (pointer-aim.ts): on the plan's floor, on what the 3D shows, where it snaps. */
export type ToolAim = Pick<ReturnType<typeof pointerAim>, 'worldAt' | 'aimAt3d' | 'snapped' | 'splitSnap'>;

/** The footer's shared keys: the arrows' locks, Alt's guide, the snaps' S, as the user has them now. */
export interface FootKeys {
  readonly lock: readonly HTMLElement[];
  readonly alt: readonly HTMLElement[];
  readonly snap: readonly HTMLElement[];
}

export interface EventTool {
  /** A digit typed goes to the measure field (a length, a point, a distance), not to the shortcuts. */
  readonly typing?: true;
  /** Where it snaps is drawn, said as it is (plan-overlay.ts): drawing, measuring, modifying, dividing. */
  readonly snaps?: true;
  /** Esc and a right click end it before a drag or a guide under way (Modify's). */
  readonly first?: true;
  /** The pointer moved over the drawing: where it snaps, what it lights, the preview. `at`: on the plan's floor. */
  move(app: App, e: PointerEvent, aim: ToolAim, at: { p: Point2 } | null, pick: number): void;
  /** A left click that did not drag. `pick`: the distance in metres at which a wall is hit. */
  click(app: App, e: PointerEvent, aim: ToolAim, pick: number): void;
  /** A right click before any menu: true when it ended something. */
  rightClick?(app: App): boolean;
  escape(app: App): void;
  enter?(app: App): void;
  /** The tool's own keys (not actions, Shift up): true when it took the key. */
  key?(app: App, key: string, e: KeyboardEvent): boolean;
  /** The footer's line, or null for the general one. */
  hint(app: App): string | null;
  /** The footer's keys. */
  keys(app: App, k: FootKeys): HTMLElement[];
}

const exit = (): HTMLElement => keyHint('Esc', t('key.exit'));
const toSelect = (app: App) => app.setTool('select');
const space = (e: KeyboardEvent, run: () => void): boolean => (e.preventDefault(), run(), true);

/** The footer for the measure tool: what to click, or what the tape read. */
function measureHint(app: App): string {
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
    if (m.closed) return t('hint.areaDone', { area: ((a) => (a === null ? t('meas.crosses') : areaText(a)))(chainArea(m.points)), p: lengthText(chainLength(m.points, true)), n: m.points.length });
    return t('hint.chainDone', { total: lengthText(chainLength(m.points, false)), n: m.points.length - 1 });
  }
  const r = reading(m.a, m.b);
  return t('hint.measured', { d: lengthText(r.length), dx: lengthText(Math.abs(r.dx)), dy: lengthText(Math.abs(r.dy)), a: angleNum(r.angle) });
}

/**
 * The room and floor tools act on rooms: only the room under the pointer is lit, never a wall (lit, it looked
 * as if the click would take it); over closed walls with no room yet, the room a click makes there.
 */
function lightRoom(app: App, at: { p: Point2 } | null): void {
  const { ui } = app;
  const g = app.visibleGeometry();
  ui.hover = at && ui.view === 'plan' ? ([...g.rooms.values()].find((r) => r.enclosed && insideRing(r.outline, at.p))?.room.id ?? null) : null;
  ui.roomSpace = ui.tool === 'room' && at && ui.view === 'plan' && ui.hover === null ? roomSpaceAt(app, at.p) : null;
  app.render();
}

/** The object tool's definition, named in the interface's language. */
function objectName(app: App): string {
  const def = app.store.get().definitions.find((d) => d.id === app.ui.objectDef);
  return def ? words(def.name) : '';
}

const wall: EventTool = {
  typing: true,
  snaps: true,
  move: (app, e, aim) => {
    const s = aim.snapped(e);
    app.ui.snap = s;
    if (s && app.ui.wall.kind !== 'idle') return wallEvent(app, { kind: 'move', point: s.point });
    app.render();
  },
  click: (app, e, aim) => {
    const s = aim.snapped(e);
    if (s) wallEvent(app, { kind: 'click', point: s.point });
  },
  // A wall chain ends as Enter ends it: the walls drawn stay.
  rightClick: (app) => app.ui.wall.kind !== 'idle' && (wallEvent(app, { kind: 'enter' }), true),
  escape: (app) => (app.ui.wall.kind !== 'idle' ? wallEvent(app, { kind: 'escape' }) : toSelect(app)),
  enter: (app) => wallEvent(app, { kind: 'enter' }),
  // A (arc) and Q (rectangles of four walls, two corners: Revit's and ArchiCAD's), the second key of the
  // "W, A" and "W, Q" actions; Space, the body to the other side of the line (Revit's flip).
  key: (app, key, e) =>
    key === 'a' ? (wallEvent(app, { kind: 'arc' }), true) : key === 'q' ? (wallEvent(app, { kind: 'rect' }), true) : e.key === ' ' ? space(e, () => toggleWallFlip(app)) : false,
  hint: (app) => {
    const w = app.ui.wall;
    const arc = w.kind !== 'rect' && w.arc === true;
    const rect = w.kind === 'rect' || (w.kind === 'idle' && w.rect === true);
    return t(
      w.kind === 'rect' ? 'hint.rectEnd' : w.kind === 'bend' ? 'hint.arcBend' : w.kind === 'idle' ? (rect ? 'hint.rectStart' : arc ? 'hint.arcStart' : 'hint.wallStart') : arc ? 'hint.arcEnd' : w.count >= 2 ? 'hint.wallNextClose' : 'hint.wallNext',
    );
  },
  keys: (app, k) => {
    const { ui } = app;
    const w = ui.wall;
    const arc = w.kind !== 'rect' && w.arc === true;
    const rect = w.kind === 'rect' || (w.kind === 'idle' && w.rect === true);
    const flip = keyHint(t('key.spaceKey'), t(ui.wallFlip ? 'key.flipSideOn' : 'key.flipSide'));
    if (w.kind === 'rect') return [keyHint('Q', t('key.rectOff')), flip, ...k.snap, keyHint('Esc', t('key.back'))];
    if (w.kind !== 'idle')
      return [
        keyHint('Enter', t('key.finish')),
        ...(w.kind === 'drawing' && w.count > 0 ? [keyHint('⌫', t('key.undoSegment'))] : []),
        // What the key does now: with the arc on, it goes back to straight walls.
        keyHint('A', t(arc ? 'key.arcOff' : 'key.arc')),
        flip,
        keyHint('Shift', t('key.straight')),
        ...k.lock,
        ...k.alt,
        ...k.snap,
        keyHint('Esc', t('key.finish')),
      ];
    // Each key says what it does now: with the rectangle on, Q went on saying "rectangle".
    return [keyHint('A', t(arc ? 'key.arcOff' : 'key.arc')), keyHint('Q', t(rect ? 'key.rectOff' : 'key.rect')), flip, ...k.alt, ...k.snap, exit()];
  },
};

const floor: EventTool = {
  typing: true,
  snaps: true,
  // The outline's next corner where a click would put it: snapped, shown with its label; before the first,
  // the room under the pointer lit, as the room tool's.
  move: (app, e, aim, at) => {
    app.ui.snap = aim.snapped(e);
    if (pointsOf(app.ui.draft, 'floor').length > 0) return app.render();
    lightRoom(app, at);
  },
  // Inside a room (its floor) as clicked; a corner where it snaps.
  click: (app, e, aim) => {
    const at = aim.worldAt(e);
    if (at) app.floorClick(at.p, at.mpp, false, aim.snapped(e)?.point ?? at.p);
  },
  // An outline is closed from three corners, dropped before.
  rightClick: (app) => {
    const n = pointsOf(app.ui.draft, 'floor').length;
    if (n === 0) return false;
    if (n >= 3) floorFinish(app);
    else {
      app.ui.draft = drawPoints(app.ui.draft, 'floor', []);
      app.render();
    }
    return true;
  },
  escape: (app) => {
    if (pointsOf(app.ui.draft, 'floor').length === 0) return toSelect(app);
    app.ui.draft = drawPoints(app.ui.draft, 'floor', []);
    app.render();
  },
  enter: (app) => floorFinish(app),
  hint: (app) => {
    const drawn = pointsOf(app.ui.draft, 'floor').length > 0;
    return holeOf(app.ui.draft) ? t('hint.holeStart') : ceilingOf(app.ui.draft) ? t(drawn ? 'hint.floorNext' : 'hint.ceilingPlace') : t(drawn ? 'hint.floorNext' : 'hint.floorPlace', { key: app.keyName('tool.floor') });
  },
  keys: (_app, k) => [keyHint('Enter', t('key.finish')), ...k.alt, ...k.snap, exit()],
};

const room: EventTool = {
  typing: true,
  move: (app, _e, _aim, at) => lightRoom(app, at),
  click: (app, e, aim) => {
    const { ui } = app;
    const at = aim.worldAt(e);
    if (!at) return;
    // A finger does not hover: its first tap in a space shows the room it would make there, as the
    // pointer does before a click, and a second tap in that space makes it. One tap made it unseen.
    if (e.pointerType === 'touch' && ui.view === 'plan') {
      const space = roomSpaceAt(app, at.p);
      if (space && !(ui.tapToConfirm && ui.roomSpace && insideRing(ui.roomSpace, at.p))) {
        ui.roomSpace = space;
        ui.tapToConfirm = true;
        return app.render();
      }
    }
    ui.tapToConfirm = false;
    app.roomClick(at.p);
  },
  escape: toSelect,
  hint: (app) => {
    const { ui } = app;
    return ui.roomSpace ? t(ui.tapToConfirm ? 'hint.roomTapAgain' : 'hint.roomHere', { area: num(Math.abs(signedArea(ui.roomSpace))) }) : t('hint.roomPlace');
  },
  keys: () => [exit()],
};

const measure: EventTool = {
  typing: true,
  snaps: true,
  move: (app, e, aim) => {
    app.ui.snap = aim.snapped(e);
    app.render();
  },
  click: (app, e, aim) => {
    const at = aim.worldAt(e);
    if (at) app.measureEvent({ kind: 'click', point: aim.snapped(e)?.point ?? at.p });
  },
  rightClick: (app) => app.ui.measure.kind !== 'idle' && (app.measureEvent({ kind: 'escape' }), true),
  escape: (app) => (app.ui.measure.kind !== 'idle' ? app.measureEvent({ kind: 'escape' }) : toSelect(app)),
  // Measuring a chain: Enter ends it open; C switches between two points and a chain.
  enter: (app) => app.measureEvent({ kind: 'enter' }),
  key: (app, key) => key === 'c' && (appEdit.toggleMeasureMode(app), true),
  hint: measureHint,
  keys: (app, k) => [
    keyHint('C', t(app.ui.measureMode === 'chain' ? 'key.measureDistance' : 'key.measureChain')),
    ...(app.ui.measure.kind === 'chain' ? [keyHint('Enter', t('key.finish'))] : []),
    keyHint('Shift', t('key.straight')),
    ...k.lock,
    ...k.alt,
    ...k.snap,
    keyHint('Esc', t(app.ui.measure.kind === 'idle' ? 'key.exit' : 'key.clearMeasure')),
  ],
};

const modify: EventTool = {
  typing: true,
  snaps: true,
  first: true,
  // The result follows the pointer: a preview of the whole selection, copies included.
  move: (app, e, aim) => {
    app.ui.snap = aim.snapped(e);
    app.refresh();
  },
  click: (app, e, aim) => {
    const at = aim.aimAt3d(e);
    if (at) app.modifyEvent({ kind: 'click', point: aim.snapped(e)?.point ?? at.p });
  },
  rightClick: (app) => (toSelect(app), true),
  escape: (app) => app.modifyEvent({ kind: 'escape' }),
  // Enter before the first point of a turn, a scale or a mirror: the selection's centre.
  enter: (app) => {
    const m = app.ui.modify;
    if (m?.state.step !== 'base' || m.kind === 'offset') return;
    const c = selectionCentre(app);
    if (c) app.modifyEvent({ kind: 'click', point: c });
  },
  key: (app, key) => (key === 'c' ? (toggleModifyCopy(app), true) : key === 'u' ? (toggleModifyDisjoin(app), true) : false),
  hint: (app) => {
    const mod = app.ui.modify;
    return mod ? t(`hint.modify.${mod.kind === 'copy' ? 'move' : mod.kind}.${mod.state.step}` as MessageKey) : null;
  },
  keys: (app, k) => {
    const mod = app.ui.modify;
    if (!mod) return [];
    return [
      keyHint('C', t(mod.copy ? 'key.copyOn' : 'key.copyOff')),
      ...(mod.kind === 'move' && !mod.copy ? [keyHint('U', t(mod.disjoin ? 'key.disjoinOn' : 'key.disjoinOff'))] : []),
      // Offset has no centre and no angle: its distance is square to the wall.
      ...(mod.state.step === 'base' && mod.kind !== 'move' && mod.kind !== 'copy' && mod.kind !== 'offset' ? [keyHint('Enter', t('key.centre'))] : []),
      ...(mod.kind !== 'offset' ? [keyHint('Shift', t('key.straight')), ...k.lock] : []),
      ...k.snap,
      keyHint('Esc', t(mod.state.step === 'base' ? 'key.exit' : 'key.back')),
    ];
  },
};

const split: EventTool = {
  snaps: true,
  // Where the cut would go: on a wall's body or its middle, named.
  move: (app, e, aim) => {
    app.ui.snap = aim.splitSnap(e);
    app.render();
  },
  click: (app, e, aim, pick) => {
    const s = aim.splitSnap(e);
    const at = aim.aimAt3d(e);
    if (at) splitAt(app, s?.point ?? at.p, s?.wallId ?? (app.ui.view === 'plan' ? (wallAt(app.visibleGeometry(), at.p, undefined, pick) ?? undefined) : undefined));
  },
  escape: toSelect,
  hint: () => t('hint.split'),
  keys: () => [exit()],
};

const corner: EventTool = {
  // The wall a click would take, lit.
  move: (app, _e, _aim, at, pick) => {
    app.ui.hover = at && app.ui.view === 'plan' ? wallAt(app.visibleGeometry(), at.p, undefined, pick) : null;
    app.render();
  },
  click: (app, e, aim, pick) => {
    const at = aim.worldAt(e);
    if (at) cornerClick(app, app.ui.view === 'plan' ? wallAt(app.visibleGeometry(), at.p, undefined, pick) : sceneCamera.pick(app.scene, e.clientX, e.clientY));
  },
  // It lets go of its first wall first, then of itself.
  escape: (app) => {
    if (app.ui.selection.size === 0) return toSelect(app);
    app.ui.selection.clear();
    app.refresh();
  },
  hint: (app) => t(app.ui.selection.size === 0 ? 'hint.corner1' : 'hint.corner2'),
  keys: () => [exit()],
};

const object: EventTool = {
  // The object follows the pointer: derived again, as the Modify tools' previews are.
  move: (app, e, aim) => {
    app.ui.snap = aim.snapped(e);
    app.refresh();
  },
  click: (app, e, aim) => {
    const at = aim.aimAt3d(e);
    if (at) objectClick(app, aim.snapped(e)?.point ?? at.p);
  },
  escape: toSelect,
  // Space: the next object a quarter turn on.
  key: (app, _key, e) => e.key === ' ' && space(e, () => appPlacing.turnObject(app)),
  hint: (app) => t('hint.object', { name: objectName(app) }),
  keys: (_app, k) => [keyHint(t('key.spaceKey'), t('key.turn90')), ...k.snap, exit()],
};

/** A door or a window to place: aimed at a wall, placed by a click or Enter. */
const opening: EventTool = {
  typing: true,
  // In 3D, on the wall itself (its own hole does not let the aim through): wallUnderRay.
  move: (app, e, aim) => {
    const { ui } = app;
    const onWall = ui.view === 'plan' ? null : wallUnderRay(app.store.get(), new Set([ui.levelId]), app.scene.rayAt(e.clientX, e.clientY), (id) => appView.lift(app, id));
    const seen = onWall ? { p: onWall.p, mpp: sceneCamera.metresPerPixel(app.scene, onWall.p, onWall.height) } : aim.aimAt3d(e);
    app.openingEvent({ kind: 'hover', aim: seen ? aimAt(app.store.get(), app.geometry, ui.levelId, seen.p, seen.mpp, OPENING_PREVIEW_ID) : null });
  },
  click: (app) => app.openingEvent({ kind: 'click' }),
  escape: toSelect,
  // Enter places the opening where it is aimed, as a click there does.
  enter: (app) => {
    if (app.ui.opening.kind === 'aiming') app.openingEvent({ kind: 'click' });
  },
  hint: (app) => {
    const { ui } = app;
    const placing = app.openingKind();
    if (!placing) return null;
    if (ui.opening.kind !== 'aiming') return t('hint.openingPlace', { kind: t(placing === 'door' ? 'panel.door' : 'panel.window').toLowerCase() });
    return (
      appPlacing.previewProblem(app) ??
      t(app.geometry.openings.get(OPENING_PREVIEW_ID)?.warnings.includes('openingSwingClash') ? 'hint.openingAimClash' : 'hint.openingAim', {
        rule: ruleText(ui.opening.rule, ruleBase(ui.opening.aim, ui.opening.rule)),
      })
    );
  },
  keys: (app) => {
    const placing = app.openingKind();
    return placing && appPlacing.placesLeaf(app, placing) ? [keyHint(t('key.spaceKey'), t('key.flipSwing')), keyHint('H', t('key.flipHinge')), exit()] : [exit()];
  },
};

const TOOLS: Partial<Record<string, EventTool>> = { wall, floor, room, measure, modify, split, corner, object };

/** The tool in use when it is one of these (an opening's tool by its kind), else null. */
export function eventTool(app: App): EventTool | null {
  return app.openingKind() ? opening : (TOOLS[app.ui.tool] ?? null);
}
