// The tools drawn by clicking points or placed by one click (a beam, a separator, a curtain wall, a
// guardrail, a roof, a stair, an axis, a section, a callout, a guide, a column, a text, a level mark, a
// calibration, a dimension mark): each one's steps in one place, read by the pointer (pointer-release.ts,
// pointer-aim.ts), the keys (input-keys.ts), the footer (ui/footer.ts) and the drawing (ui/plan-overlay.ts).
// They were a branch of five chains in four files, and one changed in one chain and not another behaved
// differently there (F-0023). What each holds while it draws is the tool draft (elements/tool-draft.ts).

import type { Point2 } from '../model/vector';
import type { MessageKey } from '../i18n/messages';
import type { ToolId } from '../ui/shell';
import type { App } from './app';
import { drawFrom, drawPoints, type FromTool, fromOf, pointsOf } from '../elements/tool-draft';
import { addLevelMarkHere, addNoteHere, beamClick, columnClick, curtainClick, railingClick, railingFinish, roofClick, roofFinish, separatorClick, stairClick } from './kind-tools';
import { gridClick, markClick } from './annotation-tools';
import { calloutClick, sectionClick } from './section-tools';
import { guideClick } from '../elements/guide/tool-ui';
import { calibrateClick } from '../ui/reference-tool';

export interface PointTool {
  /** Where a click lands: on what the 3D shows too (a beam on a slab), on the plan's floor in either
   * view, or on the plan's floor in the plan view only (the 3D does nothing). */
  readonly aim: '3d' | 'plan' | 'planView';
  /** The points fixed so far: the snaps and the line drawn run from the last. */
  readonly points: (app: App) => readonly Point2[];
  /** Whether the tape (lengths, Shift straight, the axis locks) runs from the last point; a section
   * and a callout never had it. */
  readonly tape?: false;
  /** Whether the plan draws the line being drawn from the points; an axis, a section and a callout
   * draw their own. */
  readonly drafted?: false;
  /** Whether the footer offers Shift and the axis locks (a callout's leader takes none). */
  readonly straight?: false;
  /** `p` where it snapped, `raw` where the pointer is (a radius mark takes the arc's own point). */
  readonly click: (app: App, p: Point2, mpp: number, raw: Point2) => void;
  /** The line drawn when it is not the points and the pointer in order (an angle mark's arms). */
  readonly draft?: (app: App, at: Point2 | null) => Point2[] | null;
  /** Whether something is under way, for Esc and a right click: its points when not set (a dimension
   * placing its line has none left to place but is not done). */
  readonly busy?: (app: App) => boolean;
  /** Esc with something under way (with nothing, Esc closes the tool). */
  readonly escape: (app: App) => void;
  /** Esc's name in the footer while something is drawn. */
  readonly escapeIs: 'key.back' | 'key.finish' | 'key.exit';
  /** Enter with something drawn; and whether the footer offers it. */
  readonly enter?: (app: App) => void;
  readonly enterShown?: true;
  /** A right click with something drawn, before any menu; when not set, the menu opens. */
  readonly rightClick?: (app: App) => void;
  /** The footer's line now. */
  readonly hint: (app: App) => MessageKey;
}

/** The footer's line before the first point, and after it. */
const steps = (start: MessageKey, next: MessageKey) => (app: App): MessageKey => (pointTool(app)!.points(app).length > 0 ? next : start);

/** A tool with one point fixed at a time (its draft's `at`): Esc lets go of it. */
const fromPoint = (tool: FromTool) => ({
  points: (app: App) => {
    const p = fromOf(app.ui.draft, tool);
    return p ? [p] : [];
  },
  escape: (app: App) => {
    app.ui.draft = drawFrom(tool, null);
    app.render();
  },
});

/** A beam, a separator and a curtain wall: two points each, one after the other; Esc, Enter or a right click drops the first. */
const twoPoints = (click: (app: App, p: Point2) => void, aim: PointTool['aim'], hint: PointTool['hint']): PointTool => {
  const { points, escape } = fromPoint('beam');
  return { aim, points, click: (app, p) => click(app, p), escape, escapeIs: 'key.finish', enter: escape, rightClick: escape, hint };
};

