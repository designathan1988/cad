// A section drawing painted on a canvas: its cut fills and hatches, the seen lines, the level chain
// and the dimensions.

import type { Point2 } from '../../model/vector';
import { sectionDims, type SectionDrawing } from './drawing';
import { paperHatch } from '../material/hatch';

/** How a drawing is painted: model (along, up) to paper (mm), the pens (mm) and the colours. */
export interface SectionPaint {
  readonly toPaper: (p: Point2) => Point2;
  readonly cutPen: number;
  readonly seenPen: number;
  readonly finePen: number;
  readonly ink: string;
  readonly cutFill: string;
  readonly paper: string;
  readonly family: string;
  /** Text height (mm). */
  readonly text: number;
  /** A level's name and height as said: "Térreo +0,00". */
  readonly levelText: (name: string, z: number) => string;
  /** The page's pixels per millimetre: a layer's hatch drawn sharp at it. */
  readonly pxPerMm?: number;
  /** A length as dimensions write it ("2,80"); none: no dimensions drawn. */
  readonly lengthText?: (m: number) => string;
  /** A room's name as the plan writes it ("3 · Sala"); none: no names drawn. */
  readonly roomText?: (number: string, name: string) => string;
}

/** The spacing of a cut's hatch on paper (mm), at any scale, as a section's hatch is drawn by hand. */
export const HATCH_MM = 2;

