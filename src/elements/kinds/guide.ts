// Guides in the registry (contract.ts): elements/guide holds the element itself. A guide is a line
// without ends: framing counts its point only, and only a crossing window takes it.

import { add, cross, normalize, sub } from '../../core/vector';
import { isObject, isPoint } from '../../core/guards';
import type { ElementKind } from '../contract';
import { clearGuides } from '../guide/commands';
import { guideFields } from '../guide/fields';
import { GUIDE_PREFIX, type Guide } from '../guide/schema';
import { GUIDE_PX } from '../../tools/guide-tool';

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
  exportName: 'guide.title',
  exportColour: 'structure',
  valid: (g): g is Guide =>
    isObject(g) &&
    typeof g.id === 'string' &&
    typeof g.levelId === 'string' &&
    isPoint(g.point) &&
    isPoint(g.dir) &&
    // A unit direction: a zero one would be no line at all.
    Math.abs(Math.hypot((g.dir as { x: number }).x, (g.dir as { y: number }).y) - 1) < 1e-6,
  derive: (_doc, g) => g,
  element: (g) => g,
  // Its point and one step along: the line it runs on (contract.ts: endless).
  outlines: (g) => [[g.point, add(g.point, g.dir)]],
  hit: (g, p, _near, scale) => Math.abs(cross(g.dir, sub(p, g.point))) <= GUIDE_PX / scale,
  // Before the room it runs across, after the walls.
  pick: 'afterWalls',
  moved: (g, d) => ({ ...g, point: { x: g.point.x + d.x, y: g.point.y + d.y } }),
  mapped: (g, t, id) => ({ ...g, id, point: t.map(g.point), dir: normalize(sub(t.map(add(g.point, g.dir)), t.map(g.point))) }),
  // Every guide of the level is like any other.
  similar: () => true,
  plan: (p, g, lit) => p.line(g.point, g.dir, lit ? p.color('--wall-sel') : p.color('--guide'), lit ? 2 : 1, lit ? [10, 4] : [8, 5]),
  fields: (items, { dispatch }) => guideFields(() => dispatch(clearGuides(items[0]!.levelId))),
};
