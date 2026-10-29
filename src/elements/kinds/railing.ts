// Guardrails in the registry (contract.ts): elements/railing holds the element itself. One held by a
// stair takes its path from it each time: round its well, on the floor the stair reaches, or along one
// of its sides, rising with it.

import { finite, isObject, isPoint } from '../../core/guards';
import type { Point2 } from '../../core/vector';
import { num, t } from '../../ui/i18n';
import type { DerivedGeometry } from '../../app/geometry';
import { railingGeometry } from '../../render/prisms';
import type { ElementKind } from '../contract';
import { updateRailings } from '../railing/commands';
import { railingFields } from '../railing/fields';
import { BALUSTER_SIZE, BALUSTER_SPACING, MAX_RAILING_GAP, postsOf, RAIL_SIZE, type Railing, railingGap, RAILING_PREFIX, wellPath } from '../railing/schema';
import type { KindSolid } from '../contract';
import { type Material, materialIn } from '../material/schema';
import { stairWell } from '../stair/geometry';
import { RAIL_HEIGHT } from '../stair/schema';
import { arrivalOf, solidOfStair } from '../stair/well';
import { deriveFloor } from '../room/derive';
import { nearSegment, throughElement, trace } from './paint';

/** A guardrail as it stands: its foot's height and its path (its well's, when a stair holds it). */
export interface RailingSolid {
  readonly railing: Railing;
  readonly bottom: number;
  readonly points: readonly Point2[];
  /** Each point's foot above `bottom` (m), along a stair's or a ramp's side; level when not set. */
  readonly rise?: readonly number[];
  /** The project's glass, for panes. */
  readonly glass: Material;
}

/** Where it stands as shown: a hosted one's path taken from its host in `g`; its own points otherwise. */
const shownPath = (r: Railing, g: DerivedGeometry | undefined): readonly Point2[] =>
  (r.host ? (g?.kinds.get('railings')?.get(r.id) as RailingSolid | undefined)?.points : undefined) ?? r.points;

