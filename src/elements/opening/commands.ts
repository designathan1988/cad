// Commands on openings. Each returns a new document; the store makes each one undo step. No command
// moves an opening as a side effect: when a reference goes away, the rules that used it are rewritten
// to keep their openings where they were. The one exception is a distributed group: losing a member
// spreads the others out again, which is what the group is for.

import { MIN_ELEMENT_SIZE } from '../../model/tolerance';
import { dropKinds, hasKinds } from '../registry';
import { type Doc, wallHeights } from '../../project/doc';
import type { Command } from '../../core/store';
import { deriveGeometry } from '../../project/derive';
import { hostsIn } from '../../project/derived-queries';
import { deriveOpenings, type HostInfo, type OpeningWarningKind, type PlacedOpening } from './derive';
import type { AlignEdge, GroupSpacing, Opening, OpeningGroup, OpeningGroupId, OpeningId, PositionRule, RuleKind } from './schema';
import type { WallId } from '../wall/schema';
import type { ElementId } from '../../core/id';

/** Why a new opening cannot go where it is aimed (it overlaps another, or does not fit), or null. */
export function placementProblem(doc: Doc, opening: Opening): OpeningWarningKind | null {
  const placed = deriveOpenings([...doc.openings, opening], hostsIn(doc), doc.openingGroups).placed.get(opening.id);
  const blocking: OpeningWarningKind[] = ['openingOverlap', 'openingOutside'];
  return placed?.warnings.find((k) => blocking.includes(k)) ?? null;
}

export const addOpening = (opening: Opening): Command<Doc> => ({
  label: 'cmd.addOpening',
  apply: (doc) => ({ ...doc, openings: [...doc.openings, opening] }),
});

const placedIn = (doc: Doc): Map<OpeningId, PlacedOpening> => deriveOpenings(doc.openings, hostsIn(doc), doc.openingGroups).placed;

/**
 * Groups as the openings now say: a member that left (another rule, another wall, deleted) is taken
 * out, and a group left with fewer than two is dissolved, its member staying where it was in `before`.
 */
function settleGroups(before: Doc, doc: Doc): Doc {
  const byId = new Map(doc.openings.map((o) => [o.id, o]));
  const walls = new Set(doc.walls.map((w) => w.id));
  let changed = false;
  // A group that lost a member (moved away, given a place of its own, deleted) is undone, the others held
  // where they were: spread again without it, they all jumped when one was dragged.
  const kept = doc.openingGroups.flatMap((g) => {
    const members = g.members.filter((id) => {
      const o = byId.get(id);
      return o !== undefined && o.wallId === g.wallId && o.rule.kind === 'inGroup' && o.rule.groupId === g.id;
    });
    if (members.length === g.members.length && walls.has(g.wallId)) return [g];
    changed = true;
    return walls.has(g.wallId) ? [{ ...g, members, broken: true }] : [];
  });
  const lone = new Set(kept.filter((g) => g.members.length < 2 || 'broken' in g).flatMap((g) => g.members));
  if (!changed && lone.size === 0) return doc;
  const was = lone.size > 0 ? placedIn(before) : null;
  return {
    ...doc,
    openingGroups: kept.filter((g) => g.members.length >= 2 && !('broken' in g)),
    openings: doc.openings.map((o) => (lone.has(o.id) ? { ...o, rule: { kind: 'fromStart' as const, distance: was!.get(o.id)?.start ?? 0 } } : o)),
  };
}

/** Sets fields on one opening. Unknown id or no change: the same document, no undo step. */
export const updateOpening = (id: OpeningId, patch: Partial<Omit<Opening, 'id'>>): Command<Doc> => ({
  label: 'cmd.updateOpening',
  apply: (doc) => {
    let changed = false;
    const openings = doc.openings.map((o) => {
      if (o.id !== id) return o;
      const next = { ...o, ...patch };
      // A width or height of nothing, or a sill under the floor: refused (it stays as it was).
      if (!(next.width >= MIN_ELEMENT_SIZE) || !(next.height >= MIN_ELEMENT_SIZE) || !(next.sill >= 0)) return o;
      if (JSON.stringify(next) === JSON.stringify(o)) return o;
      changed = true;
      return next;
    });
    return changed ? settleGroups(doc, { ...doc, openings }) : doc;
  },
});

