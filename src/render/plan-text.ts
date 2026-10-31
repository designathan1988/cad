import type { Box, PlanView } from './plan-view';
import type { DimMark, PlanOverlay } from './plan-types';
import type { Point2 } from '../model/vector';


/** A grid axis: a dash-dot line between its bubbles, each a circle with its name, past its ends. */
export function planFont(weight: string, size: string): string {
  const css = getComputedStyle(document.documentElement);
  return `${weight} ${css.getPropertyValue(size).trim()} ${css.getPropertyValue('--font').trim()}`;
}

export function textWidth(view: PlanView, text: string, font: string): number {
  view.ctx.font = font;
  return view.ctx.measureText(text).width;
}

/** The pad of a tag of width w centred on p. */
export function boxAt(p: Point2, w: number): Box {
  return { x: p.x - w / 2, y: p.y - 8, w, h: 16 };
}

/** A text tag centred on a screen point, kept inside the canvas. */
export function tag(view: PlanView, p: Point2, text: string, colour: string, bg: string, font: string): void {
  const tw = textWidth(view, text, font);
  const { w, h } = view.size;
  const x = Math.min(Math.max(4, p.x - tw / 2), w - tw - 8);
  const y = Math.min(Math.max(12, p.y + 3), h - 6);
  const { ctx } = view;
  ctx.fillStyle = bg;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(x - 4, y - 11, tw + 8, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y + 1);
}

/** A text tag on a background pad, at a world point plus a screen offset. */
export function label(view: PlanView, at: Point2, text: string, colour: string, bg: string, font: string, offset = { x: 0, y: -14 }): Box {
  const { ctx } = view;
  const p = view.toScreen(at);
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  const { w } = view.size;
  let x = p.x + offset.x;
  if (offset.x === 0) x -= tw / 2;
  x = Math.min(Math.max(4, x), w - tw - 8);
  const y = p.y + offset.y;
  ctx.fillStyle = bg;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(x - 4, y - 11, tw + 8, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y + 1);
  return { x: x - 4, y: y - 11, w: tw + 8, h: 16 };
}

/** The live measure, off the segment along its normal, and moved further out while it would cover the snap label. */
export function drawMeasure(view: PlanView, m: NonNullable<PlanOverlay['measure']>, avoid: Box | null, colour: string, bg: string): void {
  const font = planFont('700', '--fs-sm');
  if (!m.normal) {
    label(view, m.at, m.text, colour, bg, font);
    return;
  }
  const n = { x: m.normal.x, y: -m.normal.y };
  const base = view.toScreen(m.at);
  const w = textWidth(view, m.text, font) + 8;
  // Far enough along the normal for the whole pad to clear the wall face, whatever the angle.
  const reach = (m.clear ?? 0) * view.scale + 6 + Math.abs(n.x) * (w / 2) + Math.abs(n.y) * 8;
  let p = { x: base.x + n.x * reach, y: base.y + n.y * reach };
  for (let i = 0; i < 4 && avoid && overlaps(boxAt(p, w), avoid); i++) p = { x: p.x + n.x * 20, y: p.y + n.y * 20 };
  tag(view, p, m.text, colour, bg, font);
}

export function drawSnap(view: PlanView, s: NonNullable<PlanOverlay['snap']>, colour: string, bg: string): Box | null {
  const { ctx } = view;
  if (s.guideFrom) dashed(view, s.guideFrom, s.point, colour);
  const p = view.toScreen(s.point);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  snapMark(ctx, s.kind ?? '', p);
  ctx.stroke();
  if (!s.label) return null;
  // Beyond the end of the segment, never back over it: to the left when it arrives going left.
  const font = planFont('600', '--fs-xs');
  const left = s.away !== undefined && s.away.x < 0;
  const offset = left ? { x: -14 - textWidth(view, s.label, font), y: -12 } : { x: 14, y: -12 };
  return label(view, { x: s.point.x, y: s.point.y }, s.label, colour, bg, font, offset);
}

/** Extension lines, the dimension line and a slash tick at each end; the value is a DOM field. */
export function drawDim(view: PlanView, d: DimMark, colour: string): void {
  const { ctx } = view;
  const l = view.dimLine(d);
  const dx = l.b.x - l.a.x;
  const dy = l.b.y - l.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  // The side, on screen, for extending the extension lines a little past the dimension line.
  const sx = (l.a.x - l.fromA.x) / 15;
  const sy = (l.a.y - l.fromA.y) / 15;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [from, to] of [
    [l.fromA, l.a],
    [l.fromB, l.b],
  ] as const) {
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x + sx * 4, to.y + sy * 4);
  }
  ctx.moveTo(l.a.x, l.a.y);
  ctx.lineTo(l.b.x, l.b.y);
  // Ticks at 45° to the line.
  const tx = (ux + sx) * 4;
  const ty = (uy + sy) * 4;
  for (const p of [l.a, l.b]) {
    ctx.moveTo(p.x - tx, p.y - ty);
    ctx.lineTo(p.x + tx, p.y + ty);
  }
  ctx.stroke();
  ctx.restore();
}