/** The drawing on a context in paper millimetres. */
export function paintSection(ctx: CanvasRenderingContext2D, d: SectionDrawing, p: SectionPaint): void {
  const path = (poly: readonly Point2[]) => {
    ctx.beginPath();
    poly.forEach((q, i) => {
      const s = p.toPaper(q);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Far to near: each face covers what is behind it, then draws its own lines.
  for (const f of d.faces) {
    path(f.poly);
    ctx.fillStyle = p.paper;
    ctx.fill();
    // A hair of paper round it too, so its neighbours' seams do not let lines behind show through.
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = p.finePen * 0.5;
    ctx.stroke();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = p.seenPen;
    ctx.beginPath();
    for (const [a, b] of f.edges) {
      const s = p.toPaper(a);
      const e = p.toPaper(b);
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
    }
    ctx.stroke();
  }
  // What is cut: filled (a layer in its material's colour, its hatch over it), then outlined: a layer's
  // edges thin, the walls' outline and any other cut with the cut pen.
  for (const c of d.cuts) {
    ctx.beginPath();
    for (const loop of c.loops) {
      loop.forEach((q, i) => {
        const s = p.toPaper(q);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
    }
    if (c.loops.length > 0) {
      ctx.fillStyle = c.fill?.color ?? p.cutFill;
      ctx.fill('evenodd');
      const hatch = c.fill ? paperHatch(ctx, c.fill.pattern, p.ink, HATCH_MM, p.pxPerMm ?? 12, p.finePen * 0.7) : null;
      if (hatch) {
        ctx.fillStyle = hatch;
        ctx.fill('evenodd');
      }
    }
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = c.pen === 'fine' ? p.finePen : p.cutPen;
    ctx.beginPath();
    for (const [a, b] of c.segments) {
      const s = p.toPaper(a);
      const e = p.toPaper(b);
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
    }
    ctx.stroke();
  }
  // The ground, a little past the drawing both ways, and each level's mark at the right.
  if (d.box) {
    const left = p.toPaper({ x: d.box.min.x, y: d.base });
    const right = p.toPaper({ x: d.box.max.x, y: d.base });
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = p.cutPen * 1.5;
    ctx.beginPath();
    ctx.moveTo(left.x - 5, left.y);
    ctx.lineTo(right.x + 5, right.y);
    ctx.stroke();
    ctx.font = `400 ${p.text}px ${p.family}`;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.lineWidth = p.finePen;
    for (const l of d.levels) {
      const at = p.toPaper({ x: d.box.max.x, y: l.z });
      const x = right.x + 3;
      ctx.setLineDash([2, 1]);
      ctx.beginPath();
      ctx.moveTo(right.x - 2, at.y);
      ctx.lineTo(x + 18, at.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // The level mark: a triangle standing on the line.
      ctx.beginPath();
      ctx.moveTo(x, at.y);
      ctx.lineTo(x - 1.2, at.y - 1.8);
      ctx.lineTo(x + 1.2, at.y - 1.8);
      ctx.closePath();
      ctx.fillStyle = p.ink;
      ctx.fill();
      ctx.fillText(p.levelText(l.name, l.z), x + 2, at.y - 0.4);
    }
  }
  // The rooms' names inside, on a hair of paper so the lines beyond do not cross them.
  if (p.roomText) {
    ctx.font = `400 ${p.text}px ${p.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const r of d.rooms) {
      const at = p.toPaper(r.at);
      const s = p.roomText(r.number, r.name);
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = p.text * 0.4;
      ctx.strokeText(s, at.x, at.y);
      ctx.fillStyle = p.ink;
      ctx.fillText(s, at.x, at.y);
    }
  }
  if (p.lengthText) {
    const dims = sectionDims(d);
    if (dims) paintDims(ctx, dims, p, p.lengthText);
    // Each door and window it cuts: up its far side, 3 mm out, from its floor to its sill (a window's) and its head.
    for (const o of d.openings) {
      const zs = [o.floor, ...(o.bottom - o.floor > 1e-6 ? [o.bottom] : []), o.top];
      upChain(ctx, p.toPaper({ x: o.at, y: 0 }).x + 3, zs, p, p.lengthText, [-2.5, 0.5]);
    }
  }
  ctx.restore();
}

/**
 * A chain of heights up the paper line at x: a tick at 45° at each, each stretch's value beside it on its
 * left, turned to read upward, and an extension line at each height from x + ext[0] to x + ext[1] (mm).
 */
export function upChain(ctx: CanvasRenderingContext2D, x: number, zs: readonly number[], p: SectionPaint, text: (m: number) => string, ext: readonly [number, number]): void {
  const tick = 1;
  const ys = zs.map((z) => p.toPaper({ x: 0, y: z }).y);
  ctx.save();
  ctx.strokeStyle = p.ink;
  ctx.fillStyle = p.ink;
  ctx.lineWidth = p.finePen;
  ctx.font = `400 ${p.text}px ${p.family}`;
  ctx.beginPath();
  ctx.moveTo(x, ys[0]!);
  ctx.lineTo(x, ys.at(-1)!);
  for (const y of ys) {
    ctx.moveTo(x - tick, y + tick);
    ctx.lineTo(x + tick, y - tick);
    ctx.moveTo(x + ext[0], y);
    ctx.lineTo(x + ext[1], y);
  }
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let i = 1; i < ys.length; i++) {
    ctx.save();
    ctx.translate(x - 0.8, (ys[i - 1]! + ys[i]!) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(text(zs[i]! - zs[i - 1]!), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/** The section's dimensions on paper: ticks at 45°, the values over their lines, upright ones turned. */
export function paintDims(ctx: CanvasRenderingContext2D, dims: { heights: number[]; along: [number, number] }, p: SectionPaint, text: (m: number) => string): void {
  const tick = 1;
  ctx.save();
  ctx.strokeStyle = p.ink;
  ctx.fillStyle = p.ink;
  ctx.lineWidth = p.finePen;
  ctx.font = `400 ${p.text}px ${p.family}`;
  // Up the left side, 8 mm out from the drawing.
  upChain(ctx, p.toPaper({ x: dims.along[0], y: 0 }).x - 8, dims.heights, p, text, [1.5, 4]);
  // Under the ground line, 8 mm down: the whole length.
  const a = p.toPaper({ x: dims.along[0], y: dims.heights[0]! });
  const b = p.toPaper({ x: dims.along[1], y: dims.heights[0]! });
  const y = a.y + 8;
  ctx.beginPath();
  ctx.moveTo(a.x, y);
  ctx.lineTo(b.x, y);
  for (const q of [a.x, b.x]) {
    ctx.moveTo(q - tick, y + tick);
    ctx.lineTo(q + tick, y - tick);
    ctx.moveTo(q, a.y + 1.5);
    ctx.lineTo(q, y + 1.5);
  }
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text(dims.along[1] - dims.along[0]), (a.x + b.x) / 2, y - 0.6);
  ctx.restore();
}
