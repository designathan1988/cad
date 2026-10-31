// Text notes on a level's plan (ref/chat.txt:117, "textos"): a few words at a point, as tall in metres as
// the user sets, so they print at the plan's scale. Part of the project: saved, undone, moved and copied
// as the rest; drawn in plan and in the DXF, not in 3D.
//
// A level mark (ref/chat.txt:117, "cotas de nível") is a note that says a height instead of its text: its
// level's elevation plus its own adjustment (a step down to a terrace, a raised floor), with the plan's
// level symbol. Held by its level: raising the level changes what it says.

import type { Point2 } from '../../model/vector';
import type { LevelId } from '../../project/doc';

export const NOTE_PREFIX = 'note';
/** A new note's letters (m): read at 1:50 and 1:100 alike. */
export const NOTE_HEIGHT = 0.25;
/** A new level mark's letters (m). */
export const LEVEL_MARK_HEIGHT = 0.2;

export interface Note {
  readonly id: string;
  readonly levelId: LevelId;
  /** The middle of its text. */
  readonly at: Point2;
  readonly text: string;
  /** Height of its letters (m). */
  readonly height: number;
  /** A level mark: says its level's elevation plus `offset` (m), not its text. */
  readonly elevation?: { readonly offset: number };
  /** A callout's leader (chamada): the point its arrow points at, the line from the text's edge to it. */
  readonly leader?: Point2;
}

/** Where a leader leaves the text: the point of its box's edge on the way from its middle to the arrow. */
export function leaderStart(box: { x0: number; y0: number; x1: number; y1: number }, to: Point2): Point2 {
  const c = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
  const d = { x: to.x - c.x, y: to.y - c.y };
  const hw = (box.x1 - box.x0) / 2;
  const hh = (box.y1 - box.y0) / 2;
  const k = Math.min(Math.abs(d.x) > 1e-12 ? hw / Math.abs(d.x) : Infinity, Math.abs(d.y) > 1e-12 ? hh / Math.abs(d.y) : Infinity, 1);
  return { x: c.x + d.x * k, y: c.y + d.y * k };
}

/** What a level mark says: the height with its sign, "+2,80", "−0,15", "±0,00". */
export function elevationText(elevation: number, format: (m: number) => string): string {
  const v = Math.round(elevation * 100) / 100;
  return v === 0 ? `±${format(0)}` : `${v > 0 ? '+' : '−'}${format(Math.abs(v))}`;
}

export const isNoteId = (id: string): boolean => id.startsWith(`${NOTE_PREFIX}_`);

/** Letters smaller than this on screen (px) are drawn this tall: a note seen from afar still reads. */
export const NOTE_MIN_PX = 10;

/** How tall its letters are drawn (m) at `scale` px a metre: their height, or the smallest that reads. */
export const shownHeight = (n: Note, scale: number): number => Math.max(n.height, NOTE_MIN_PX / scale);

/** Its box in plan (m), around its point: letters about 0.6 of their height wide, a line each. A level
 * mark's point is its symbol's centre, its text to the right. */
export function noteBox(n: Note, height = n.height): { x0: number; y0: number; x1: number; y1: number } {
  if (n.elevation) {
    const r = height * 0.5;
    return { x0: n.at.x - r, x1: n.at.x + r + height * 0.3 + n.text.length * height * 0.6, y0: n.at.y - height * 0.65, y1: n.at.y + height * 0.65 };
  }
  const lines = n.text.split('\n');
  const w = Math.max(1, ...lines.map((l) => l.length)) * height * 0.6;
  const h = lines.length * height * 1.3;
  return { x0: n.at.x - w / 2, x1: n.at.x + w / 2, y0: n.at.y - h / 2, y1: n.at.y + h / 2 };
}