/** A small triangle with "!" at a screen point: the sign of a problem, readable without colour. */
export function warnSign(view: PlanView, p: Point2, colour: string, bg: string): void {
  const { ctx } = view;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 8);
  ctx.lineTo(p.x + 8, p.y + 6);
  ctx.lineTo(p.x - 8, p.y + 6);
  ctx.closePath();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.font = planFont('700', '--fs-xs');
  ctx.textAlign = 'center';
  ctx.fillText('!', p.x, p.y + 4.5);
  ctx.restore();
}

/**
 * The type marks of doors and windows, each in a small outlined tag beside its opening; left out while
 * an opening is too small on screen to tell its tag from its neighbours'.
 */
export function drawOpeningTags(view: PlanView, tags: NonNullable<PlanOverlay['openingTags']>, color: (name: string) => string): void {
  const { ctx } = view;
  const font = planFont('600', '--fs-xs');
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;
  for (const tag of tags) {
    if (tag.width * view.scale < MIN_TAGGED_PX || tag.text === '') continue;
    const p = view.toScreen(tag.at);
    const w = textWidth(view, tag.text, font) + 8;
    const h = 15;
    ctx.fillStyle = color('--canvas');
    ctx.strokeStyle = color('--text-3');
    ctx.beginPath();
    ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color('--text-2');
    ctx.fillText(tag.text, p.x, p.y + 0.5);
  }
  ctx.restore();
}

export function dashed(view: PlanView, a: Point2, b: Point2, colour: string): void {
  const { ctx } = view;
  const sa = view.toScreen(a);
  const sb = view.toScreen(b);
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  ctx.restore();
}

/** Below this on screen (px), an opening's type tag is left out: the tags would crowd one another. */
export const MIN_TAGGED_PX = 18;

export const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * A snap's mark, its shape saying what it is (as CAD programs draw them): a square at an end or a
 * corner, a triangle at a middle, a diamond at a division, a circle at a centre, a circle with a dot
 * at an element's point, a cross where lines cross, ⊥ square to a wall, an hourglass on a wall or a
 * guide, a plus along a direction or an alignment, a dot on the grid.
 */
export function snapMark(ctx: CanvasRenderingContext2D, kind: string, p: Point2): void {
  const r = 5;
  switch (kind) {
    case 'endpoint':
    case 'corner':
    case 'start':
      ctx.rect(p.x - r, p.y - r, 2 * r, 2 * r);
      return;
    case 'midpoint':
      ctx.moveTo(p.x, p.y - r - 1);
      ctx.lineTo(p.x + r + 1, p.y + r);
      ctx.lineTo(p.x - r - 1, p.y + r);
      ctx.closePath();
      return;
    case 'division':
      ctx.moveTo(p.x, p.y - r - 1);
      ctx.lineTo(p.x + r + 1, p.y);
      ctx.lineTo(p.x, p.y + r + 1);
      ctx.lineTo(p.x - r - 1, p.y);
      ctx.closePath();
      return;
    case 'center':
      ctx.moveTo(p.x + r + 1, p.y);
      ctx.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
      return;
    case 'node':
      ctx.moveTo(p.x + r + 1, p.y);
      ctx.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
      ctx.moveTo(p.x + 1.5, p.y);
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      return;
    case 'perpendicular':
      ctx.moveTo(p.x - r, p.y + r);
      ctx.lineTo(p.x + r, p.y + r);
      ctx.moveTo(p.x, p.y + r);
      ctx.lineTo(p.x, p.y - r);
      return;
    case 'onWall':
    case 'onFace':
    case 'onGuide':
      ctx.moveTo(p.x - r, p.y - r);
      ctx.lineTo(p.x + r, p.y - r);
      ctx.lineTo(p.x - r, p.y + r);
      ctx.lineTo(p.x + r, p.y + r);
      ctx.closePath();
      return;
    case 'extension':
    case 'aligned':
    case 'axis':
    case 'parallel':
    case 'locked':
    case 'angle':
      ctx.moveTo(p.x - r, p.y);
      ctx.lineTo(p.x + r, p.y);
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x, p.y + r);
      return;
    case 'grid':
      ctx.moveTo(p.x + 2, p.y);
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      return;
    default:
      // Where lines cross (two walls, guides, the origin), and anything else: a cross.
      ctx.moveTo(p.x - r, p.y - r);
      ctx.lineTo(p.x + r, p.y + r);
      ctx.moveTo(p.x + r, p.y - r);
      ctx.lineTo(p.x - r, p.y + r);
  }
}
