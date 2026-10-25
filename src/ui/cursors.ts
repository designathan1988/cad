// The pointer over the drawing says which tool is on, as in Revit, ArchiCAD and SketchUp: a cross to
// aim with (its centre is the point), the tool's own icon beside it. Drawn dark on a light outline, so
// it reads on the light plan and the dark one alike.

import { type IconName, iconPath } from './icons';
import type { ToolId } from './shell';

const GLYPH: Partial<Record<ToolId, IconName>> = {
  wall: 'wall',
  door: 'door',
  window: 'window',
  room: 'room',
  floor: 'slab',
  measure: 'ruler',
};

/** A 32 px cursor: the cross centred at (10, 10), the icon at a third of its size below and right of it. */
function aim(glyph: IconName): string {
  const cross = 'M10 1v6M10 13v6M1 10h6M13 10h6';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${cross}" stroke="white" stroke-width="3.2"/><path d="${cross}" stroke="#111" stroke-width="1.2"/>` +
    `<g transform="translate(17 17) scale(0.55)"><path d="${iconPath(glyph)}" stroke="white" stroke-width="5"/><path d="${iconPath(glyph)}" stroke="#111" stroke-width="2"/></g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, crosshair`;
}

const cache = new Map<ToolId, string>();

/** The CSS cursor over the drawing for a tool; `grabbing` while the view is being panned. */
export function toolCursor(tool: ToolId, panning = false): string {
  if (panning) return 'grabbing';
  const glyph = GLYPH[tool];
  if (!glyph) return 'default';
  let c = cache.get(tool);
  if (c === undefined) cache.set(tool, (c = aim(glyph)));
  return c;
}
