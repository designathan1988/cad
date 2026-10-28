// The tools drawn by clicking points or placed by one click (a beam, a separator, a curtain wall, a
// guardrail, a roof, a stair, an axis, a section, a callout, a guide, a column, a text, a level mark, a
// calibration, a dimension mark): each one's steps in one place, read by the pointer (input.ts), the keys
// (input-keys.ts), the footer (chrome.ts) and the drawing (frame.ts). They were a branch of five chains
// in four files, and one changed in one chain and not another behaved differently there (F-0023).

import type { Point2 } from '../core/vector';
import type { MessageKey } from '../ui/i18n';
import type { ToolId } from '../ui/shell';
import type { App } from './app';

export interface PointTool {
  /** Where a click lands: on what the 3D shows too (a beam on a slab), on the plan's floor in either
   * view, or on the plan's floor in the plan view only (the 3D does nothing). */
  readonly aim: '3d' | 'plan' | 'planView';
  /** The points fixed so far: the snaps and the line drawn run from the last. */
  readonly points: (app: App) => readonly Point2[];
  /** Whether the tape (lengths, Shift straight, the axis locks) runs from the last point; a section
   * and a callout never had it. */
  readonly tape?: false;
  /** Whether frame.ts draws the line being drawn from the points; an axis, a section and a callout
   * draw their own. */
  readonly drafted?: false;
  /** Whether the footer offers Shift and the axis locks (a callout's leader takes none). */
  readonly straight?: false;
  /** `p` where it snapped, `raw` where the pointer is (a radius mark takes the arc's own point). */
  readonly click: (app: App, p: Point2, mpp: number, raw: Point2) => void;
  /** The line drawn when it is not the points and the pointer in order (an angle mark's arms). */
  readonly draft?: (app: App, at: Point2 | null) => Point2[] | null;
  /** Esc with something drawn (with nothing, Esc closes the tool). */
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

/** A tool with one point fixed at a time (`from`): Esc lets go of it. */
const fromPoint = (from: 'beamFrom' | 'stairFrom' | 'gridFrom' | 'sectionFrom' | 'calloutFrom' | 'guideFrom') => ({
  points: (app: App) => {
    const p = app.ui[from];
    return p ? [p] : [];
  },
  escape: (app: App) => {
    app.ui[from] = null;
    app.render();
  },
});

/** A beam, a separator and a curtain wall: two points each, one after the other; Esc, Enter or a right click drops the first. */
const twoPoints = (click: (app: App, p: Point2) => void, aim: PointTool['aim'], hint: PointTool['hint']): PointTool => {
  const { points, escape } = fromPoint('beamFrom');
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

export const POINT_TOOLS: Partial<Record<ToolId, PointTool>> = {
  column: oneClick('3d', (app, p) => app.columnClick(p), 'hint.columnPlace'),
  // Then selected, its text ready to type.
  note: oneClick('plan', (app, p) => app.addNoteHere(p), 'hint.notePlace'),
  levelMark: oneClick('plan', (app, p) => app.addLevelMarkHere(p), 'hint.levelMarkPlace'),
  calibrate: {
    aim: 'planView',
    points: (app) => (app.ui.calibrate?.a ? [app.ui.calibrate.a] : []),
    tape: false,
    drafted: false,
    straight: false,
    click: (app, p) => app.calibrateClick(p),
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
    points: (app) => app.ui.markDraft,
    tape: false,
    straight: false,
    // A radius mark goes where the arc is aimed at, not where it would snap.
    click: (app, p, _mpp, raw) => app.markClick(app.ui.markMode === 'radius' ? raw : p),
    // An angle's two arms meet at the vertex (its first point).
    draft: (app, at) => {
      const d = app.ui.markDraft;
      if (!at) return null;
      return d.length === 2 && app.ui.markMode === 'angle' ? [d[1]!, d[0]!, at] : [d[0]!, at];
    },
    escape: (app) => {
      app.ui.markDraft = app.ui.markDraft.slice(0, -1);
      app.render();
    },
    escapeIs: 'key.back',
    rightClick: (app) => {
      app.ui.markDraft = app.ui.markDraft.slice(0, -1);
      app.render();
    },
    hint: (app) => {
      const { markMode, markDraft } = app.ui;
      if (markMode === 'radius') return 'hint.markRadius';
      if (markMode === 'coord') return markDraft.length === 0 ? 'hint.markCoordPoint' : 'hint.markCoordLabel';
      return markDraft.length === 0 ? 'hint.markAngleVertex' : markDraft.length === 1 ? 'hint.markAngleArm1' : 'hint.markAngleArm2';
    },
  },
  beam: twoPoints((app, p) => app.beamClick(p), '3d', steps('hint.beamStart', 'hint.beamEnd')),
  separator: twoPoints((app, p) => app.separatorClick(p), 'plan', steps('hint.separatorStart', 'hint.separatorEnd')),
  curtain: twoPoints((app, p) => app.curtainClick(p), 'plan', steps('hint.curtainStart', 'hint.curtainEnd')),
  railing: {
    aim: '3d',
    points: (app) => app.ui.railingDraft,
    click: (app, p, mpp) => app.railingClick(p, mpp),
    // Esc, Enter and a right click all end the path, keeping what was drawn.
    escape: (app) => app.railingFinish(),
    escapeIs: 'key.finish',
    enter: (app) => app.railingFinish(),
    enterShown: true,
    rightClick: (app) => app.railingFinish(),
    hint: steps('hint.railingStart', 'hint.railingNext'),
  },
  roof: {
    aim: 'plan',
    points: (app) => app.ui.roofDraft,
    click: (app, p, mpp) => app.roofClick(p, mpp),
    // Esc drops the outline; Enter and a right click close it into a roof.
    escape: (app) => {
      app.ui.roofDraft = [];
      app.render();
    },
    escapeIs: 'key.back',
    enter: (app) => app.roofFinish(),
    enterShown: true,
    rightClick: (app) => app.roofFinish(),
    hint: steps('hint.roofStart', 'hint.roofNext'),
  },
  stair: {
    aim: '3d',
    ...fromPoint('stairFrom'),
    click: (app, p) => app.stairClick(p),
    escapeIs: 'key.back',
    hint: steps('hint.stairStart', 'hint.stairDirection'),
  },
  grid: {
    aim: 'planView',
    ...fromPoint('gridFrom'),
    drafted: false,
    click: (app, p) => app.gridClick(p),
    escapeIs: 'key.back',
    rightClick: (app) => fromPoint('gridFrom').escape(app),
    hint: steps('hint.gridStart', 'hint.gridEnd'),
  },
  section: {
    aim: 'planView',
    ...fromPoint('sectionFrom'),
    tape: false,
    drafted: false,
    click: (app, p) => app.sectionClick(p),
    escapeIs: 'key.back',
    rightClick: (app) => fromPoint('sectionFrom').escape(app),
    hint: steps('hint.sectionStart', 'hint.sectionEnd'),
  },
  callout: {
    aim: 'planView',
    ...fromPoint('calloutFrom'),
    tape: false,
    drafted: false,
    straight: false,
    click: (app, p) => app.calloutClick(p),
    escapeIs: 'key.back',
    rightClick: (app) => fromPoint('calloutFrom').escape(app),
    hint: steps('hint.calloutPoint', 'hint.calloutText'),
  },
  guide: {
    aim: 'planView',
    ...fromPoint('guideFrom'),
    click: (app, p) => app.guideClick(p),
    escapeIs: 'key.back',
    // A point guide in one click; a circle from its centre out; a line through two points.
    hint: (app) => {
      const { guideMode, guideFrom } = app.ui;
      if (guideMode === 'point') return 'hint.guidePoint';
      if (guideMode === 'circle') return guideFrom ? 'hint.guideRadius' : 'hint.guideCentre';
      return guideFrom ? 'hint.guideSecond' : 'hint.guideFirst';
    },
  },
};

/** The point tool in use, with something drawn or not. */
export const pointTool = (app: App): PointTool | undefined => POINT_TOOLS[app.ui.tool];

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
