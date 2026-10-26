// Stairs and ramps in the registry (contract.ts): elements/stair holds the element and its layout.

import { finite, isObject, isPoint } from '../../core/guards';
import { stairGeometry } from '../../render/prisms';
import type { ElementKind } from '../contract';
import { insideRing } from '../room/derive';
import { updateStairs } from '../stair/commands';
import { stairFields } from '../stair/fields';
import { type StairSolid, stairSolid } from '../stair/geometry';
import { type Stair, STAIR_PREFIX } from '../stair/schema';
import { trace } from './paint';

export const stairKind: ElementKind<Stair, StairSolid> = {
  key: 'stairs',
  prefix: STAIR_PREFIX,
  category: 'floors',
  icon: 'stair',
  one: 'stair.title',
  many: 'stair.titleMany',
  dropped: 'fix.droppedStairs',
  exportName: 'export.stair',
  exportColour: 'floor',
  valid: (s): s is Stair =>
    isObject(s) &&
    typeof s.id === 'string' &&
    typeof s.levelId === 'string' &&
    (s.kind === 'straight' || s.kind === 'l' || s.kind === 'u' || s.kind === 'spiral' || s.kind === 'ramp') &&
    (s.grade === undefined || (finite(s.grade) && s.grade > 0)) &&
    isPoint(s.at) &&
    finite(s.angle) &&
    finite(s.width) &&
    s.width > 0 &&
    finite(s.tread) &&
    s.tread > 0 &&
    (s.turn === 'left' || s.turn === 'right') &&
    (s.height === undefined || (finite(s.height) && s.height > 0)) &&
    (s.railing === undefined || typeof s.railing === 'boolean'),
  // From its level's floor, up its level's height unless it sets its own.
  derive: (doc, s) => {
    const level = doc.levels.find((l) => l.id === s.levelId) ?? { elevation: 0, height: 2.8 };
    return stairSolid(s, level.height, level.elevation);
  },
  element: (s) => s.stair,
  outlines: (s) => s.parts.map((p) => p.polygon),
  hit: (s, p) => s.parts.some((q) => insideRing(q.polygon, p)),
  pick: 'beforeWalls',
  span: (s) => ({ bottom: s.bottom, top: s.bottom + s.height }),
  moved: (s, d) => ({ ...s, at: { x: s.at.x + d.x, y: s.at.y + d.y } }),
  // It turns with a turn; mirrored, it turns the other way.
  mapped: (s, t, id) => {
    const at = t.map(s.at);
    const x = t.map({ x: s.at.x + Math.cos(s.angle), y: s.at.y + Math.sin(s.angle) });
    return { ...s, id, at, angle: Math.atan2(x.y - at.y, x.x - at.x), width: s.width * t.factor, ...(t.mirror ? { turn: s.turn === 'left' ? 'right' : 'left' } : {}) };
  },
  // Each step and landing outlined, the walking line from the first step to the top, an arrow there.
  plan: (p, s, lit) => {
    const { ctx } = p;
    ctx.save();
    ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--wall-line');
    ctx.lineWidth = lit ? 1.5 : 1;
    for (const part of s.parts) {
      trace(p, part.polygon);
      if (lit) {
        ctx.fillStyle = p.color('--accent-soft');
        ctx.fill();
      }
      ctx.stroke();
    }
    const walk = s.walk.map(p.toScreen);
    if (walk.length >= 2) {
      trace(p, s.walk, false);
      ctx.stroke();
      const a = walk.at(-2)!;
      const b = walk.at(-1)!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - ux * 9 - uy * 4, b.y - uy * 9 + ux * 4);
      ctx.lineTo(b.x - ux * 9 + uy * 4, b.y - uy * 9 - ux * 4);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(walk[0]!.x, walk[0]!.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  solid: (s) => ({ geometry: stairGeometry(s.parts, s.rails, s.riser, s.stair.kind !== 'spiral'), y: s.bottom, material: 'floor', edges: true }),
  dxfLayers: [{ name: 'A-FLOR-STRS', colour: 2 }],
  dxf: (s, out) => {
    for (const p of s.parts) out.polyline('A-FLOR-STRS', p.polygon, true);
    if (s.walk.length >= 2) out.polyline('A-FLOR-STRS', s.walk, false);
  },
  fields: (items, { dispatch }) => stairFields(items, { updateStairs: (ids, patch) => dispatch(updateStairs(ids, patch)) }),
};