/** A tool placed by one click (a column, a text, a level mark): nothing drawn first, Esc closes it. */
const oneClick = (aim: PointTool['aim'], click: (app: App, p: Point2) => void, hint: MessageKey): PointTool => ({
  aim,
  points: () => [],
  tape: false,
  straight: false,
  click: (app, p) => click(app, p),
  escape: (app) => app.setTool('select'),
  escapeIs: 'key.exit',
  hint: () => hint,
});

/** A mark's last point taken back. */
const markBack = (app: App): void => {
  app.ui.draft = drawPoints(app.ui.draft, 'mark', pointsOf(app.ui.draft, 'mark').slice(0, -1));
  app.render();
};

export const POINT_TOOLS: Partial<Record<ToolId, PointTool>> = {
  // Two points, then where its line goes (annotation-tools.ts holds the steps).
  dimension: {
    aim: 'plan',
    points: (app) => (app.ui.dimension.kind === 'from' ? [app.ui.dimension.a] : []),
    busy: (app) => app.ui.dimension.kind !== 'idle',
    drafted: false,
    click: (app, p) => app.dimensionEvent({ kind: 'click', point: p }),
    escape: (app) => app.dimensionEvent({ kind: 'escape' }),
    escapeIs: 'key.back',
    rightClick: (app) => app.dimensionEvent({ kind: 'escape' }),
    hint: (app) => {
      const kind = app.ui.dimension.kind;
      return kind === 'idle' ? 'hint.dimensionStart' : kind === 'from' ? 'hint.dimensionEnd' : 'hint.dimensionPlace';
    },
  },
  column: oneClick('3d', columnClick, 'hint.columnPlace'),
  // Then selected, its text ready to type.
  note: oneClick('plan', (app, p) => addNoteHere(app, p), 'hint.notePlace'),
  levelMark: oneClick('plan', (app, p) => addLevelMarkHere(app, p), 'hint.levelMarkPlace'),
  calibrate: {
    aim: 'planView',
    points: (app) => (app.ui.calibrate?.a ? [app.ui.calibrate.a] : []),
    tape: false,
    drafted: false,
    straight: false,
    click: (app, p) => calibrateClick(app, p),
    // Esc leaves the tool, its first point or not.
    escape: (app) => {
      app.ui.calibrate = null;
      app.setTool('select');
    },
    escapeIs: 'key.exit',
    hint: steps('hint.calibrateFirst', 'hint.calibrateSecond'),
  },
  mark: {
    aim: 'planView',
    points: (app) => pointsOf(app.ui.draft, 'mark'),
    tape: false,
    straight: false,
    // A radius mark goes where the arc is aimed at, not where it would snap.
    click: (app, p, _mpp, raw) => markClick(app, app.ui.markMode === 'radius' ? raw : p),
    // An angle's two arms meet at the vertex (its first point).
    draft: (app, at) => {
      const d = pointsOf(app.ui.draft, 'mark');
      if (!at) return null;
      return d.length === 2 && app.ui.markMode === 'angle' ? [d[1]!, d[0]!, at] : [d[0]!, at];
    },
    escape: markBack,
    escapeIs: 'key.back',
    rightClick: markBack,
    hint: (app) => {
      const markMode = app.ui.markMode;
      const n = pointsOf(app.ui.draft, 'mark').length;
      if (markMode === 'radius') return 'hint.markRadius';
      if (markMode === 'coord') return n === 0 ? 'hint.markCoordPoint' : 'hint.markCoordLabel';
      return n === 0 ? 'hint.markAngleVertex' : n === 1 ? 'hint.markAngleArm1' : 'hint.markAngleArm2';
    },
  },
  beam: twoPoints(beamClick, '3d', steps('hint.beamStart', 'hint.beamEnd')),
  separator: twoPoints(separatorClick, 'plan', steps('hint.separatorStart', 'hint.separatorEnd')),
  curtain: twoPoints(curtainClick, 'plan', steps('hint.curtainStart', 'hint.curtainEnd')),
  railing: {
    aim: '3d',
    points: (app) => pointsOf(app.ui.draft, 'railing'),
    click: (app, p, mpp) => railingClick(app, p, mpp),
    // Esc, Enter and a right click all end the path, keeping what was drawn.
    escape: railingFinish,
    escapeIs: 'key.finish',
    enter: railingFinish,
    enterShown: true,
    rightClick: railingFinish,
    hint: steps('hint.railingStart', 'hint.railingNext'),
  },
  roof: {
    aim: 'plan',
    points: (app) => pointsOf(app.ui.draft, 'roof'),
    click: (app, p, mpp) => roofClick(app, p, mpp),
    // Esc drops the outline; Enter and a right click close it into a roof.
    escape: (app) => {
      app.ui.draft = drawPoints(app.ui.draft, 'roof', []);
      app.render();
    },
    escapeIs: 'key.back',
    enter: roofFinish,
    enterShown: true,
    rightClick: roofFinish,
    hint: steps('hint.roofStart', 'hint.roofNext'),
  },
  stair: {
    aim: '3d',
    ...fromPoint('stair'),
    click: (app, p) => stairClick(app, p),
    escapeIs: 'key.back',
    hint: steps('hint.stairStart', 'hint.stairDirection'),
  },
  grid: {
    aim: 'planView',
    ...fromPoint('grid'),
    drafted: false,
    click: (app, p) => gridClick(app, p),
    escapeIs: 'key.back',
    rightClick: (app) => fromPoint('grid').escape(app),
    hint: steps('hint.gridStart', 'hint.gridEnd'),
  },
  section: {
    aim: 'planView',
    ...fromPoint('section'),
    tape: false,
    drafted: false,
    click: (app, p) => sectionClick(app, p),
    escapeIs: 'key.back',
    rightClick: (app) => fromPoint('section').escape(app),
    hint: steps('hint.sectionStart', 'hint.sectionEnd'),
  },
  callout: {
    aim: 'planView',
    ...fromPoint('callout'),
    tape: false,
    drafted: false,
    straight: false,
    click: (app, p) => calloutClick(app, p),
    escapeIs: 'key.back',
    rightClick: (app) => fromPoint('callout').escape(app),
    hint: steps('hint.calloutPoint', 'hint.calloutText'),
  },
  guide: {
    aim: 'planView',
    ...fromPoint('guide'),
    click: (app, p) => guideClick(app, p),
    escapeIs: 'key.back',
    // A point guide in one click; a circle from its centre out; a line through two points.
    hint: (app) => {
      const from = fromOf(app.ui.draft, 'guide');
      if (app.ui.guideMode === 'point') return 'hint.guidePoint';
      if (app.ui.guideMode === 'circle') return from ? 'hint.guideRadius' : 'hint.guideCentre';
      return from ? 'hint.guideSecond' : 'hint.guideFirst';
    },
  },
};

/** The point tool in use, with something drawn or not. */
export const pointTool = (app: App): PointTool | undefined => POINT_TOOLS[app.ui.tool];

/** Whether the tool has something under way: Esc and a right click take it back first. */
export const pointBusy = (app: App, tool: PointTool): boolean => (tool.busy ? tool.busy(app) : tool.points(app).length > 0);

/** Where the tape runs from: the tool's last point. */
export const pointTape = (app: App): Point2 | null => {
  const tool = pointTool(app);
  return tool && tool.tape !== false ? (tool.points(app).at(-1) ?? null) : null;
};

/** What the tool draws: its points and, with the pointer in the view, the one it would add. */
export function pointDraft(app: App): Point2[] | null {
  const tool = pointTool(app);
  if (!tool || tool.drafted === false) return null;
  const points = tool.points(app);
  if (points.length === 0) return null;
  const at = app.ui.snap?.point ?? app.ui.cursor;
  if (tool.draft) return tool.draft(app, at);
  return [...points, ...(at ? [at] : [])];
}
