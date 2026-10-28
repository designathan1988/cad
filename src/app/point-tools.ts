// The tools drawn by clicking points (a beam, a separator, a curtain wall, a guardrail, a roof, a stair):
// each one's steps in one place, read by the pointer (input.ts), the keys (input-keys.ts), the footer
// (chrome.ts) and the drawing (frame.ts). They were a branch of five chains in four files, and one
// changed in one chain and not another behaved differently there (F-0023).

import type { Point2 } from '../core/vector';
import type { MessageKey } from '../ui/i18n';
import type { ToolId } from '../ui/shell';
import type { App } from './app';

export interface PointTool {
  /** Where a click lands: on what the 3D shows too (a beam on a slab), or on the plan's floor only. */
  readonly aim: '3d' | 'plan';
  /** The points fixed so far: the tape, the snaps and the line drawn run from the last. */
  readonly points: (app: App) => readonly Point2[];
  readonly click: (app: App, p: Point2, mpp: number) => void;
  /** Esc with something drawn (with nothing, Esc closes the tool). */
  readonly escape: (app: App) => void;
  /** Esc's name in the footer while something is drawn. */
  readonly escapeIs: 'key.back' | 'key.finish';
  /** Enter with something drawn; and whether the footer offers it. */
  readonly enter?: (app: App) => void;
  readonly enterShown?: true;
  /** A right click with something drawn, before any menu; when not set, the menu opens. */
  readonly rightClick?: (app: App) => void;
  /** The footer's line: before the first point, and after it. */
  readonly hint: readonly [MessageKey, MessageKey];
}

/** A beam, a separator and a curtain wall: two points each, one after the other; Esc or Enter drops the first. */
const twoPoints = (click: (app: App, p: Point2) => void, aim: PointTool['aim'], hint: PointTool['hint']): PointTool => {
  const drop = (app: App) => {
    app.ui.beamFrom = null;
    app.render();
  };
  return { aim, points: (app) => (app.ui.beamFrom ? [app.ui.beamFrom] : []), click: (app, p) => click(app, p), escape: drop, escapeIs: 'key.finish', enter: drop, rightClick: drop, hint };
};

export const POINT_TOOLS: Partial<Record<ToolId, PointTool>> = {
  beam: twoPoints((app, p) => app.beamClick(p), '3d', ['hint.beamStart', 'hint.beamEnd']),
  separator: twoPoints((app, p) => app.separatorClick(p), 'plan', ['hint.separatorStart', 'hint.separatorEnd']),
  curtain: twoPoints((app, p) => app.curtainClick(p), 'plan', ['hint.curtainStart', 'hint.curtainEnd']),
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
    hint: ['hint.railingStart', 'hint.railingNext'],
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
    hint: ['hint.roofStart', 'hint.roofNext'],
  },
  stair: {
    aim: '3d',
    points: (app) => (app.ui.stairFrom ? [app.ui.stairFrom] : []),
    click: (app, p) => app.stairClick(p),
    escape: (app) => {
      app.ui.stairFrom = null;
      app.render();
    },
    escapeIs: 'key.back',
    hint: ['hint.stairStart', 'hint.stairDirection'],
  },
};

/** The point tool in use, with something drawn or not. */
export const pointTool = (app: App): PointTool | undefined => POINT_TOOLS[app.ui.tool];

/** What the tool draws: its points and, with the pointer in the view, the one it would add. */
export function pointDraft(app: App): Point2[] | null {
  const tool = pointTool(app);
  const points = tool?.points(app) ?? [];
  if (points.length === 0) return null;
  const at = app.ui.snap?.point ?? app.ui.cursor;
  return [...points, ...(at ? [at] : [])];
}
