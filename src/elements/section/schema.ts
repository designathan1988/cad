// Sections and elevations as drawings (docs/plano-de-escopo.md, phase 10: "cortes e elevações
// documentados"): a line in plan, the same on every level, looking to its left (start → end) as far as
// its depth. A section's line goes through the building and fills what it cuts; an elevation's stands
// outside it and only sees; a room's interior elevation sees one wall of it from inside, on its level
// alone. Drawn from the model each time (app/section-drawing.ts), so it follows it, and shown in the
// sections dialog at the drawing's scale (app/section-view.ts).

import { type Point2, distance } from '../../core/vector';

export const SECTION_PREFIX = 'sec';

export type SectionKind = 'section' | 'elevation';

export interface SectionMark {
  readonly id: string;
  /** "A", "B"… for a section; a side's name for an elevation. */
  readonly name: string;
  readonly kind: SectionKind;
  readonly start: Point2;
  readonly end: Point2;
  /** How far past its line it sees (m). */
  readonly depth: number;
  /** A room's interior elevation: only this level's height is drawn, and the mark only on its plan. Absent: every level. */
  readonly levelId?: string;
}

/** The least and greatest depth (m). */
export const DEPTH_MIN = 0.1;
export const DEPTH_MAX = 500;

/** Where it looks: square to its line, to the left of start → end. */
export const lookOf = (m: Pick<SectionMark, 'start' | 'end'>): Point2 => {
  const len = distance(m.start, m.end) || 1;
  return { x: -(m.end.y - m.start.y) / len, y: (m.end.x - m.start.x) / len };
};

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (p: unknown): p is Point2 => typeof p === 'object' && p !== null && finite((p as Point2).x) && finite((p as Point2).y);

export const isSectionMark = (m: unknown): m is SectionMark => {
  if (typeof m !== 'object' || m === null) return false;
  const o = m as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    o.name.trim() !== '' &&
    (o.kind === 'section' || o.kind === 'elevation') &&
    isPoint(o.start) &&
    isPoint(o.end) &&
    distance(o.start, o.end) > 1e-6 &&
    finite(o.depth) &&
    o.depth >= DEPTH_MIN &&
    o.depth <= DEPTH_MAX &&
    (o.levelId === undefined || typeof o.levelId === 'string')
  );
};

/** The next section's letter: A, B… after the last; Z then AA. */
export function nextSectionName(marks: readonly SectionMark[]): string {
  const taken = new Set(marks.filter((m) => m.kind === 'section').map((m) => m.name));
  for (let i = 0; ; i++) {
    const n = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
    if (!taken.has(n)) return n;
  }
}

/**
 * The four elevations round a box (m), `margin` outside it, each looking at the building across the
 * whole box: north looks south from above it (+y is north in plan), and so on. Each line runs so the
 * building is on its left.
 */
export function elevationsAround(box: { min: Point2; max: Point2 }, margin: number): { side: 'north' | 'south' | 'east' | 'west'; start: Point2; end: Point2; depth: number }[] {
  const { min, max } = box;
  const w = max.x - min.x;
  const h = max.y - min.y;
  return [
    // Above the plan, looking down it (−y): start → end runs −x so the left is −y.
    { side: 'north', start: { x: max.x + margin, y: max.y + margin }, end: { x: min.x - margin, y: max.y + margin }, depth: h + 2 * margin },
    { side: 'south', start: { x: min.x - margin, y: min.y - margin }, end: { x: max.x + margin, y: min.y - margin }, depth: h + 2 * margin },
    { side: 'east', start: { x: max.x + margin, y: min.y - margin }, end: { x: max.x + margin, y: max.y + margin }, depth: w + 2 * margin },
    { side: 'west', start: { x: min.x - margin, y: max.y + margin }, end: { x: min.x - margin, y: min.y - margin }, depth: w + 2 * margin },
  ];
}

/**
 * A room's four interior elevations, inside its box (m): each wall seen from `inset` off the one across
 * from it, as deep as the room and `beyond` into the wall it looks at (its windows' frames and glass),
 * its line `beyond` into the side walls too, so they are cut. The north one looks at the north wall
 * (+y), and so on; each looks to the left of its line.
 */
export function elevationsInside(box: { min: Point2; max: Point2 }, inset: number, beyond: number): { side: 'north' | 'south' | 'east' | 'west'; start: Point2; end: Point2; depth: number }[] {
  const { min, max } = box;
  const w = max.x - min.x;
  const h = max.y - min.y;
  const b = beyond;
  return [
    { side: 'north', start: { x: min.x - b, y: min.y + inset }, end: { x: max.x + b, y: min.y + inset }, depth: h - inset + b },
    { side: 'east', start: { x: min.x + inset, y: max.y + b }, end: { x: min.x + inset, y: min.y - b }, depth: w - inset + b },
    { side: 'south', start: { x: max.x + b, y: max.y - inset }, end: { x: min.x - b, y: max.y - inset }, depth: h - inset + b },
    { side: 'west', start: { x: max.x - inset, y: min.y - b }, end: { x: max.x - inset, y: max.y + b }, depth: w - inset + b },
  ];
}
