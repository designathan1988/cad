// Sections and elevations as drawings (docs/plano-de-escopo.md, phase 10: "cortes e elevações
// documentados"): a line in plan, the same on every level, looking to its left (start → end) as far as
// its depth. A section's line goes through the building and fills what it cuts; an elevation's stands
// outside it and only sees. Drawn from the model each time (app/section-drawing.ts), so it follows it;
// put on a sheet at a scale (elements/sheet).

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
    o.depth <= DEPTH_MAX
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
