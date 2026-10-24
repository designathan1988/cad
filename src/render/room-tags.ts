// Where room tags go in plan, and what they say: each at its room's point, its name and area when the
// room is wide enough on screen, else its number (and area if that fits); none for a room whose point
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
}

export interface RoomTag {
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  /** The pad around both lines, for drawing and for keeping other things off it. */
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

const PAD = 8;
const LINE = 16;

export function layoutRoomTags(tags: readonly RoomTagInput[], measure: (text: string) => number, view: { w: number; h: number }): RoomTag[] {
  const placed: RoomTag[] = [];
  for (const t of tags) {
    if (t.x < 0 || t.x > view.w || t.y < 0 || t.y > view.h) continue;
    const fits = (lines: string[]) => Math.max(...lines.map(measure)) + PAD <= t.width;
    const lines = fits([t.name, t.area]) ? [t.name, t.area] : fits([t.short, t.area]) ? [t.short, t.area] : [t.short];
    const w = Math.max(...lines.map(measure)) + PAD;
    const h = lines.length * LINE;
    const box = { x: t.x - w / 2, y: t.y - LINE + 1, w, h };
    const over = placed.some((p) => box.x < p.box.x + p.box.w && p.box.x < box.x + box.w && box.y < p.box.y + p.box.h && p.box.y < box.y + box.h);
    if (over) continue;
    placed.push({ x: t.x, y: t.y, lines, box });
  }
  return placed;
}