/**
 * Deletes walls and openings by id in one step. The openings a deleted wall hosts go with it; an
 * opening measured from or aligned with a deleted one is measured from its wall's start instead, at
 * the same place.
 */
export const deleteElements = (ids: readonly string[]): Command<Doc> => ({
  label: 'cmd.deleteElements',
  apply: (doc) => {
    const drop = new Set(ids);
    const walls = doc.walls.filter((w) => !drop.has(w.id));
    const gone = new Set(doc.openings.filter((o) => drop.has(o.id) || drop.has(o.wallId)).map((o) => o.id));
    if (
      walls.length === doc.walls.length &&
      gone.size === 0 &&
      !hasKinds(doc, drop)
    ) {
      return doc;
    }
    const placed = placedIn(doc);
    const openings = doc.openings
      .filter((o) => !gone.has(o.id))
      .map((o) =>
        (o.rule.kind === 'fromOpening' || o.rule.kind === 'aligned') && gone.has(o.rule.openingId)
          ? { ...o, rule: { kind: 'fromStart' as const, distance: placed.get(o.id)!.start } }
          : o,
      );
    // A dimension goes with what holds either of its ends, as Revit's does; a floor following a deleted
    // room keeps the outline it had, so it does not move (registry.ts: dropKinds).
    return settleGroups(doc, { ...dropKinds(doc, new Set([...drop, ...gone]), deriveGeometry(doc)), walls, openings });
  },
});

/**
 * The rule of another kind that leaves the opening where it is now, or null when there is none: a
 * reference opening must be another one on the same wall that does not already depend on this one.
 * Aligned is the exception: it moves the opening across from its reference, by the centres. Groups
 * are made with distributeOpenings, not here.
 */
/**
 * An opening's rule held to its wall: placed by its distance from the wall's nearer end (or centred), where
 * it is now, never from another opening. What the door and window tools store: placed or dragged next to
 * another one, it was measured from it, and moving that one dragged it along (or, each measured from the
 * other, neither could be placed and one vanished). Measuring from another opening stays the user's choice
 * in the panel.
 */
export function wallRule(doc: Doc, o: Opening): PositionRule {
  if (o.rule.kind !== 'fromOpening' && o.rule.kind !== 'aligned') return o.rule;
  const inDoc = { ...doc, openings: [...doc.openings.filter((x) => x.id !== o.id), o] };
  const me = placedIn(inDoc).get(o.id);
  const host = me && hostsIn(inDoc).get(o.wallId);
  if (!me || !host) return o.rule;
  return me.start <= host.length - me.end ? { kind: 'fromStart', distance: me.start } : { kind: 'fromEnd', distance: host.length - me.end };
}

/** The openings placed from `id` (by distance or alignment) held where they are by their walls instead: `id` moves alone. */
export function detachedFrom(doc: Doc, id: ElementId): readonly Opening[] {
  if (!doc.openings.some((o) => (o.rule.kind === 'fromOpening' || o.rule.kind === 'aligned') && o.rule.openingId === id)) return doc.openings;
  return doc.openings.map((o) => (o.rule.kind === 'fromOpening' || o.rule.kind === 'aligned') && o.rule.openingId === id ? { ...o, rule: wallRule(doc, o) } : o);
}

export function ruleKeepingPosition(doc: Doc, id: OpeningId, kind: RuleKind, referenceId?: OpeningId): PositionRule | null {
  const placed = placedIn(doc);
  const me = placed.get(id);
  const host = me && hostsIn(doc).get(me.opening.wallId);
  if (!me || !host) return null;
  switch (kind) {
    case 'fromStart':
      return { kind, distance: me.start };
    case 'fromEnd':
      return { kind, distance: host.length - me.end };
    case 'centered':
      return { kind };
    case 'fromOpening': {
      const ref = referenceId === undefined ? undefined : placed.get(referenceId);
      if (!ref || ref.opening.id === id || ref.opening.wallId !== me.opening.wallId || dependsOn(doc.openings, ref.opening.id, id)) return null;
      return me.start >= ref.start
        ? { kind, openingId: ref.opening.id, distance: me.start - ref.end, toward: 'end' }
        : { kind, openingId: ref.opening.id, distance: ref.start - me.end, toward: 'start' };
    }
    case 'aligned':
      return referenceId !== undefined && alignCandidates(doc, id).some((o) => o.id === referenceId)
        ? { kind, openingId: referenceId, edge: 'center' }
        : null;
    case 'inGroup':
      return null;
  }
}