export const railingKind: ElementKind<Railing, RailingSolid> = {
  key: 'railings',
  prefix: RAILING_PREFIX,
  category: 'floors',
  icon: 'railing',
  one: 'railing.title',
  many: 'railing.titleMany',
  // A gap a child could pass through, over the 11 cm NBR 14718 allows: a mid rail alone leaves about
  // half its height open, offered beside balusters and glass with nothing said.
  warning: (items) => {
    const wide = items.filter((s) => railingGap(s.railing) > MAX_RAILING_GAP);
    if (wide.length === 0) return null;
    return t('warn.railingGap', { gap: num(Math.max(...wide.map((s) => railingGap(s.railing))) * 100, 0), max: num(MAX_RAILING_GAP * 100, 0) });
  },
  dropped: 'fix.droppedRailings',


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
    (r.host === undefined ||
      (isObject(r.host) &&
        ((typeof r.host.stairId === 'string' && (r.host.side === undefined || (Number.isInteger(r.host.side) && (r.host.side as number) >= 0))) || typeof r.host.floorId === 'string'))) &&
    (r.infill === undefined || r.infill === 'rails' || r.infill === 'balusters' || r.infill === 'glass'),
  // Not memoised: one held by a stair moves with it.
  derive: (doc, r, g) => {
    const bottom = (doc.levels.find((l) => l.id === r.levelId)?.elevation ?? 0) + r.baseOffset;
    const host = r.host;
    const glass = materialIn(doc.materials, 'glass');
    // Along a floor's edge: all round its outline, closed.
    const floor = host && 'floorId' in host ? doc.floors.find((f) => f.id === host.floorId) : undefined;
    if (floor) {
      // On its top, its own offset above that: the floor raised takes it along.
      const fs = deriveFloor(floor, g.rooms, (id) => doc.levels.find((l) => l.id === id)?.elevation ?? 0);
      const outline = fs.outline;
      return { railing: r, bottom: fs.top + r.baseOffset, points: outline.length >= 3 ? [...outline, outline[0]!] : r.points, glass };
    }
    const stair = host && 'stairId' in host ? doc.stairs.find((s) => s.id === host.stairId) : undefined;
    if (!stair) return { railing: r, bottom, points: r.points, glass };
    const solid = solidOfStair(doc, stair);
    // Along one of its sides: its handrail's line, the feet at the steps' nosing (the line is a
    // handrail's height above it), from the stair's bottom.
    const sideNo = host && 'stairId' in host ? host.side : undefined;
    const side = sideNo !== undefined ? solid.sides[sideNo] : undefined;
    // A side the stair no longer has (a U made straight): where it was last, not round the well.
    if (sideNo !== undefined && (!side || side.length < 2)) return { railing: r, bottom, points: r.points, glass };
    if (side && side.length >= 2) {
      const foot = Math.min(...side.map((p) => p.z - RAIL_HEIGHT));
      return {
        railing: r,
        bottom: solid.bottom + foot + r.baseOffset,
        points: side.map((p) => ({ x: p.x, y: p.y })),
        rise: side.map((p) => p.z - RAIL_HEIGHT - foot),
        glass,
      };
    }
    const arrival = arrivalOf(solid);
    const path = arrival ? wellPath(stairWell(solid), arrival[0], arrival[1]) : [];
    return { railing: r, bottom, points: path.length >= 2 ? path : r.points, glass };
  },
  element: (s) => s.railing,
  // Deleting its stair deletes it.
  holders: (r) => (r.host ? ['stairId' in r.host ? r.host.stairId : r.host.floorId] : []),
  outlines: (s) => [s.points],
  hit: (s, p, near) => s.points.slice(1).some((q, i) => nearSegment(p, s.points[i]!, q, near)),
  pick: 'beforeWalls',
  span: (s) => ({ bottom: s.bottom, top: s.bottom + Math.max(0, ...(s.rise ?? [])) + s.railing.height }),
  // Moved on its own, it lets go of its stair or floor and stays where it was put: from the path it
  // showed, taken from its host. Its stored points are those it was made with; a stair changed since
  // (turned, widened) sent it back to them, away from where it stood.
  moved: (r, d, g) => {
    const { host: _host, ...rest } = r;
    return { ...rest, points: shownPath(r, g).map((p) => ({ x: p.x + d.x, y: p.y + d.y })) };
  },
  mapped: (r, t, id) => {
    const { host: _host, ...rest } = r;
    return { ...rest, id, points: r.points.map(t.map) };
  },
  // By a Modify tool: the same, from the path it showed; one only there while its stair goes is left as
  // it is (it follows the stair).
  transformed: (r, c) => {
    if (!c.selected) return null;
    const { host: _host, ...rest } = r;
    return { ...rest, id: c.id, points: shownPath(r, c.geometry).map(c.t.map) };
  },
  // Its path, with a tick at each post.
  plan: (p, s, lit) => {
    const { ctx } = p;
    ctx.save();
    ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--wall-line');
    ctx.lineWidth = p.pen('seen') * (lit ? 1.5 : 1);
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
    const g = railingGeometry(s.points, postsOf(s), s.railing.height, RAIL_SIZE, s.railing.infill ?? 'rails', BALUSTER_SPACING, BALUSTER_SIZE, s.rise);
    const frame: KindSolid = { geometry: g.frame, y: s.bottom, material: 'side', edges: false };
    return g.glass ? [frame, { geometry: g.glass, y: s.bottom, material: s.glass, edges: false }] : frame;
  },


  fields: (items, { dispatch }) =>
    throughElement(
      railingFields(
        items.map((s) => ({ ...s.railing, points: s.points })),
        { updateRailings: (ids, patch) => dispatch(updateRailings(ids, patch)) },
      ),
      (s: RailingSolid) => ({ ...s.railing, points: s.points }),
    ),
};
