// A material's surface pattern (docs/plano-de-escopo.md, phase 8: procedural textures): tiles by piece
// size, joint width and colour, laid aligned, staggered, in herringbone or as a chequerboard, with
// some variation of colour between the pieces; wood by board; brick by course. Made in the browser,
// with no image: the pieces of one period of the pattern (here) are painted into a texture
// (render/pattern-texture.ts) that the 3D lays on every face in the world's metres.

/** A #rrggbb colour (as schema.ts's: that file builds on this one). */
const isColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

export type PatternKind = 'tiles' | 'wood' | 'brick' | 'marble' | 'granite';
export type PatternLayout = 'stack' | 'running' | 'herringbone' | 'checker';

export const PATTERN_KINDS: readonly PatternKind[] = ['tiles', 'wood', 'brick', 'marble', 'granite'];
export const PATTERN_LAYOUTS: readonly PatternLayout[] = ['stack', 'running', 'herringbone', 'checker'];

export interface SurfacePattern {
  readonly kind: PatternKind;
  readonly layout: PatternLayout;
  /** A piece's length (along the pattern's u) and width (along v), m. */
  readonly length: number;
  readonly width: number;
  /** The joint between pieces, m (0: none, the boards of a table top). */
  readonly joint: number;
  readonly jointColor: string;
  /** The chequerboard's other colour (the material's colour darkened when not set). */
  readonly color2?: string;
  /** How much the pieces' colours differ, 0 (all the same) to 1. */
  readonly variation: number;
  /** The pattern turned on the surface, degrees (a herringbone at 45). */
  readonly angle: number;
}

/** Each kind as it is first laid (the material's dialog, a built-in material). */
export const PATTERN_DEFAULTS: Readonly<Record<PatternKind, SurfacePattern>> = {
  tiles: { kind: 'tiles', layout: 'stack', length: 0.6, width: 0.6, joint: 0.003, jointColor: '#b9b3a8', variation: 0.05, angle: 0 },
  wood: { kind: 'wood', layout: 'running', length: 0.9, width: 0.12, joint: 0.001, jointColor: '#5b412b', variation: 0.14, angle: 0 },
  brick: { kind: 'brick', layout: 'running', length: 0.23, width: 0.065, joint: 0.01, jointColor: '#cfc8bb', variation: 0.12, angle: 0 },
  // Slabs of stone: veins wandering across each (marble), speckles over each (granite).
  marble: { kind: 'marble', layout: 'stack', length: 1.2, width: 0.6, joint: 0.001, jointColor: '#c9c5bd', variation: 0.04, angle: 0 },
  granite: { kind: 'granite', layout: 'stack', length: 1.2, width: 0.6, joint: 0.001, jointColor: '#2a2a2a', variation: 0.03, angle: 0 },
};

/** A piece's least and greatest size, the greatest joint (m). */
export const PIECE_MIN = 0.01;
export const PIECE_MAX = 5;
export const JOINT_MAX = 0.05;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isPattern = (p: unknown): p is SurfacePattern => {
  if (typeof p !== 'object' || p === null) return false;
  const x = p as Record<string, unknown>;
  return (
    (PATTERN_KINDS as readonly unknown[]).includes(x.kind) &&
    (PATTERN_LAYOUTS as readonly unknown[]).includes(x.layout) &&
    finite(x.length) &&
    x.length >= PIECE_MIN &&
    x.length <= PIECE_MAX &&
    finite(x.width) &&
    x.width >= PIECE_MIN &&
    x.width <= PIECE_MAX &&
    finite(x.joint) &&
    x.joint >= 0 &&
    x.joint <= JOINT_MAX &&
    isColor(x.jointColor) &&
    (x.color2 === undefined || isColor(x.color2)) &&
    finite(x.variation) &&
    x.variation >= 0 &&
    x.variation <= 1 &&
    finite(x.angle) &&
    x.angle >= -360 &&
    x.angle <= 360
  );
};

/** One piece of a period: its rectangle (m, from the period's corner), its tone (−1 to 1) and whether it is the other colour. */
export interface Piece {
  readonly u: number;
  readonly v: number;
  readonly w: number;
  readonly h: number;
  readonly tone: number;
  readonly alt: boolean;
}

/** How many pieces a period has along each way: the variation repeats no sooner. */
const REPEAT = 4;

/** A tone from −1 to 1 for the n-th piece, the same every time (the texture is made again unchanged). */
export function tone(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * One period of the pattern: its size (m) and its pieces, each laid inside it or across its edge (the
 * texture wraps them round). The pieces leave the joint between them; together with the joints they
 * cover the period once.
 */
export function patternPieces(p: SurfacePattern): { readonly period: { readonly u: number; readonly v: number }; readonly pieces: readonly Piece[] } {
  const j = p.joint;
  if (p.layout === 'herringbone') {
    // Pieces n times as long as wide (the joints counted), so the pattern repeats along both axes: a
    // run of long pieces each a width further on and up, a short one standing on each, the runs a
    // length apart across (u, −u). It repeats every two lengths both ways.
    const wide = p.width + j;
    const n = Math.max(2, Math.round((p.length + j) / wide));
    const long = n * wide;
    const P = 2 * long;
    const seen = new Set<string>();
    const pieces: Piece[] = [];
    // Into the period, a hair under its end taken as its start (the same piece, found again from
    // another run, came out at P − 1e-16 and was laid twice).
    const mod = (x: number) => {
      const r = ((x % P) + P) % P;
      return P - r < 1e-9 ? 0 : r;
    };
    for (let m = -2; m <= 2; m++) {
      for (let k = -2 * n - 2; k <= 2 * n + 2; k++) {
        const ou = k * wide + m * long;
        const ov = k * wide - m * long;
        for (const [du, dv, w, h] of [
          [0, 0, long - j, wide - j],
          [0, wide, wide - j, long - j],
        ] as const) {
          const u = mod(ou + du);
          const v = mod(ov + dv);
          const key = `${Math.round(u * 1e6)}:${Math.round(v * 1e6)}:${w > h ? 'h' : 'v'}`;
          if (seen.has(key)) continue;
          seen.add(key);
          pieces.push({ u, v, w, h, tone: tone(pieces.length), alt: false });
        }
      }
    }
    return { period: { u: P, v: P }, pieces };
  }
  const pu = p.length + j;
  const pv = p.width + j;
  // Each row's shift: half a piece for a running bond, a staggered quarter for wood's boards.
  const shifts = p.layout === 'running' ? (p.kind === 'wood' ? [0, 0.5, 0.25, 0.75] : [0, 0.5, 0, 0.5]) : [0, 0, 0, 0];
  const pieces: Piece[] = [];
  for (let r = 0; r < REPEAT; r++) {
    for (let c = 0; c < REPEAT; c++) {
      pieces.push({ u: (c + shifts[r]!) * pu, v: r * pv, w: p.length, h: p.width, tone: tone(r * REPEAT + c), alt: p.layout === 'checker' && (r + c) % 2 === 1 });
    }
  }
  return { period: { u: REPEAT * pu, v: REPEAT * pv }, pieces };
}
