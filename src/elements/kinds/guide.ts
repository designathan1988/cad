// Guides in the registry (contract.ts): elements/guide holds the element itself. A guide is a line
// without ends: framing counts its point only, and only a crossing window takes it.

import { add, cross, distance, normalize, sub } from '../../core/vector';
import { isObject, isPoint } from '../../core/guards';
import type { ElementKind } from '../contract';
import { clearGuides } from '../guide/commands';
import { guideFields } from '../guide/fields';
import { GUIDE_PREFIX, type Guide } from '../guide/schema';
import { GUIDE_PX } from '../../tools/guide-tool';

/** A point guide's reach about its point beyond the pick distance (m). */
const POINT_GUIDE_R = 0.02;

export const guideKind: ElementKind<Guide, Guide> = {
  key: 'guides',
  prefix: GUIDE_PREFIX,
  category: 'guides',
  // Over the walls and the doors, thin: a guide laid on a wall's face is seen there.
  layer: 'over',
  endless: true,
  icon: 'guide',
  one: 'guide.title',
  many: 'guide.titleMany',
  dropped: 'fix.droppedGuides',


  valid: (g): g is Guide =>
    isObject(g) &&
    typeof g.id === 'string' &&
    typeof g.levelId === 'string' &&
    isPoint(g.point) &&
    isPoint(g.dir) &&
    // A unit direction: a zero one would be no line at all.
    Math.abs(Math.hypot((g.dir as { x: number }).x, (g.dir as { y: number }).y) - 1) < 1e-6 &&
    (g.shape === undefined || g.shape === 'point' || (g.shape === 'circle' && typeof g.radius === 'number' && Number.isFinite(g.radius) && g.radius > 0)),
  memo: 'element',
  derive: (_doc, g) => g,
  element: (g) => g,
  // Its point and one step along: the line it runs on (contract.ts: endless).
  outlines: (g) => [[g.point, add(g.point, g.dir)]],
  hit: (g, p, _near, scale) =>
    g.shape === 'point'
      ? distance(p, g.point) <= GUIDE_PX / scale + POINT_GUIDE_R
      : g.shape === 'circle'
        ? Math.abs(distance(p, g.point) - g.radius!) <= GUIDE_PX / scale
        : Math.abs(cross(g.dir, sub(p, g.point))) <= GUIDE_PX / scale,
  // Before the room it runs across, after the walls.
  pick: 'afterWalls',
  moved: (g, d) => ({ ...g, point: { x: g.point.x + d.x, y: g.point.y + d.y } }),
  mapped: (g, t, id) => ({
    ...g,
    id,
    point: t.map(g.point),
    dir: normalize(sub(t.map(add(g.point, g.dir)), t.map(g.point))),
    // A circle scaled with the transform.
    ...(g.shape === 'circle' ? { radius: distance(t.map(g.point), t.map(add(g.point, { x: g.radius!, y: 0 }))) } : {}),
  }),
  // Every guide of the level is like any other.
  similar: () => true,
  plan: (p, g, lit) => {
    const colour = lit ? p.color('--wall-sel') : p.color('--guide');
    if (!g.shape) return p.line(g.point, g.dir, colour, lit ? 2 : 1, lit ? [10, 4] : [8, 5]);
    const { ctx } = p;
    const c = p.toScreen(g.point);
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = lit ? 2 : 1;
    ctx.beginPath();
    if (g.shape === 'point') {
      // A small circle with a cross: a point to draw from.
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.moveTo(c.x - 8, c.y);
      ctx.lineTo(c.x + 8, c.y);
      ctx.moveTo(c.x, c.y - 8);
      ctx.lineTo(c.x, c.y + 8);
    } else {
      ctx.setLineDash(lit ? [10, 4] : [8, 5]);
      ctx.arc(c.x, c.y, g.radius! * p.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(c.x - 4, c.y);
      ctx.lineTo(c.x + 4, c.y);
      ctx.moveTo(c.x, c.y - 4);
      ctx.lineTo(c.x, c.y + 4);
    }
    ctx.stroke();
    ctx.restore();
  },
  fields: (items, { dispatch }) => guideFields(() => dispatch(clearGuides(items[0]!.levelId))),
};
