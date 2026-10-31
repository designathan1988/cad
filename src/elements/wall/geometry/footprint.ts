// Plan footprint of every wall, layer by layer: each layer's band, lengthened at joined ends, clipped
// by the same half-planes. Clipping layers one by one equals splitting the clipped wall at the layer
// lines, so the layers tile the wall exactly.

import { POINT_TOLERANCE } from '../../../model/tolerance';
import { distance, type Point2 } from '../../../model/vector';
import { resolveCorner } from '../join/cut-l';
import { resolveAbutment } from '../join/cut-t';
import { deriveJoins, goesThrough } from '../join/discover';
import { onLine } from '../join/junctions';
import { resolveNode } from '../join/node';
import { goingThrough, resolveSectors, type SectorArm } from '../join/sectors';
import type { EndCut, JoinWarning, Notch } from '../join/types';
import type { EndRef, Wall, WallId, WallType, WallTypeId } from '../schema';
import { type ArcChain, arcOf, expandArc, parentOf } from './arc';
import type { ConvexPolygon, HalfPlane } from './convex';
import { stationOf as stationAlong, wallLength } from './offset';
import { shapeOf, type WallShape } from './shape';
import { type Carried, carriedPieces, carryArcStem, fitsArc, overlapsWithArcs, spillOverArc, splitPieces, spreadOverArc, type StemSplit, wedge } from './arc-joints';
import { dedupe, type Span, spanPieces } from './pieces';

export interface Piece {
  readonly layerIndex: number;
  readonly polygon: ConvexPolygon;
}

export interface WallGeometry {
  readonly pieces: ReadonlyMap<WallId, readonly Piece[]>;
  readonly warnings: readonly JoinWarning[];
  /**
   * The ends (`wallId:start`, `wallId:end`) in an L of two straight walls: the only joins a chosen miter,
   * through, stop or square acts on. Elsewhere (a T, a node, a junction, an arc) only 'off' does.
   */
  readonly choosable: ReadonlySet<string>;
}

