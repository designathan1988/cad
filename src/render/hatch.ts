// The cut patterns of the plan (elements/material/schema.ts: CutPattern): a small tile drawn once per
// pattern, colour and pixel ratio, repeated over the cut pieces of a wall layer made of that material.
// The tile is drawn at device pixels and scaled back, so its lines stay sharp on a dense screen.

import type { CutPattern } from '../elements/material/schema';
import { isPdfCanvas } from '../io/pdf-canvas';

/** The tile's side, in CSS pixels: the spacing of the pattern's lines on screen, at any zoom. */
const TILE = 8;

const tiles = new Map<string, CanvasPattern | null>();

/** Lines of a tile, in tile units (0..TILE); null for a pattern with none (solid, none). */
function strokes(pattern: CutPattern): readonly (readonly [number, number][])[] | null {
  const t = TILE;
  switch (pattern) {
    // Masonry: lines at 45°, as the usual section hatch of brick and block.
    case 'brick':
      return [
        [[0, t], [t, 0]],
        [[-1, 1], [1, -1]],
        [[t - 1, t + 1], [t + 1, t - 1]],
      ];
    // Wood: lines at 45° both ways.
    case 'wood':
      return [
        [[0, t], [t, 0]],
        [[0, 0], [t, t]],
      ];
    // Insulation: a zigzag across.
    case 'insulation':
      return [[[0, t / 2], [t / 4, 1], [(3 * t) / 4, t - 1], [t, t / 2]]];
    // Concrete: dots and a small triangle, apart from each other.
    case 'concrete':
      return [
        [[1.5, 1.5], [2.5, 1.5]],
        [[5, 4], [7, 6.5], [4.5, 6.5], [5, 4]],
      ];
    default:
      return null;
  }
}

/**
 * A cut's pattern on paper (a section's: app/section-drawing.ts), where a unit is a millimetre: its tile
 * `mm` wide, drawn at `pxPerMm` (the page's resolution) with lines `pen` mm wide. Not the plan's tiles:
 * those are a screen pixel wide.
 */
export function paperHatch(ctx: CanvasRenderingContext2D, pattern: CutPattern, color: string, mm: number, pxPerMm: number, pen: number): CanvasPattern | null {
  const lines = strokes(pattern);
  if (!lines) return null;
  // On a vector page (io/pdf-canvas.ts): the tile's lines themselves, a millimetre-wide tile's.
  if (isPdfCanvas(ctx)) return ctx.vectorPattern(lines, TILE, color, (pen * TILE) / mm, mm / TILE) as unknown as CanvasPattern;
  const tile = document.createElement('canvas');
  tile.width = tile.height = Math.max(4, Math.round(mm * pxPerMm));
  const c = tile.getContext('2d');
  if (!c) return null;
  c.scale(tile.width / TILE, tile.height / TILE);
  c.strokeStyle = color;
  c.lineWidth = (pen * TILE) / mm;
  c.lineJoin = 'round';
  for (const line of lines) {
    c.beginPath();
    line.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
    c.stroke();
  }
  const made = ctx.createPattern(tile, 'repeat');
  made?.setTransform(new DOMMatrix().scale(mm / tile.width));
  return made;
}

/** The repeating pattern of a cut, in `color`; null when the pattern has no lines. */
export function hatchPattern(ctx: CanvasRenderingContext2D, pattern: CutPattern, color: string, dpr: number): CanvasPattern | null {
  // On a vector page: the lines, a unit the tile's (the plan's pen units on paper), never kept.
  if (isPdfCanvas(ctx)) {
    const lines = strokes(pattern);
    return lines ? (ctx.vectorPattern(lines, TILE, color, Math.max(0.75, 1 / dpr)) as unknown as CanvasPattern) : null;
  }
  const key = `${pattern}|${color}|${dpr}`;
  if (tiles.has(key)) return tiles.get(key)!;
  const lines = strokes(pattern);
  let made: CanvasPattern | null = null;
  if (lines) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = Math.round(TILE * dpr);
    const c = tile.getContext('2d');
    if (c) {
      c.scale(tile.width / TILE, tile.height / TILE);
      c.strokeStyle = color;
      c.lineWidth = Math.max(0.75, 1 / dpr);
      c.lineJoin = 'round';
      for (const line of lines) {
        c.beginPath();
        line.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
        c.stroke();
      }
      made = ctx.createPattern(tile, 'repeat');
      made?.setTransform(new DOMMatrix().scale(1 / dpr));
    }
  }
  tiles.set(key, made);
  return made;
}
