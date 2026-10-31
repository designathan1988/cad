// Flipping walls: start and end swap, so the layers turn to the other side of the reference line
// (Revit's flip arrows). The wall stays on its reference line, and everything it hosts stays where it
// is in the world: rules counted from one end are counted from the other, a door keeps its hinge
// jamb and the side it opens to, a group keeps its members in place; a chosen corner join, a
// dimension's end and an arc's measure keep theirs, named from the other end.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import type { GroupSpacing, Opening, PositionRule } from '../opening/schema';
import type { Wall, WallId } from './schema';
import type { DimAnchor } from '../dimension/schema';

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

/**
 * A wall whose start and end were swapped (a flip, a mirror) with its chosen end joins swapped too: a
 * join chosen for a corner stays at that corner, now named from the other end.
 */
export function withSwappedJoins<W extends Pick<Wall, 'joins'>>(w: W): W {
  if (!w.joins) return w;
  const { start, end } = w.joins;
  return { ...w, joins: { ...(end ? { start: end } : {}), ...(start ? { end: start } : {}) } };
}

export const flipWalls = (ids: readonly WallId[]): Command<Doc> => ({
  label: 'cmd.flipWalls',
  apply: (doc) => {
    const set = new Set<string>(ids.filter((id) => doc.walls.some((w) => w.id === id)));
    if (set.size === 0) return doc;
    const hosted = new Set(doc.openings.filter((o) => set.has(o.wallId)).map((o) => o.id));
    // What a dimension is held by stays where it is: the same physical end or jamb under its new name,
    // the side across turned over with the wall's direction.
    const held = (a: DimAnchor): DimAnchor =>
      a.kind === 'wall' && set.has(a.wallId)
        ? { ...a, end: other(a.end), offset: -a.offset }
        : a.kind === 'opening' && hosted.has(a.openingId)
          ? { ...a, jamb: other(a.jamb), offset: -a.offset }
          : a;
    return {
      ...doc,
      walls: doc.walls.map((w) => {
        if (!set.has(w.id)) return w;
        const { bulge, ...rest } = w;
        return withSwappedJoins({ ...rest, start: w.end, end: w.start, ...(bulge !== undefined ? { bulge: bulge === 0 ? 0 : -bulge } : {}) });
      }),
      openings: doc.openings.map((o) => (set.has(o.wallId) ? flipOpening(o) : o)),
      openingGroups: doc.openingGroups.map((g) => (set.has(g.wallId) ? { ...g, members: [...g.members].reverse(), spacing: flipSpacing(g.spacing) } : g)),
      dimensions: doc.dimensions.map((d) => (held(d.a) === d.a && held(d.b) === d.b ? d : { ...d, a: held(d.a), b: held(d.b) })),
      // An arc's measure stays at the same point along it, counted from the other end.
      measures: doc.measures.map((m) => ('wallId' in m && set.has(m.wallId) ? { ...m, t: 1 - m.t } : m)),
    };
  },
});
