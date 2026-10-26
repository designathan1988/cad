// Grid axes in the registry (contract.ts): elements/grid holds the element itself. An axis has no
// level: it is on every one, and pasting onto another level leaves it out.

import { isObject, isPoint } from '../../core/guards';
import { add, distance, normalize, type Point2, sub } from '../../core/vector';
import { t } from '../../ui/i18n';
import type { ElementKind, PlanPaint } from '../contract';
import { renameGrid } from '../grid/commands';
import { gridFields } from '../grid/fields';
import { GRID_PREFIX, type Grid, nextGridName } from '../grid/schema';
import { nearSegment } from './paint';

/** A bubble's radius on screen (px). */
export const GRID_BUBBLE_PX = 12;

/** A bubble's radius in the DXF (m). */
const BUBBLE_R = 0.35;

export const gridKind: ElementKind<Grid, Grid> = {
  key: 'grids',
  prefix: GRID_PREFIX,
  category: 'guides',
  everyLevel: true,
  icon: 'hash',
  one: 'grid.title',
  many: 'grid.titleMany',
  title: (items) => ({ icon: 'hash', text: items.length === 1 ? t('grid.title', { name: items[0]!.name }) : t('grid.titleMany', { n: items.length }) }),
  hint: 'grid.held',
  dropped: 'fix.droppedGrids',
  exportName: 'grid.title',
  exportColour: 'structure',
  valid: (g): g is Grid =>
    isObject(g) && typeof g.id === 'string' && typeof g.name === 'string' && g.name.trim() !== '' && isPoint(g.start) && isPoint(g.end) && JSON.stringify(g.start) !== JSON.stringify(g.end),
  memo: 'element',
  derive: (_doc, g) => g,
  element: (g) => g,
  outlines: (g) => [[g.start, g.end]],
  hit: (g, p, near) => nearSegment(p, g.start, g.end, near),
  // A bubble at a corner lies over the walls there: a click in it takes the axis before them.
  grab: (g, p, scale) => {
    const bubble = GRID_BUBBLE_PX / scale;
    const u = normalize(sub(g.end, g.start));
    const ends = [sub(g.start, { x: u.x * bubble, y: u.y * bubble }), add(g.end, { x: u.x * bubble, y: u.y * bubble })];
    return ends.some((c) => distance(p, c) <= bubble);
  },
  // After the walls on it: a click on a wall over an axis takes the wall.
  pick: 'afterWalls',
  moved: (g, d) => ({ ...g, start: { x: g.start.x + d.x, y: g.start.y + d.y }, end: { x: g.end.x + d.x, y: g.end.y + d.y } }),
  mapped: (g, t, id) => ({ ...g, id, start: t.map(g.start), end: t.map(g.end) }),
  // A copied axis is named on from the last of its kind, as a new one is.
  copied: (all, g) => ({ ...g, name: nextGridName(all, g.start, g.end) }),
  plan: (p, g, lit) => drawAxis(p, g.start, g.end, g.name, lit ? p.color('--wall-sel') : p.color('--text-2')),
  // The line, and past each end a bubble (a 16-sided circle) with the name.
  dxf: (g, out) => {
    const len = distance(g.start, g.end);
    if (len === 0) return;
    const ux = (g.end.x - g.start.x) / len;
    const uy = (g.end.y - g.start.y) / len;
    out.line('S-GRID', g.start, g.end);
    for (const [q, s] of [
      [g.start, -1],
      [g.end, 1],
    ] as const) {
      const c = { x: q.x + ux * BUBBLE_R * s, y: q.y + uy * BUBBLE_R * s };
      out.polyline('S-GRID', Array.from({ length: 16 }, (_, i) => ({ x: c.x + BUBBLE_R * Math.cos((i * Math.PI) / 8), y: c.y + BUBBLE_R * Math.sin((i * Math.PI) / 8) })), true);
      out.text('S-GRID', c, BUBBLE_R, g.name);
    }
  },
  fields: (items, { dispatch }) => gridFields(items, { renameGrid: (id, name) => dispatch(renameGrid(id, name)) }),
};

/** An axis in plan: dashed and dotted, a bubble with its name past each end. Also the one being drawn. */
export function drawAxis(p: PlanPaint, start: Point2, end: Point2, name: string, colour: string): void {
  const { ctx } = p;
  const a = p.toScreen(start);
  const b = p.toScreen(end);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return;
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const r = GRID_BUBBLE_PX;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.setLineDash([14, 4, 2, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = p.font('600', '--fs-sm');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [q, s] of [
    [a, -1],
    [b, 1],
  ] as const) {
    const c = { x: q.x + u.x * r * s, y: q.y + u.y * r * s };
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = p.color('--canvas');
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colour;
    ctx.fillText(name, c.x, c.y + 0.5);
  }
  ctx.restore();
}
