// What the plan draws over the drawing while a tool works, drawn over the 3D view too: where the
// pointer snaps (a cross and what it snapped to, standing on the level's floor with a line up the
// height of the level, so it reads in depth), the line being drawn with its length, its start, and a
// floor outline being drawn. Screen space, on a canvas laid over the WebGL one; it takes no pointer.

import type { Point2 } from '../core/vector';

export interface Overlay3DState {
  /** World point (plan) to screen, at a height above the project zero; null behind the camera. */
  readonly project: (p: Point2, z: number) => Point2 | null;
  /** The level's floor and the height of the level above it. */
  readonly floor: number;
  readonly height: number;
  readonly snap: { readonly point: Point2; readonly label: string | null } | null;
  /** The line being drawn (a wall's reference line, the tape) and its length, at its middle. */
  readonly axis: { readonly start: Point2; readonly end: Point2 } | null;
  readonly measure: { readonly at: Point2; readonly text: string } | null;
  readonly anchor: Point2 | null;
  readonly draft: readonly Point2[] | null;
}

export class Overlay3D {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  clear(): void {
    this.fit();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(s: Overlay3DState): void {
    const { ctx } = this;
    this.clear();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim();
    const snapColour = color('--snap');
    const at = (p: Point2, z = s.floor) => s.project(p, z);
    const line = (a: Point2 | null, b: Point2 | null, colour: string, width: number, dash: number[]) => {
      if (!a || !b) return;
      ctx.save();
      ctx.setLineDash(dash);
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    };
    if (s.draft && s.draft.length > 1) {
      for (let i = 1; i < s.draft.length; i++) line(at(s.draft[i - 1]!), at(s.draft[i]!), color('--wall-sel'), 1.5, [6, 4]);
    }
    if (s.axis) line(at(s.axis.start), at(s.axis.end), snapColour, 1.2, [6, 4]);
    if (s.anchor) {
      const p = at(s.anchor);
      if (p) {
        ctx.save();
        ctx.strokeStyle = snapColour;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (s.measure) {
      const p = at(s.measure.at);
      if (p) this.tag(p, s.measure.text, color('--accent-text'), color('--canvas'), { x: 0, y: -14 });
    }
    if (s.snap) {
      const p = at(s.snap.point);
      if (!p) return;
      // Up the level's height from where it lands: in a perspective a point on the floor alone could
      // be anywhere along the line of sight.
      line(p, at(s.snap.point, s.floor + s.height), snapColour, 1, [3, 3]);
      ctx.save();
      ctx.strokeStyle = color('--bg');
      ctx.lineWidth = 4;
      this.cross(p);
      ctx.strokeStyle = snapColour;
      ctx.lineWidth = 1.8;
      this.cross(p);
      ctx.restore();
      if (s.snap.label) this.tag(p, s.snap.label, snapColour, color('--bg'), { x: 14, y: -12 });
    }
  }

  private cross(p: Point2): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(p.x - 6, p.y - 6);
    ctx.lineTo(p.x + 6, p.y + 6);
    ctx.moveTo(p.x + 6, p.y - 6);
    ctx.lineTo(p.x - 6, p.y + 6);
    ctx.stroke();
  }

  /** Text on a pad, kept inside the canvas. */
  private tag(p: Point2, text: string, colour: string, bg: string, offset: Point2): void {
    const { ctx } = this;
    const css = getComputedStyle(document.documentElement);
    ctx.font = `600 ${css.getPropertyValue('--fs-xs').trim() || '12px'} ${css.getPropertyValue('--font').trim() || 'sans-serif'}`;
    const tw = ctx.measureText(text).width;
    const w = this.canvas.clientWidth;
    let x = p.x + offset.x;
    if (offset.x === 0) x -= tw / 2;
    x = Math.min(Math.max(4, x), w - tw - 8);
    const y = p.y + offset.y;
    ctx.save();
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x - 4, y - 11, tw + 8, 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  /** The canvas at the size it is shown, in device pixels. */
  private fit(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }
}
