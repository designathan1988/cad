// Guardrails in the registry (contract.ts): elements/railing holds the element itself. One held by a
// stair (round its well, on the floor the stair reaches) takes its path from the well each time.

import { finite, isObject, isPoint } from '../../core/guards';
import type { Point2 } from '../../core/vector';
import { railingGeometry } from '../../render/prisms';
import type { ElementKind } from '../contract';
import { updateRailings } from '../railing/commands';
import { railingFields } from '../railing/fields';
import { BALUSTER_SIZE, BALUSTER_SPACING, postsOf, RAIL_SIZE, type Railing, RAILING_PREFIX, wellPath } from '../railing/schema';
import type { KindSolid } from '../contract';
import { type Material, materialIn } from '../material/schema';
import { stairWell } from '../stair/geometry';
import { arrivalOf, solidOfStair } from '../stair/well';
import { nearSegment, throughElement, trace } from './paint';

/** A guardrail as it stands: its foot's height and its path (its well's, when a stair holds it). */
export interface RailingSolid {
  readonly railing: Railing;
  readonly bottom: number;
  readonly points: readonly Point2[];
  /** The project's glass, for panes. */
  readonly glass: Material;
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
    finite(r.baseOffset) &&
    (r.host === undefined || (isObject(r.host) && typeof r.host.stairId === 'string')) &&
    (r.infill === undefined || r.infill === 'rails' || r.infill === 'balusters' || r.infill === 'glass'),
  // Not memoised: one held by a stair moves with it.
  derive: (doc, r) => {
    const bottom = (doc.levels.find((l) => l.id === r.levelId)?.elevation ?? 0) + r.baseOffset;
    const stair = r.host ? doc.stairs.find((s) => s.id === r.host!.stairId) : undefined;
    const glass = materialIn(doc.materials, 'glass');
    if (!stair) return { railing: r, bottom, points: r.points, glass };
    const solid = solidOfStair(doc, stair);
    const arrival = arrivalOf(solid);
    const path = arrival ? wellPath(stairWell(solid), arrival[0], arrival[1]) : [];
    return { railing: r, bottom, points: path.length >= 2 ? path : r.points, glass };
  },
  element: (s) => s.railing,
  // Deleting its stair deletes it.
  holders: (r) => (r.host ? [r.host.stairId] : []),
  outlines: (s) => [s.points],
  hit: (s, p, near) => s.points.slice(1).some((q, i) => nearSegment(p, s.points[i]!, q, near)),
  pick: 'beforeWalls',
  span: (s) => ({ bottom: s.bottom, top: s.bottom + s.railing.height }),
  // Moved on its own, it lets go of its stair: it stays where it was put.
  moved: (r, d) => {
    const { host: _host, ...rest } = r;
    return { ...rest, points: r.points.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) };
  },
  mapped: (r, t, id) => {
    const { host: _host, ...rest } = r;
    return { ...rest, id, points: r.points.map(t.map) };
  },
  // Its path, with a tick at each post.
  plan: (p, s, lit) => {
    const { ctx } = p;
    ctx.save();
    ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--wall-line');
    ctx.lineWidth = lit ? 3 : 2;
    trace(p, s.points, false);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    for (const post of postsOf(s)) {
      const q = p.toScreen(post);
      ctx.fillRect(q.x - 2.5, q.y - 2.5, 5, 5);
    }
    ctx.restore();
  },
  // Its frame; and its glass, when it has panes.
  solid: (s) => {
    const g = railingGeometry(s.points, postsOf(s), s.railing.height, RAIL_SIZE, s.railing.infill ?? 'rails', BALUSTER_SPACING, BALUSTER_SIZE);
    const frame: KindSolid = { geometry: g.frame, y: s.bottom, material: 'side', edges: false };
    return g.glass ? [frame, { geometry: g.glass, y: s.bottom, material: s.glass, edges: false }] : frame;
  },
  dxfLayers: [{ name: 'A-FLOR-HRAL', colour: 4 }],
  dxf: (s, out) => out.polyline('A-FLOR-HRAL', s.points, false),
  fields: (items, { dispatch }) =>
    throughElement(
      railingFields(
        items.map((s) => ({ ...s.railing, points: s.points })),
        { updateRailings: (ids, patch) => dispatch(updateRailings(ids, patch)) },
      ),
      (s: RailingSolid) => ({ ...s.railing, points: s.points }),
    ),
};
