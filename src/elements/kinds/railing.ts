// Guardrails in the registry (contract.ts): elements/railing holds the element itself.

import { finite, isObject, isPoint } from '../../core/guards';
import { railingGeometry } from '../../render/prisms';
import type { ElementKind } from '../contract';
import { updateRailings } from '../railing/commands';
import { railingFields } from '../railing/fields';
import { postsOf, type Railing, RAILING_PREFIX } from '../railing/schema';
import { nearSegment, throughElement, trace } from './paint';

/** A guardrail as it stands: its foot's height. */
export interface RailingSolid {
  readonly railing: Railing;
  readonly bottom: number;
}

export const railingKind: ElementKind<Railing, RailingSolid> = {
  key: 'railings',
  prefix: RAILING_PREFIX,
  category: 'floors',
  icon: 'railing',
  one: 'railing.title',
  many: 'railing.titleMany',
  dropped: 'fix.droppedRailings',
  exportName: 'export.railing',
  exportColour: 'structure',
  valid: (r): r is Railing =>
    isObject(r) &&
    typeof r.id === 'string' &&
    typeof r.levelId === 'string' &&
    Array.isArray(r.points) &&
    r.points.length >= 2 &&
    r.points.every(isPoint) &&
    finite(r.height) &&
    r.height > 0 &&
    finite(r.baseOffset),
  derive: (doc, r) => ({ railing: r, bottom: (doc.levels.find((l) => l.id === r.levelId)?.elevation ?? 0) + r.baseOffset }),
  element: (s) => s.railing,
  outlines: (s) => [s.railing.points],
  hit: (s, p, near) => s.railing.points.slice(1).some((q, i) => nearSegment(p, s.railing.points[i]!, q, near)),
  pick: 'beforeWalls',
  span: (s) => ({ bottom: s.bottom, top: s.bottom + s.railing.height }),
  moved: (r, d) => ({ ...r, points: r.points.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) }),
  mapped: (r, t, id) => ({ ...r, id, points: r.points.map(t.map) }),
  // Its path, with a tick at each post.
  plan: (p, s, lit) => {
    const { ctx } = p;
    ctx.save();
    ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--wall-line');
    ctx.lineWidth = lit ? 3 : 2;
    trace(p, s.railing.points, false);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    for (const post of postsOf(s.railing)) {
      const q = p.toScreen(post);
      ctx.fillRect(q.x - 2.5, q.y - 2.5, 5, 5);
    }
    ctx.restore();
  },
  solid: (s) => ({ geometry: railingGeometry(s.railing.points, postsOf(s.railing), s.railing.height), y: s.bottom, material: 'side', edges: false }),
  dxfLayers: [{ name: 'A-FLOR-HRAL', colour: 4 }],
  dxf: (s, out) => out.polyline('A-FLOR-HRAL', s.railing.points, false),
  fields: (items, { dispatch }) =>
    throughElement(railingFields(items.map((s) => s.railing), { updateRailings: (ids, patch) => dispatch(updateRailings(ids, patch)) }), (s: RailingSolid) => s.railing),
};