/** Does opening `id` reach `target` by following references? */
function dependsOn(openings: readonly Opening[], id: OpeningId, target: OpeningId): boolean {
  const byId = new Map(openings.map((o) => [o.id, o]));
  const seen = new Set<OpeningId>();
  let at = byId.get(id);
  while (at && (at.rule.kind === 'fromOpening' || at.rule.kind === 'aligned') && !seen.has(at.id)) {
    if (at.rule.openingId === target) return true;
    seen.add(at.id);
    at = byId.get(at.rule.openingId);
  }
  return false;
}

/** References other openings may take for `id`: same wall, not itself, no loop. */
export function referenceCandidates(doc: Doc, id: OpeningId): Opening[] {
  const me = doc.openings.find((o) => o.id === id);
  if (!me) return [];
  return doc.openings.filter((o) => o.id !== id && o.wallId === me.wallId && !dependsOn(doc.openings, o.id, id));
}

/** Whether `id`, aligned with `refId` by `edge`, stays inside its own wall. */
export function alignFits(doc: Doc, id: OpeningId, refId: OpeningId, edge: AlignEdge, hosts: ReadonlyMap<WallId, HostInfo> = hostsIn(doc)): boolean {
  const openings = doc.openings.map((o) => (o.id === id ? { ...o, rule: { kind: 'aligned' as const, openingId: refId, edge } } : o));
  const placed = deriveOpenings(openings, hosts, doc.openingGroups).placed.get(id);
  return placed !== undefined && !placed.warnings.includes('openingOutside') && !placed.warnings.includes('openingBadReference');
}

/**
 * Openings `id` may be aligned with: on another straight wall, both walls straight, no loop, and
 * across from it within its own wall (by the centres): one whose projection falls past the wall's
 * ends would put the opening outside it.
 */
export function alignCandidates(doc: Doc, id: OpeningId): Opening[] {
  const me = doc.openings.find((o) => o.id === id);
  const hosts = hostsIn(doc);
  if (!me || !hosts.get(me.wallId)?.line) return [];
  return doc.openings.filter(
    (o) =>
      o.id !== id &&
      o.wallId !== me.wallId &&
      hosts.get(o.wallId)?.line !== undefined &&
      !dependsOn(doc.openings, o.id, id) &&
      alignFits(doc, id, o.id, 'center', hosts),
  );
}

/** Aligns each of `ids` with `refId` (by `edge`); the ones that cannot be aligned with it are left as they are. */
export const alignOpenings = (refId: OpeningId, ids: readonly OpeningId[], edge: AlignEdge): Command<Doc> => ({
  label: 'cmd.alignOpenings',
  apply: (doc) => {
    const can = new Set(ids.filter((id) => id !== refId && alignCandidates(doc, id).some((o) => o.id === refId) && alignFits(doc, id, refId, edge)));
    if (can.size === 0) return doc;
    const openings = doc.openings.map((o) => (can.has(o.id) ? { ...o, rule: { kind: 'aligned' as const, openingId: refId, edge } } : o));
    return settleGroups(doc, { ...doc, openings });
  },
});

/**
 * Gives each of `ids` the head height of `refId`, measured from the ground: a window moves its sill,
 * a door (whose sill stays at its wall's base) changes its height. One that would end below its wall
 * base is left as it is.
 */
