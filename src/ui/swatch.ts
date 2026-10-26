// The thumbnail of a wall type: its layers side by side, each as wide as its share of the thickness
// (at least a pixel, so a thin finish still shows), each in its material's colour, as the plan and the
// 3D paint it.

import { type Material, materialIn } from '../elements/material/schema';
import type { WallLayer } from '../elements/wall/schema';

export function layerBands(layers: readonly WallLayer[], width: number, materials: readonly Material[]): { x: number; w: number; fill: string }[] {
  const total = layers.reduce((s, l) => s + l.thickness, 0) || 1;
  const widths = layers.map((l) => Math.max(1, Math.round((l.thickness / total) * width)));
  // The rounding goes to the widest band, so the bands fill the width exactly.
  const widest = widths.indexOf(Math.max(...widths));
  widths[widest] = widths[widest]! + width - widths.reduce((s, w) => s + w, 0);
  let x = 0;
  return layers.map((l, i) => {
    const band = { x, w: widths[i]!, fill: materialIn(materials, l.materialId).color };
    x += widths[i]!;
    return band;
  });
}

/** The thumbnail as an inline SVG, 40 × 16. Always shown beside the type's name, so readers skip it. */
export function layerSwatch(layers: readonly WallLayer[], materials: readonly Material[]): string {
  const rects = layerBands(layers, 40, materials)
    .map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="16" fill="${b.fill}"/>`)
    .join('');
  return `<svg class="swatch" width="40" height="16" viewBox="0 0 40 16" aria-hidden="true">${rects}</svg>`;
}
