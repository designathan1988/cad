// Where room tags go in plan, and what they say: each at its room's point, its name and area when the
// room is wide enough on screen, else its number (and area, or a brief warning, if that fits); none for a room whose point
// is off the canvas, and none over a tag already placed. Pure: the canvas measures the text.

export interface RoomTagInput {
  /** The room's point and its width, on screen (px). */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly name: string;
  /** What is left when the name does not fit: the number. */
  readonly short: string;
  readonly area: string;
  /** What is left of the area line when it does not fit: a warning in a few words. */
  readonly brief?: string;
  /** The room's outline on screen: a tag moved aside stays inside it. */
  readonly outline?: readonly { readonly x: number; readonly y: number }[];
}

export interface RoomTag {
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  /** The pad around both lines, for drawing and for keeping other things off it. */
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Which input it is the tag of: a moved tag no longer stands at its input's point. */
  readonly index: number;
}

const PAD = 8;
const LINE = 16;

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type Segment = { readonly a: { readonly x: number; readonly y: number }; readonly b: { readonly x: number; readonly y: number } };
const meets = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Whether the segment passes through the box (Liang–Barsky clip). */
function crosses(box: Box, s: Segment): boolean {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, s.a.x - box.x],
    [dx, box.x + box.w - s.a.x],
    [-dy, s.a.y - box.y],
    [dy, box.y + box.h - s.a.y],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Each step a tag takes aside from a dimension line (px), up to a little more than its own width. */
const STEP = 6;

/** Even-odd ray crossing. */
function insidePolygon(poly: readonly { x: number; y: number }[], p: { x: number; y: number }): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** The box's four corners inside the outline (no outline: anywhere). */
const within = (box: Box, outline?: readonly { x: number; y: number }[]) =>
  !outline ||
  outline.length < 3 ||
  [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x, y: box.y + box.h },
    { x: box.x + box.w, y: box.y + box.h },
  ].every((p) => insidePolygon(outline, p));

/**
 * `avoid`: boxes a tag moves off (the temporary dimensions' values): below one, or above it. `lines`:
 * the dimensions' lines, which a tag steps aside from, the nearest way that clears them; it stays where
 * it was when none does (a line over it is better than no tag). Drawn under them, a tag a gap's line
 * ran through read "Quarto | 1".
 */
export function layoutRoomTags(
  tags: readonly RoomTagInput[],
  measure: (text: string) => number,
  view: { w: number; h: number },
  avoid: readonly Box[] = [],
  lines: readonly Segment[] = [],
): RoomTag[] {
  const placed: RoomTag[] = [];
  for (const t of tags) {
    if (t.x < 0 || t.x > view.w || t.y < 0 || t.y > view.h) continue;
    const fits = (rows: string[]) => Math.max(...rows.map(measure)) + PAD <= t.width;
    // A warning too long for its room keeps a few words of it: a lone orange number said nothing.
    const text = [[t.name, t.area], [t.short, t.area], ...(t.brief ? [[t.short, t.brief]] : [])].find(fits) ?? [t.short];
    const w = Math.max(...text.map(measure)) + PAD;
    const h = text.length * LINE;
    let box = { x: t.x - w / 2, y: t.y - LINE + 1, w, h };
    const blocker = avoid.find((a) => meets(box, a));
    if (blocker) {
      // Below the value or above it, inside the room: in a 0.75 m room the tag pushed below sat on the
      // wall. Where neither fits, it is left out while the value is shown (it goes with the selection).
      const below = { ...box, y: blocker.y + blocker.h + 2 };
      const above = { ...box, y: blocker.y - h - 2 };
      const fitsAt = (b: Box) => b.y >= 0 && b.y + h <= view.h && !avoid.some((a) => meets(b, a)) && within(b, t.outline);
      const moved = [below, above].find(fitsAt);
      if (!moved) continue;
      box = moved;
    }
    const free = (b: Box) =>
      b.x >= 0 &&
      b.y >= 0 &&
      b.x + b.w <= view.w &&
      b.y + b.h <= view.h &&
      within(b, t.outline) &&
      !lines.some((s) => crosses(b, s)) &&
      !avoid.some((a) => meets(b, a)) &&
      !placed.some((p) => meets(b, p.box));
    if (lines.some((s) => crosses(box, s))) {
      const from = box;
      // Never far from its room: across by up to half its width (one side always clears a line through
      // it by that much), up or down by up to its height. Pushed further, a tag left its room.
      for (let d = STEP; d <= w / 2 + 2 * STEP; d += STEP) {
        const next = [
          { ...from, x: from.x - d },
          { ...from, x: from.x + d },
          ...(d <= h + 2 * STEP
            ? [
                { ...from, y: from.y - d },
                { ...from, y: from.y + d },
              ]
            : []),
        ].find(free);
        if (next) {
          box = next;
          break;
        }
      }
    }
    if (placed.some((p) => meets(box, p.box)) || avoid.some((a) => meets(box, a))) continue;
    // The text follows the box: its first line 15 px below the box's top, as drawn; across too, when
    // it stepped aside from a line.
    placed.push({ x: box.x === t.x - w / 2 ? t.x : box.x + w / 2, y: box.y + LINE - 1, lines: text, box, index: tags.indexOf(t) });
  }
  return placed;
}