export const alignHeads = (refId: OpeningId, ids: readonly OpeningId[]): Command<Doc> => ({
  label: 'cmd.alignHeads',
  apply: (doc) => {
    const walls = new Map(doc.walls.map((w) => [w.id, w]));
    const base = (o: Opening) => {
      const w = walls.get(o.wallId);
      return w ? wallHeights(doc, w).bottom : null;
    };
    const ref = doc.openings.find((o) => o.id === refId);
    const refBase = ref && base(ref);
    if (!ref || refBase == null) return doc;
    const head = refBase + ref.sill + ref.height;
    const want = new Set(ids.filter((id) => id !== refId));
    let changed = false;
    const openings = doc.openings.map((o) => {
      const b = want.has(o.id) ? base(o) : null;
      if (b == null) return o;
      const next = o.kind === 'door' ? { ...o, height: head - b - o.sill } : { ...o, sill: head - b - o.height };
      if (next.height <= 0 || next.sill < 0 || (next.height === o.height && next.sill === o.sill)) return o;
      changed = true;
      return next;
    });
    return changed ? { ...doc, openings } : doc;
  },
});

/**
 * Makes `ids` one group with `spacing`, in the order they now sit along the wall. They must be two or
 * more on one wall; otherwise nothing changes. Members of other groups leave them. The group keeps to
 * the stretch they are in now: between the joints just outside them (a T or an X), or the wall ends.
 */
export const distributeOpenings = (groupId: OpeningGroupId, ids: readonly OpeningId[], spacing: GroupSpacing): Command<Doc> => ({
  label: 'cmd.distributeOpenings',
  apply: (doc) => {
    const want = new Set(ids);
    const list = doc.openings.filter((o) => want.has(o.id));
    if (list.length < 2 || list.some((o) => o.wallId !== list[0]!.wallId) || !doc.walls.some((w) => w.id === list[0]!.wallId)) return doc;
    const hosts = hostsIn(doc);
    const host = hosts.get(list[0]!.wallId);
    const placed = deriveOpenings(doc.openings, hosts, doc.openingGroups).placed;
    const members = [...list].sort((a, b) => placed.get(a.id)!.start - placed.get(b.id)!.start).map((o) => o.id);
    const whole = { id: groupId, wallId: list[0]!.wallId, members, spacing, ...stretchAround(host, members.map((id) => placed.get(id)!)) };
    const together = (groups: readonly OpeningGroup[]) => {
      const groupOf = new Map(groups.flatMap((g) => g.members.map((id) => [id, g.id] as const)));
      const openings = doc.openings.map((o) => (groupOf.has(o.id) ? { ...o, rule: { kind: 'inGroup' as const, groupId: groupOf.get(o.id)! } } : o));
      const made = new Set(groups.map((g) => g.id));
      return settleGroups(doc, { ...doc, openings, openingGroups: [...doc.openingGroups.filter((g) => !made.has(g.id)), ...groups] });
    };
    // Spread over the stretch they are in, the whole wall when no joint lies outside them all; kept when
    // none lands on a joint.
    const spread = together([whole]);
    const after = deriveOpenings(spread.openings, hosts, spread.openingGroups).placed;
    const onJoint = members.some((id) => {
      const p = after.get(id);
      return p !== undefined && [...(host?.joints?.values() ?? [])].some((j) => p.start < j.hi - 1e-9 && p.end > j.lo + 1e-9);
    });
    if (!onJoint) return spread;
    // One would land on a joint (a T or an X between them): no single equal spacing skips it (ADR 0003),
    // so one group for each stretch, spread in it. Which side of a joint an opening is on goes by its
    // middle, so one sitting on the joint (a group from a version 3 file) goes to the side it is most
    // on. One alone in its stretch stays where it is.
    const mid = (id: OpeningId) => (placed.get(id)!.start + placed.get(id)!.end) / 2;
    const joints = [...(host?.joints ?? new Map<WallId, { lo: number; hi: number }>())];
    const runs: OpeningId[][] = [[members[0]!]];
    for (let i = 1; i < members.length; i++) {
      const [a, b] = [mid(members[i - 1]!), mid(members[i]!)];
      const between = joints.some(([, j]) => (j.lo + j.hi) / 2 > a && (j.lo + j.hi) / 2 <= b);
      if (between) runs.push([members[i]!]);
      else runs[runs.length - 1]!.push(members[i]!);
    }
    const groups = runs
      .filter((r) => r.length >= 2)
      .map((r, k) => {
        // Between the joints nearest outside the run's middles.
        const [lo, hi] = [mid(r[0]!), mid(r[r.length - 1]!)];
        const before = joints.filter(([, j]) => (j.lo + j.hi) / 2 <= lo).sort((x, y) => y[1].hi - x[1].hi)[0]?.[0] ?? null;
        const after = joints.filter(([, j]) => (j.lo + j.hi) / 2 > hi).sort((x, y) => x[1].lo - y[1].lo)[0]?.[0] ?? null;
        return { id: k === 0 ? groupId : `${groupId}-${k + 1}`, wallId: list[0]!.wallId, members: r, spacing, ...(before !== null || after !== null ? { between: [before, after] as const } : {}) };
      });
    if (groups.length === 0) return spread;
    // One left out that was in a group (a version 3 group split here) keeps its place, measured from the start.
    const grouped = new Set(groups.flatMap((g) => g.members));
    const alone = new Map(members.filter((id) => !grouped.has(id)).map((id) => [id, placed.get(id)!.start]));
    const made = together(groups);
    return alone.size === 0
      ? made
      : { ...made, openings: made.openings.map((o) => (alone.has(o.id) && o.rule.kind === 'inGroup' ? { ...o, rule: { kind: 'fromStart' as const, distance: alone.get(o.id)! } } : o)) };
  },
});

