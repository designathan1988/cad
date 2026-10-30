// Flipping walls: start and end swap, so the layers turn to the other side of the reference line
// (Revit's flip arrows). The wall stays on its reference line, and everything it hosts stays where it
// is in the world: rules counted from one end are counted from the other, a door keeps its hinge
// jamb and the side it opens to, a group keeps its members in place.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import type { GroupSpacing, Opening, PositionRule } from '../opening/schema';
import type { WallId } from './schema';

const other = <T extends 'start' | 'end'>(e: T): 'start' | 'end' => (e === 'start' ? 'end' : 'start');

function flipRule(r: PositionRule): PositionRule {
  switch (r.kind) {
    case 'fromStart':
      return { kind: 'fromEnd', distance: r.distance };
    case 'fromEnd':
      return { kind: 'fromStart', distance: r.distance };
    case 'fromOpening':
      return { ...r, toward: other(r.toward) };
    case 'aligned':
      return r.edge === 'center' ? r : { ...r, edge: other(r.edge) };
    case 'centered':
    case 'inGroup':
      return r;
  }
}

const flipOpening = (o: Opening): Opening => ({
  ...o,
  rule: flipRule(o.rule),
  hinge: other(o.hinge),
  swing: o.swing === 'left' ? 'right' : 'left',
});

function flipSpacing(s: GroupSpacing): GroupSpacing {
  return s.kind === 'fixed' && s.anchor !== 'centered' ? { ...s, anchor: other(s.anchor) } : s;
}

export const flipWalls = (ids: readonly WallId[]): Command<Doc> => ({
  label: 'cmd.flipWalls',
  apply: (doc) => {
    const set = new Set(ids.filter((id) => doc.walls.some((w) => w.id === id)));
    if (set.size === 0) return doc;
    return {
      ...doc,
      walls: doc.walls.map((w) => {
        if (!set.has(w.id)) return w;
        const { bulge, ...rest } = w;
        return { ...rest, start: w.end, end: w.start, ...(bulge !== undefined ? { bulge: bulge === 0 ? 0 : -bulge } : {}) };
      }),
      openings: doc.openings.map((o) => (set.has(o.wallId) ? flipOpening(o) : o)),
      openingGroups: doc.openingGroups.map((g) => (set.has(g.wallId) ? { ...g, members: [...g.members].reverse(), spacing: flipSpacing(g.spacing) } : g)),
    };
  },
});
