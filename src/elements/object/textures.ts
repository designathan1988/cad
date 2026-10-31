// A material's pattern painted (elements/material/pattern.ts): one period of it on a canvas, the joints
// first and the pieces over them, each in the material's colour lighter or darker by its tone, wood's
// boards with their grain. The texture repeats; the 3D lays it in metres (scene-3d.ts, layerMaterial).

import * as THREE from 'three';
import { patternPieces, type SurfacePattern, tone } from '../material/pattern';

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
  if (p.kind === 'flagstone') {
    stones(ctx, p, color, period, sx, sy);
    return { canvas, period };
  }
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
        else if (p.kind === 'marble') veins(ctx, x, y, w, h, base, i);
        else if (p.kind === 'granite') speckles(ctx, x, y, w, h, base, i);
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

/** A number in [0, 1) from n and k, the same every time (a slab's veins drawn alike on each repaint). */
const hash = (n: number, k: number): number => {
  const x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * A marble slab's veins: a few long wandering curves across it, darker than the stone, each a thin main
 * line with fainter offshoots; the slab clipped so they stop at its edges.
 */
function veins(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, n: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const count = 2 + Math.floor(hash(n, 1) * 3);
  for (let k = 0; k < count; k++) {
    // From one side to the other, bending three times.
    const across = hash(n, k + 10) > 0.5;
    const start = { x: across ? x : x + w * hash(n, k + 20), y: across ? y + h * hash(n, k + 30) : y };
    const end = { x: across ? x + w : x + w * hash(n, k + 40), y: across ? y + h * hash(n, k + 50) : y + h };
    const bend = (t: number, j: number) => ({
      x: start.x + (end.x - start.x) * t + (hash(n, k * 7 + j) - 0.5) * w * 0.35,
      y: start.y + (end.y - start.y) * t + (hash(n, k * 11 + j) - 0.5) * h * 0.35,
    });
    const [c1, c2, c3] = [bend(0.3, 1), bend(0.55, 2), bend(0.8, 3)];
    for (const [width, alpha, shift] of [
      [Math.max(1, Math.min(w, h) * 0.006), 0.55, 0],
      [Math.max(1, Math.min(w, h) * 0.018), 0.12, 0],
      [Math.max(1, Math.min(w, h) * 0.003), 0.35, Math.min(w, h) * 0.02],
    ] as const) {
      ctx.strokeStyle = tint(color, -0.45);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(start.x + shift, start.y);
      ctx.bezierCurveTo(c1.x + shift, c1.y, c2.x, c2.y + shift, c3.x, c3.y);
      ctx.quadraticCurveTo((c3.x + end.x) / 2 + shift, (c3.y + end.y) / 2, end.x, end.y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Irregular stones: the grid of pieces with each corner, and each side's middle, moved a little, the same
 * for the stones that share it (so they fit) and again a period on (so the texture repeats); each stone
 * its own tone, the joint drawn round it.
 */
function stones(ctx: CanvasRenderingContext2D, p: SurfacePattern, color: string, period: { readonly u: number; readonly v: number }, sx: number, sy: number): void {
  const R = 4;
  const pu = period.u / R;
  const pv = period.v / R;
  const m = (k: number) => ((k % R) + R) % R;
  // A corner (i, j) and the middles of the sides from it (h: along u, v: along v), moved within the cell.
  const corner = (i: number, j: number) => ({ x: (i + (hash(m(i) * 7 + m(j), 1) - 0.5) * 0.45) * pu, y: (j + (hash(m(i) * 7 + m(j), 2) - 0.5) * 0.45) * pv });
  const midH = (i: number, j: number) => ({ x: (i + 0.5 + (hash(m(i) * 11 + m(j), 3) - 0.5) * 0.3) * pu, y: (j + (hash(m(i) * 11 + m(j), 4) - 0.5) * 0.35) * pv });
  const midV = (i: number, j: number) => ({ x: (i + (hash(m(i) * 13 + m(j), 5) - 0.5) * 0.35) * pu, y: (j + 0.5 + (hash(m(i) * 13 + m(j), 6) - 0.5) * 0.3) * pv });
  ctx.lineJoin = 'round';
  for (let j = -1; j <= R; j++) {
    for (let i = -1; i <= R; i++) {
      const ring = [corner(i, j), midH(i, j), corner(i + 1, j), midV(i + 1, j), corner(i + 1, j + 1), midH(i, j + 1), corner(i, j + 1), midV(i, j)];
      ctx.beginPath();
      ring.forEach((q, k) => (k === 0 ? ctx.moveTo(q.x * sx, q.y * sy) : ctx.lineTo(q.x * sx, q.y * sy)));
      ctx.closePath();
      ctx.fillStyle = tint(color, (hash(m(i) * 5 + m(j), 9) - 0.5) * 2 * p.variation);
      ctx.fill();
      if (p.joint > 0) {
        ctx.strokeStyle = p.jointColor;
        ctx.lineWidth = Math.max(1, p.joint * sx);
        ctx.stroke();
      }
    }
  }
}

/** A granite slab's grain: speckles lighter and darker than the stone, all over it. */
function speckles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, n: number): void {
  const count = Math.round((w * h) / 30);
  const size = Math.max(1, Math.min(w, h) * 0.004);
  for (let k = 0; k < count; k++) {
    const r = hash(n, k);
    ctx.fillStyle = r < 0.45 ? tint(color, 0.55) : r < 0.85 ? tint(color, -0.5) : tint(color, 0.25);
    ctx.fillRect(x + hash(n, k + 0.31) * w, y + hash(n, k + 0.67) * h, size * (0.6 + r), size * (0.6 + hash(n, k + 0.13)));
  }
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

/**
 * Texture coordinates for a pattern on a geometry already in the world, as the 3D view's patterned shader
 * lays it (scene-3d.ts): a face looking up or down in plan, one looking sideways along its length and up;
 * over the pattern's period (m), turned by its angle (radians). Made flat (each triangle its own corners)
 * so a face takes its own direction.
 */
export function patternUvAt(g: THREE.BufferGeometry, period: THREE.Vector2, angle: number): THREE.BufferGeometry {
  const flat = g.index ? g.toNonIndexed() : g;
  if (flat !== g) g.dispose();
  const pos = flat.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let t = 0; t + 2 < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      const [x, y] = ay >= Math.max(ax, az) ? [v.x, -v.z] : ax >= az ? [-v.z, v.y] : [v.x, v.y];
      uv[(t + k) * 2] = (cos * x + sin * y) / period.x;
      uv[(t + k) * 2 + 1] = (-sin * x + cos * y) / period.y;
    }
  }
  flat.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return flat;
}

/**
 * Textures painted for the previews, by pattern and colour: the dialog's redraws paint each once. The
 * latest used are kept (a Map keeps its order: each one used goes to the end) and the oldest disposed: kept
 * all, every colour or joint tried in a dialog held a canvas of up to 1024 px and its GPU copy for good.
 * A disposed one still on a preview is uploaded again by three.js when drawn.
 */
const previewTextures = new Map<string, { readonly texture: THREE.CanvasTexture; readonly period: THREE.Vector2 }>();
const PREVIEW_TEXTURES = 32;

/**
 * A piece's mesh as the previews draw it (the objects dialog, the definition editor): its material's colour,
 * finish and pattern (laid as the 3D view lays it), glass and the like seen through.
 */
export function previewMesh(geometry: THREE.BufferGeometry, m: { readonly color: string; readonly roughness: number; readonly metalness: number; readonly pattern?: SurfacePattern }, opacity: number | undefined): THREE.Mesh {
  const see = { transparent: opacity !== undefined, opacity: opacity ?? 1 };
  if (!m.pattern) return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: m.color, roughness: m.roughness, metalness: m.metalness, ...see }));
  const key = JSON.stringify([m.pattern, m.color]);
  let t = previewTextures.get(key);
  if (t) previewTextures.delete(key);
  else t = patternTexture(m.pattern, m.color, 4);
  previewTextures.set(key, t);
  for (const [old, x] of previewTextures) {
    if (previewTextures.size <= PREVIEW_TEXTURES) break;
    x.texture.dispose();
    previewTextures.delete(old);
  }
  const g = patternUvAt(geometry, t.period, (m.pattern.angle * Math.PI) / 180);
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t.texture, roughness: m.roughness, metalness: m.metalness, ...see }));
}
