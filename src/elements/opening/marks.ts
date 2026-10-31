// Door and window type marks (ref/chat.txt:117, "etiquetas automáticas: tipo da porta e da janela"):
// openings have sizes and makes, not types, so a type is a size with its make. Each kind's distinct sizes are numbered from the
// smallest, by width, then height, then sill: every 0.90 × 2.10 door is the same type, its mark the
// same on the plan, in the schedule and in the panel. Derived, never stored. Pure.

import { add, type Point2, scale } from '../../model/vector';
import type { Opening, OpeningId, OpeningKind } from './schema';
import type { OpeningFrame } from './void';

/** Sizes within this are one size (m). */
const SAME = 1e-6;

/**
 * What makes an opening of one type, in a fixed order: how it opens and is built, not how far it stands
 * open (`open`) nor the order its keys were written in. The whole style, stringified, made a door drawn
 * half open, or one whose screen was taken off and put back, a type of its own.
 */
const MAKE_KEYS = ['operation', 'leaves', 'frame', 'casing', 'transom', 'threshold', 'screen', 'mullions', 'transoms', 'design', 'handle', 'leafMaterial', 'frameMaterial', 'glazing', 'muntins'] as const;
const makeOf = (o: Opening): string => (o.style ? JSON.stringify(MAKE_KEYS.map((k) => o.style![k] ?? null)) : '');

/** Each opening's mark: the kind's prefix (P for doors, J for windows) and its size's number. */
export function openingMarks(openings: readonly Opening[], prefix: Readonly<Record<OpeningKind, string>>): Map<OpeningId, string> {
  const marks = new Map<OpeningId, string>();
  for (const kind of ['door', 'window'] as const) {
    // A type is a size and a make (style.ts): a sliding door and a hinged one of one size are two types.
    const sizes: { width: number; height: number; sill: number; make: string }[] = [];
    const same = (a: { width: number; height: number; sill: number; make: string }, b: typeof a) =>
      Math.abs(a.width - b.width) <= SAME && Math.abs(a.height - b.height) <= SAME && (kind === 'door' || Math.abs(a.sill - b.sill) <= SAME) && a.make === b.make;
    const ofKind = openings.filter((o) => o.kind === kind).map((o) => ({ o, key: { width: o.width, height: o.height, sill: o.sill, make: makeOf(o) } }));
    for (const { key } of ofKind) if (!sizes.some((s) => same(s, key))) sizes.push(key);
    sizes.sort((a, b) => a.width - b.width || a.height - b.height || a.sill - b.sill || a.make.localeCompare(b.make));
    for (const { o, key } of ofKind) marks.set(o.id, `${prefix[kind]}${sizes.findIndex((s) => same(s, key)) + 1}`);
  }
  return marks;
}

/**
 * Where an opening's tag goes: off its middle, `clear` metres out from a face. A door's on the side
 * away from its swing, so it never sits on the arc. A window's outside: on its wall's exterior face,
 * unless that side is in a room and the other is not (a wall drawn the other way round has its
 * exterior face indoors), `inRoom` telling.
 */
export function markPoint(frame: OpeningFrame, opening: Opening, clear: number, inRoom: (p: Point2) => boolean = () => false): Point2 {
  const middle = scale(add(frame.start, frame.end), 0.5);
  const [exterior, interior] = frame.faces;
  const at = (offset: number) => add(middle, scale(frame.normal, offset));
  // A door swinging left opens toward the normal (symbol.ts): its tag on the other face.
  if (opening.kind === 'door') return at(opening.swing === 'right' ? interior + clear : exterior - clear);
  const out = at(exterior - clear);
  const other = at(interior + clear);
  return inRoom(out) && !inRoom(other) ? other : out;
}
