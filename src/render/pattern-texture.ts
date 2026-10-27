// A material's pattern painted (elements/material/pattern.ts): one period of it on a canvas, the joints
// first and the pieces over them, each in the material's colour lighter or darker by its tone, wood's
// boards with their grain. The texture repeats; the 3D lays it in metres (scene-3d.ts, layerMaterial).

import * as THREE from 'three';
import { patternPieces, type SurfacePattern, tone } from '../elements/material/pattern';

/** The canvas's longer side, px: a 60 cm tile's 3 mm joint still a pixel and more. */
const SIDE = 1024;

/** A colour made lighter (k > 0) or darker (k < 0) by up to that fraction, as #rrggbb. */
function tint(color: string, k: number): string {
  const n = parseInt(color.slice(1), 16);
  const ch = (s: number) => {
    const c = (n >> s) & 255;
    return Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

/** The pattern's period painted, and its size in metres. */
export function paintPattern(p: SurfacePattern, color: string): { readonly canvas: HTMLCanvasElement; readonly period: { readonly u: number; readonly v: number } } {
  const { period, pieces } = patternPieces(p);
  const ppm = SIDE / Math.max(period.u, period.v);
  const W = Math.max(8, Math.round(period.u * ppm));
  const H = Math.max(8, Math.round(period.v * ppm));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Where there are no joints, the pieces meet: the background is the pieces' own colour.
  ctx.fillStyle = p.joint > 0 ? p.jointColor : color;
  ctx.fillRect(0, 0, W, H);
  const sx = W / period.u;
  const sy = H / period.v;
  // A joint at least a pixel wide, so a thin one does not vanish.
  const inset = p.joint > 0 && p.joint * sx < 1 ? 1 - p.joint * sx : 0;
  const other = p.color2 ?? tint(color, -0.4);
  pieces.forEach((piece, i) => {
    const base = piece.alt ? other : color;
    const fill = tint(base, piece.tone * p.variation);
    // Drawn where it is and again a period over, so the ones across an edge come in on the other side.
    for (const du of [-period.u, 0, period.u]) {
      for (const dv of [-period.v, 0, period.v]) {
        const x = (piece.u + du) * sx;
        const y = (piece.v + dv) * sy;
        const w = piece.w * sx - inset;
        const h = piece.h * sy - inset;
        if (x > W || y > H || x + w < 0 || y + h < 0) continue;
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        if (p.kind === 'wood') grain(ctx, x, y, w, h, base, i);
      }
    }
  });
  return { canvas, period };
}

/** A board's grain: thin streaks along its length, a little darker or lighter, the same every time. */
function grain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, n: number): void {
  const along = w >= h;
  const across = along ? h : w;
  const lines = Math.max(3, Math.round(across / 3));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let k = 0; k < lines; k++) {
    const t = tone(n * 31 + k);
    ctx.strokeStyle = tint(color, t > 0 ? 0.12 : -0.18);
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(tone(n * 17 + k * 3));
    ctx.lineWidth = 0.6 + Math.abs(t);
    const at = (k + 0.5 + 0.4 * t) * (across / lines);
    const wave = across * 0.08 * tone(n + k * 7);
    ctx.beginPath();
    if (along) {
      ctx.moveTo(x, y + at);
      ctx.bezierCurveTo(x + w / 3, y + at + wave, x + (2 * w) / 3, y + at - wave, x + w, y + at);
    } else {
      ctx.moveTo(x + at, y);
      ctx.bezierCurveTo(x + at + wave, y + h / 3, x + at - wave, y + (2 * h) / 3, x + at, y + h);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** The pattern as a repeating texture, in sRGB, its period in metres. */
export function patternTexture(p: SurfacePattern, color: string, anisotropy: number): { readonly texture: THREE.CanvasTexture; readonly period: THREE.Vector2 } {
  const { canvas, period } = paintPattern(p, color);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return { texture, period: new THREE.Vector2(period.u, period.v) };
}