const keyOf = (r: EndRef): string => `${r.wallId}:${r.end}`;
const byIdOrder = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function computeWallGeometry(walls: readonly Wall[], types: ReadonlyMap<WallTypeId, WallType>): WallGeometry {
  const warnings: JoinWarning[] = [];
  const shapes: WallShape[] = [];
  const chains = new Map<WallId, ArcChain>();
  for (const wall of [...walls].sort(byIdOrder)) {
    const shape = shapeOf(wall, types.get(wall.wallTypeId));
    if (typeof shape === 'string') {
      warnings.push({ kind: shape, walls: [wall.id] });
    } else if (shape.bulge !== 0 && arcOf(shape) !== null) {
      // An arc joins as the chain of its straight segments (geometry/arc.ts).
      const chain = expandArc(shape);
      if (chain === 'arcTooTight') warnings.push({ kind: chain, walls: [wall.id] });
      else {
        chains.set(wall.id, chain);
        shapes.push(...chain.segments);
      }
    } else shapes.push(shape);
  }

  // The user's join choices (EndJoin), by the ends of the shapes: an arc's start is its first
  // segment's, its end its last's.
  const choice = new Map<string, NonNullable<Wall['joins']>['start']>();
  for (const wall of walls) {
    if (!wall.joins) continue;
    const chain = chains.get(wall.id);
    const first = chain ? chain.segments[0]!.id : wall.id;
    const last = chain ? chain.segments[chain.segments.length - 1]!.id : wall.id;
    if (wall.joins.start) choice.set(`${first}:start`, wall.joins.start);
    if (wall.joins.end) choice.set(`${last}:end`, wall.joins.end);
  }
  const off = new Set([...choice].filter(([, v]) => v === 'off').map(([k]) => k));
  const graph = deriveJoins(shapes, off);
  const byId = new Map(shapes.map((w) => [w.id, w]));
  const isArc = (id: WallId) => parentOf(id) !== id;
  const endCuts = new Map<string, EndCut>();
  const notches: Notch[] = [];
  const choosable = new Set<string>();
  // Warnings are reported by wall, not by segment. A join the engine cannot make exact against an arc
  // is dropped and reported, and the walls stay as drawn.
  const report = (w: JoinWarning) => warnings.push({ ...w, walls: w.walls.map(parentOf) });
  graph.warnings.forEach(report);
  // An L at an arc's end is made with its end segment. In a butt where the arc abuts, the other wall's
  // body can still reach the segments before that one: the cut is carried on as for an arc stem in a T.
  const arcStems: { end: EndRef; host: WallShape }[] = [];
  // Walls split near an end against an arc wider than one segment (spreadOverArc, spillOverArc).
  const splits = new Map<string, StemSplit[]>();
  // An arc's end segment at the arc's free end is not free at its other end: the arc goes on (§5.2).
  // Its reach in an L is the whole arc's, up to the arc's own far end (§7.1, "ponta livre").
  const arcReach = (r: EndRef, other: EndRef): number | undefined => {
    const chain = chains.get(parentOf(r.wallId));
    if (!chain || parentOf(other.wallId) === parentOf(r.wallId)) return undefined;
    return chain.segments.reduce((sum, s) => sum + distance(s.start, s.end), 0);
  };
  // Junctions first (§7.6): each stands for the joins it absorbs, when its sectors are exact; else
  // those joins stay, with a warning.
  const absorbed = new Set<object>();
  const junctionSplits: { wallId: WallId; point: Point2; before: EndCut; after: EndCut }[] = [];
  for (const j of graph.junctions) {
    const passing = j.passing.map((id) => byId.get(id)!);
    // A wall passing the point is split where the point falls on its line.
    const at = passing.map((w) => onLine(w, j.point));
    const arms: SectorArm[] = [
      ...passing.flatMap((w, k) => [
        { wall: { ...w, end: at[k]! }, end: 'end' as const, reach: distance(w.start, at[k]!), through: w.id },
        { wall: { ...w, start: at[k]! }, end: 'start' as const, reach: distance(at[k]!, w.end), through: w.id },
      ]),
      ...j.ends.map((r) => ({ wall: byId.get(r.wallId)!, end: r.end, reach: wallLength(byId.get(r.wallId)!) })),
    ];
    // Ends on a wall that goes on: it passes whole, its two arms the first two (junctions.ts).
    const sectors = j.onWall ? goingThrough(arms, j.point, [0, 1]) : resolveSectors(arms, j.point);
    if (!sectors) {
      report({ kind: 'complexJoin', walls: [...j.passing, ...j.ends.map((r) => r.wallId)] });
      continue;
    }
    for (const x of [...j.absorbs.corners, ...j.absorbs.nodes, ...j.absorbs.crossings, ...j.absorbs.abutments]) absorbed.add(x);
    const cuts = sectors.cuts;
    notches.push(...sectors.notches);
    passing.forEach((w, k) => junctionSplits.push({ wallId: w.id, point: at[k]!, before: cuts[2 * k]!, after: cuts[2 * k + 1]! }));
    j.ends.forEach((r, k) => endCuts.set(keyOf(r), cuts[2 * passing.length + k]!));
  }
  for (const corner of graph.corners) {
    if (absorbed.has(corner)) continue;
    const { ends: [ra, rb], node } = corner;
    const reachA = arcReach(ra, rb);
    const reachB = arcReach(rb, ra);
    // Two straight walls butt layer by layer, and so does an arc's end against a straight wall that goes
    // through: the earlier segments of the arc then carry their T against it as before (arcStems). Where
    // the arc goes through, its chain splits the straight wall by its segments (spillOverArc), which
    // takes the T butt. As a T, a straight wall's inner plaster and core showed on the corner's outside.
    const straight = !chains.has(parentOf(ra.wallId)) && !chains.has(parentOf(rb.wallId));
    const aArc = chains.has(parentOf(ra.wallId));
    const bArc = chains.has(parentOf(rb.wallId));
    const aGoesThrough = goesThrough(byId.get(ra.wallId)!, byId.get(rb.wallId)!);
    const arcAbuts = aArc !== bArc && (aArc ? !aGoesThrough : aGoesThrough);
    const layered = straight || arcAbuts;
    // The user's choice at either end (EndJoin), for two straight walls: a miter, who goes through, or
    // whose end is squared off (it goes through; chosen at both ends, the first wall's).
    if (straight) {
      choosable.add(keyOf(ra));
      choosable.add(keyOf(rb));
    }
    const ca = choice.get(keyOf(ra));
    const cb = choice.get(keyOf(rb));
    const aThrough = ca === 'through' || cb === 'stop';
    const bThrough = cb === 'through' || ca === 'stop';
    const squared = ca === 'square' ? ra : cb === 'square' ? rb : null;
    const force = !straight
      ? undefined
      : squared
        ? { through: squared.wallId, square: true }
        : aThrough !== bThrough
          ? { through: aThrough ? ra.wallId : rb.wallId }
          : !aThrough && (ca === 'miter' || cb === 'miter')
            ? ('miter' as const)
            : undefined;
    const result = resolveCorner(
      byId.get(ra.wallId)!,
      ra.end,
      byId.get(rb.wallId)!,
      rb.end,
      node,
      { ...(reachA !== undefined ? { a: reachA } : {}), ...(reachB !== undefined ? { b: reachB } : {}) },
      layered,
      force,
    );
    if (result.a) endCuts.set(keyOf(ra), result.a);
    if (result.b) endCuts.set(keyOf(rb), result.b);
    if (result.warning) report(result.warning);
    // An arc's end segment abutting in a butt notches the other wall only up to its joint with the next
    // segment, a radial plane, as in a T (the next segments carry their own): bounded square at its
    // chord's end, a sliver of the other wall's finish was left un-notched.
    // (Layer by layer, every layer is already cut where it meets the other's: no T notches.)
    const abutsArc = (r: EndRef, cut: EndCut | null) => !layered && !result.warning && cut?.layerCuts && chains.has(parentOf(r.wallId));
    if (abutsArc(ra, result.a) || abutsArc(rb, result.b)) {
      const [arc, other] = abutsArc(ra, result.a) ? [ra, rb] : [rb, ra];
      const chain = chains.get(parentOf(arc.wallId))!;
      const back = wedge(chain, arc.wallId).filter((_, k) => k === (arc.end === 'end' ? 0 : 1));
      notches.push(...resolveAbutment(byId.get(arc.wallId)!, arc.end, byId.get(other.wallId)!, back).notches);
    } else notches.push(...result.notches);
    for (const [arc, other, arcCut, otherCut] of [
      [ra, rb, result.a, result.b],
      [rb, ra, result.b, result.a],
    ] as const) {
      if (!chains.has(parentOf(arc.wallId)) || result.warning || !arcCut || !otherCut) continue;
      // The abutting side of a butt has layer cuts (cut-l.ts: resolveAbutment); a miter has none.
      if (arcCut.layerCuts) {
        arcStems.push({ end: arc, host: byId.get(other.wallId)! });
        continue;
      }
      // A miter, or a butt the arc passes: the other wall can reach the segments past the end one.
      const chain = chains.get(parentOf(arc.wallId))!;
      if (chains.has(parentOf(other.wallId))) continue;
      const spill = spillOverArc(byId.get(other.wallId)!, other.end, chain, arc.wallId, otherCut);
      if (!spill) continue;
      endCuts.set(keyOf(other), { extension: otherCut.extension, cuts: [] });
      notches.push(...spill.notches);
      splits.set(other.wallId, [...(splits.get(other.wallId) ?? []), spill.split]);
    }
  }
  for (const node of graph.nodes) {
    if (absorbed.has(node)) continue;
    const { ends, point } = node;
    const result = resolveNode(byId, ends, point);
    for (const [ref, cut] of result.endCuts) endCuts.set(keyOf(ref), cut);
    // A notch an arc's end segment takes in a node (against the outside of an L) is taken by every
    // segment of the arc: its short segments next to the end reach into the corner too.
    notches.push(...result.notches.flatMap((n) => (isArc(n.wallId) ? chains.get(parentOf(n.wallId))!.segments.map((x) => ({ ...n, wallId: x.id })) : [n])));
    result.warnings.forEach(report);
  }
  // An arc ending against a wall: its end segment takes the T cut, and the segments before it that
  // still reach past the host's face take their own (carryArcStem).
  // A straight wall against an arc wider than one segment: split near its end by the segments' wedges
  // (spreadOverArc), each part with that segment's T.
  for (const abutment of graph.abutments) {
    if (absorbed.has(abutment)) continue;
    const { abutting, hostId } = abutment;
    const stemChain = chains.get(parentOf(abutting.wallId));
    // The end segment's notches stop at the joint with the segment before it, a radial plane.
    const back = stemChain ? wedge(stemChain, abutting.wallId).filter((_, k) => k === (abutting.end === 'end' ? 0 : 1)) : undefined;
    const result = resolveAbutment(byId.get(abutting.wallId)!, abutting.end, byId.get(hostId)!, back);
    if (!fitsArc(result, abutting.wallId, hostId, byId, chains)) {
      const hostChain = chains.get(parentOf(hostId));
      const spread = hostChain && !stemChain ? spreadOverArc(byId.get(abutting.wallId)!, abutting.end, hostChain) : null;
      if (!spread) {
        report({ kind: 'arcJoinUnsupported', walls: [abutting.wallId, hostId] });
        continue;
      }
      endCuts.set(keyOf(abutting), { extension: spread.extension, cuts: [] });
      notches.push(...spread.notches);
      splits.set(abutting.wallId, [...(splits.get(abutting.wallId) ?? []), spread.split]);
      continue;
    }
    endCuts.set(keyOf(abutting), result.cut);
    notches.push(...result.notches);
    if (stemChain) arcStems.push({ end: abutting, host: byId.get(hostId)! });
  }
  // The free ends of an arc are radial.
  for (const chain of chains.values()) {
    const head = chain.segments[0]!;
    const tail = chain.segments[chain.segments.length - 1]!;
    const cap = (plane: HalfPlane): EndCut => ({ extension: head.thickness, cuts: [plane] });
    const first = keyOf({ wallId: head.id, end: 'start' });
    const last = keyOf({ wallId: tail.id, end: 'end' });
    if (!endCuts.has(first)) endCuts.set(first, cap(chain.startCap));
    if (!endCuts.has(last)) endCuts.set(last, cap(chain.endCap));
  }

  // A crossing splits the cut wall into spans. Each side of the crossing is a T against the through
  // wall: the same normal and offsets as the whole wall, so resolveAbutment applies unchanged.
  const spans = new Map<WallId, Span[]>(
    shapes.map((shape) => [
      shape.id,
      [
        {
          shape,
          atStart: endCuts.get(keyOf({ wallId: shape.id, end: 'start' })),
          atEnd: endCuts.get(keyOf({ wallId: shape.id, end: 'end' })),
        },
      ],
    ]),
  );
  // Crossings and junctions split walls; each wall's splits are taken in order along it.
  const along = [
    ...graph.crossings.filter((c) => !absorbed.has(c)).map((c) => ({ wallId: c.cutId, point: c.point, crossing: c, junction: null })),
    ...junctionSplits.map((s) => ({ wallId: s.wallId, point: s.point, crossing: null, junction: s })),
  ].sort((x, y) => stationAlong(byId.get(x.wallId)!, x.point) - stationAlong(byId.get(y.wallId)!, y.point));
  for (const split of along) {
    if (split.junction) {
      // A wall passing a junction: split at the point, each side with its sector's cut.
      const list = spans.get(split.wallId)!;
      const last = list.pop()!;
      list.push(
        { shape: { ...last.shape, end: split.point }, atStart: last.atStart, atEnd: split.junction.before },
        { shape: { ...last.shape, start: split.point }, atStart: split.junction.after, atEnd: last.atEnd },
      );
      continue;
    }
    const { throughId, cutId, point } = split.crossing!;
    if (isArc(throughId) && isArc(cutId)) {
      report({ kind: 'arcJoinUnsupported', walls: [throughId, cutId] });
      continue;
    }
    if (isArc(throughId)) {
      // The arc passes: each side of the straight wall is a T against it (spreadOverArc), per span.
      const chain = chains.get(parentOf(throughId))!;
      const list = spans.get(cutId)!;
      const last = list.pop()!;
      const before = spreadOverArc({ ...last.shape, end: point }, 'end', chain);
      const after = spreadOverArc({ ...byId.get(cutId)!, start: point }, 'start', chain);
      if (!before || !after) {
        list.push(last);
        report({ kind: 'arcJoinUnsupported', walls: [cutId, throughId] });
        continue;
      }
      list.push(
        { shape: { ...last.shape, end: point }, atStart: last.atStart, atEnd: { extension: before.extension, cuts: [] }, splits: [...(last.splits ?? []), before.split] },
        { shape: { ...last.shape, start: point }, atStart: { extension: after.extension, cuts: [] }, atEnd: last.atEnd, splits: [after.split] },
      );
      notches.push(...before.notches, ...after.notches);
      continue;
    }
    if (isArc(cutId)) {
      // The straight wall passes: the arc is cut there, and each side ends against it as an arc does
      // (its segment takes the T, the ones before carry it: carryArcStem).
      const through = byId.get(throughId)!;
      const chain = chains.get(parentOf(cutId))!;
      const k = chain.segments.findIndex((x) => x.id === cutId);
      const seg = chain.segments[k]!;
      const s = stationAlong(seg, point);
      const back = (id: WallId, end: 'start' | 'end') => wedge(chain, id).filter((_, i) => i === (end === 'end' ? 0 : 1));
      // On a joint the chain's corner there gives way: the segment before ends there, the next starts.
      const [left, right] =
        s <= POINT_TOLERANCE ? [chain.segments[k - 1], seg] : s >= stationAlong(seg, seg.end) - POINT_TOLERANCE ? [seg, chain.segments[k + 1]] : [null, null];
      if (left !== null || right !== null) {
        for (const [part, end] of [
          [left, 'end'],
          [right, 'start'],
        ] as const) {
          if (!part) continue;
          const r = resolveAbutment(part, end, through, back(part.id, end));
          const list = spans.get(part.id)!;
          const i = end === 'end' ? list.length - 1 : 0;
          list[i] = end === 'end' ? { ...list[i]!, atEnd: r.cut } : { ...list[i]!, atStart: r.cut };
          notches.push(...r.notches);
          arcStems.push({ end: { wallId: part.id, end }, host: through });
        }
        continue;
      }
      const list = spans.get(cutId)!;
      const last = list.pop()!;
      const before = resolveAbutment({ ...last.shape, end: point }, 'end', through, back(cutId, 'end'));
      const after = resolveAbutment({ ...seg, start: point }, 'start', through, back(cutId, 'start'));
      list.push(
        { shape: { ...last.shape, end: point }, atStart: last.atStart, atEnd: before.cut },
        { shape: { ...last.shape, start: point }, atStart: after.cut, atEnd: last.atEnd },
      );
      notches.push(...before.notches, ...after.notches);
      arcStems.push({ end: { wallId: cutId, end: 'end' }, host: through }, { end: { wallId: cutId, end: 'start' }, host: through });
      continue;
    }
    const through = byId.get(throughId)!;
    const list = spans.get(cutId)!;
    const last = list.pop()!;
    const before = resolveAbutment({ ...last.shape, end: point }, 'end', through);
    const after = resolveAbutment({ ...byId.get(cutId)!, start: point }, 'start', through);
    list.push(
      { shape: { ...last.shape, end: point }, atStart: last.atStart, atEnd: before.cut },
      { shape: { ...last.shape, start: point }, atStart: after.cut, atEnd: last.atEnd },
    );
    notches.push(...before.notches, ...after.notches);
  }

  const clips = new Map<string, Carried[]>();
  for (const { end, host } of arcStems) {
    const carried = carryArcStem(chains.get(parentOf(end.wallId))!, end, host, (shape) => spans.get(shape.id)!.flatMap((span) => spanPieces(span, [])));
    for (const [id, cut] of carried.clips) clips.set(id, [...(clips.get(id) ?? []), cut]);
    notches.push(...carried.notches);
  }
  const pieces = new Map<WallId, Piece[]>();
  for (const wall of walls) pieces.set(wall.id, []);
  for (const shape of shapes) {
    const own = notches.filter((n) => n.wallId === shape.id);
    // A span cut against an arc on a side (an X with the arc passing) is split there, by span: the
    // split of one side must not touch the other.
    let raw = spans.get(shape.id)!.flatMap((span) => (span.splits ?? []).reduce((ps, split) => splitPieces(ps, split), spanPieces(span, own)));
    for (const split of splits.get(shape.id) ?? []) raw = splitPieces(raw, split);
    pieces.get(parentOf(shape.id))!.push(...(clips.has(shape.id) ? carriedPieces(raw, clips.get(shape.id)!) : raw));
  }
  warnings.push(...overlapsWithArcs(pieces, chains, warnings));
  return { pieces, warnings: dedupe(warnings), choosable };
}
