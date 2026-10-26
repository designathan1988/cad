// Text notes on a level's plan (ref/chat.txt:117, "textos"): a few words at a point, as tall in metres as
// the user sets, so they print at the plan's scale. Part of the project: saved, undone, moved and copied
// as the rest; drawn in plan and in the DXF, not in 3D.

import type { Point2 } from '../../core/vector';

export const NOTE_PREFIX = 'note';
/** A new note's letters (m): read at 1:50 and 1:100 alike. */
export const NOTE_HEIGHT = 0.25;

export interface Note {
  readonly id: string;
  readonly levelId: string;
  /** The middle of its text. */
  readonly at: Point2;
  readonly text: string;
  /** Height of its letters (m). */
  readonly height: number;
}

export const isNoteId = (id: string): boolean => id.startsWith(`${NOTE_PREFIX}_`);

/** Letters smaller than this on screen (px) are drawn this tall: a note seen from afar still reads. */
export const NOTE_MIN_PX = 10;

/** How tall its letters are drawn (m) at `scale` px a metre: their height, or the smallest that reads. */
export const shownHeight = (n: Note, scale: number): number => Math.max(n.height, NOTE_MIN_PX / scale);

/** Its box in plan (m), around its point: letters about 0.6 of their height wide, a line each. */
export function noteBox(n: Note, height = n.height): { x0: number; y0: number; x1: number; y1: number } {
  const lines = n.text.split('\n');
  const w = Math.max(1, ...lines.map((l) => l.length)) * height * 0.6;
  const h = lines.length * height * 1.3;
  return { x0: n.at.x - w / 2, x1: n.at.x + w / 2, y0: n.at.y - h / 2, y1: n.at.y + h / 2 };
}
