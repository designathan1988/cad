// The pointer over the drawing says which tool is on, as in Revit, ArchiCAD and SketchUp: a cross to
// aim with (its centre is the point), the tool's own icon beside it. Drawn dark on a light outline, so
// it reads on the light plan and the dark one alike.

import { type IconName, iconPath } from '../i18n/icons';
import type { ToolId } from './shell';

const GLYPH: Partial<Record<ToolId, IconName>> = {
  wall: 'wall',
  door: 'door',
  window: 'window',
  room: 'room',
  floor: 'slab',
  measure: 'ruler',
  column: 'column',
  beam: 'beam',
  roof: 'roof',
  stair: 'stair',
  railing: 'railing',
  grid: 'hash',
  object: 'box',
  dimension: 'dimension',
  guide: 'guide',
  section: 'cut',
  note: 'text',
  levelMark: 'height',
  mark: 'tag',
  calibrate: 'ruler',
  modify: 'move',
  split: 'split',
  corner: 'corner',
};

/** A 32 px cursor: the cross centred at (10, 10), the icon (when the tool has one) at a third of its size below and right of it. */
function aim(glyph: IconName | undefined): string {
  const cross = 'M10 1v6M10 13v6M1 10h6M13 10h6';
  const mark = glyph
    ? `<g transform="translate(17 17) scale(0.55)"><path d="${iconPath(glyph)}" stroke="white" stroke-width="5"/><path d="${iconPath(glyph)}" stroke="#111" stroke-width="2"/></g>`
    : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${cross}" stroke="white" stroke-width="3.2"/><path d="${cross}" stroke="#111" stroke-width="1.2"/>` +
    mark +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, crosshair`;
}

const cache = new Map<ToolId, string>();

/** The CSS cursor over the drawing for a tool; `grabbing` while the view is being panned. */
export function toolCursor(tool: ToolId, panning = false): string {
  if (panning) return 'grabbing';
  // Every tool that clicks points on the drawing aims with the cross (its centre the point the snaps use);
  // only selecting keeps the arrow. The arrow's point is its tip, not where a column or a stair went.
  if (tool === 'select') return 'default';
  let c = cache.get(tool);
  if (c === undefined) cache.set(tool, (c = aim(GLYPH[tool])));
  return c;
}