/**
 * The stretch a group keeps to, from where its openings are now: between the nearest joint wholly
 * before them and the nearest wholly after them (a T or an X), or nothing when there is neither.
 */
function stretchAround(host: HostInfo | undefined, openings: readonly PlacedOpening[]): { between?: readonly [WallId | null, WallId | null] } {
  const lo = Math.min(...openings.map((p) => p.start));
  const hi = Math.max(...openings.map((p) => p.end));
  const joints = [...(host?.joints ?? new Map<WallId, { lo: number; hi: number }>())];
  const before = joints.filter(([, j]) => j.hi <= lo).sort((a, b) => b[1].hi - a[1].hi)[0]?.[0] ?? null;
  const after = joints.filter(([, j]) => j.lo >= hi).sort((a, b) => a[1].lo - b[1].lo)[0]?.[0] ?? null;
  return before !== null || after !== null ? { between: [before, after] } : {};
}

/**
 * A group from before stretches existed (file version 3) gets one now, from where its openings are:
 * changing its spacing is a new decision, and it should not land on a joint they were clear of.
 */
export const setGroupSpacing = (groupId: OpeningGroupId, spacing: GroupSpacing): Command<Doc> => ({
  label: 'cmd.setGroupSpacing',
  apply: (doc) => {
    const g = doc.openingGroups.find((x) => x.id === groupId);
    if (!g || JSON.stringify(g.spacing) === JSON.stringify(spacing)) return doc;
    let stretch = {};
    if (g.between === undefined) {
      const hosts = hostsIn(doc);
      const placed = deriveOpenings(doc.openings, hosts, doc.openingGroups).placed;
      const members = g.members.map((id) => placed.get(id)).filter((p): p is PlacedOpening => p !== undefined);
      if (members.length > 0) stretch = stretchAround(hosts.get(g.wallId), members);
    }
    return { ...doc, openingGroups: doc.openingGroups.map((x) => (x.id === groupId ? { ...x, spacing, ...stretch } : x)) };
  },
});

/** Dissolves a group; every member keeps its place, measured from its wall's start. */
export const ungroupOpenings = (groupId: OpeningGroupId): Command<Doc> => ({
  label: 'cmd.ungroupOpenings',
  apply: (doc) => {
    const g = doc.openingGroups.find((x) => x.id === groupId);
    if (!g) return doc;
    const placed = placedIn(doc);
    const members = new Set(g.members);
    return {
      ...doc,
      openingGroups: doc.openingGroups.filter((x) => x.id !== groupId),
      openings: doc.openings.map((o) =>
        members.has(o.id) && o.rule.kind === 'inGroup' && o.rule.groupId === groupId
          ? { ...o, rule: { kind: 'fromStart' as const, distance: placed.get(o.id)!.start } }
          : o,
      ),
    };
  },
});
