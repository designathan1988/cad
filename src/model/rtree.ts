// A static spatial index (docs/plano-de-escopo.md, phase 1): boxes packed into a tree once (sort-tile-
// recursive, as Flatbush packs them), then asked which ones a point or a box touches. Built again when
// what it indexes changes; asking costs the tree's depth and what is found, not every box. Pure.

export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface Node extends Box {
  /** Leaves hold the items' indices; inner nodes their children. */
  readonly children: readonly Node[] | null;
  readonly items: readonly number[] | null;
}

/** How many entries a node holds. */
const FAN = 16;

const around = (boxes: readonly Box[]): Box => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return { minX, minY, maxX, maxY };
};

const touches = (a: Box, b: Box): boolean => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

/** Sort-tile-recursive: in vertical slices by x, each slice by y, cut into runs of FAN. */
function pack<T extends Box>(entries: readonly T[]): T[][] {
  const sorted = [...entries].sort((a, b) => a.minX + a.maxX - (b.minX + b.maxX));
  const groups = Math.ceil(entries.length / FAN);
  const slices = Math.ceil(Math.sqrt(groups));
  const perSlice = slices * FAN;
  const out: T[][] = [];
  for (let s = 0; s < sorted.length; s += perSlice) {
    const slice = sorted.slice(s, s + perSlice).sort((a, b) => a.minY + a.maxY - (b.minY + b.maxY));
    for (let i = 0; i < slice.length; i += FAN) out.push(slice.slice(i, i + FAN));
  }
  return out;
}

export class RTree {
  private readonly root: Node | null;
  private readonly boxes: readonly Box[];

  constructor(boxes: readonly Box[]) {
    this.boxes = boxes;
    if (boxes.length === 0) {
      this.root = null;
      return;
    }
    let level: Node[] = pack(boxes.map((b, i) => ({ ...b, i }))).map((run) => ({ ...around(run), children: null, items: run.map((e) => e.i) }));
    while (level.length > 1) level = pack(level).map((run) => ({ ...around(run), children: run, items: null }));
    this.root = level[0]!;
  }

  /** The indices of the boxes touching `q`. */
  search(q: Box): number[] {
    const out: number[] = [];
    const stack: Node[] = this.root && touches(this.root, q) ? [this.root] : [];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.items) {
        for (const i of n.items) if (touches(this.boxes[i]!, q)) out.push(i);
      } else for (const c of n.children!) if (touches(c, q)) stack.push(c);
    }
    return out;
  }
}

/** The box around some points; null for none. */
export function boxOf(points: readonly { readonly x: number; readonly y: number }[]): Box | null {
  if (points.length === 0) return null;
  return around(points.map((p) => ({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y })));
}
