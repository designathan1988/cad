// Commands on openings. Each returns a new document; the store makes each one undo step. No command
// moves an opening as a side effect: when a reference goes away, the rules that used it are rewritten
// to keep their openings where they were. The one exception is a distributed group: losing a member
// spreads the others out again, which is what the group is for.

import { type Doc, wallHeights } from '../../app/document';
import type { Command } from '../../core/store';
import { deriveGeometry, hostsIn } from '../../app/geometry';
import { deriveOpenings, type HostInfo, type OpeningWarningKind, type PlacedOpening } from './derive';
import type { AlignEdge, GroupSpacing, Opening, OpeningGroupId, OpeningId, PositionRule, RuleKind } from './schema';

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
  const kept = doc.openingGroups.flatMap((g) => {
    const members = g.members.filter((id) => {
      const o = byId.get(id);
      return o !== undefined && o.wallId === g.wallId && o.rule.kind === 'inGroup' && o.rule.groupId === g.id;
    });
    if (members.length === g.members.length && walls.has(g.wallId)) return [g];
    changed = true;
    return walls.has(g.wallId) ? [{ ...g, members }] : [];
  });
  const lone = new Set(kept.filter((g) => g.members.length < 2).flatMap((g) => g.members));
  if (!changed && lone.size === 0) return doc;
  const was = lone.size > 0 ? placedIn(before) : null;
  return {
    ...doc,
    openingGroups: kept.filter((g) => g.members.length >= 2),
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
    const rooms = doc.rooms.filter((r) => !drop.has(r.id));
    const floorsLeft = doc.floors.filter((f) => !drop.has(f.id));
    if (walls.length === doc.walls.length && gone.size === 0 && rooms.length === doc.rooms.length && floorsLeft.length === doc.floors.length) {
      return doc;
    }
    // A floor following a deleted room keeps the outline it had, so it does not move.
    const derived = deriveGeometry(doc).rooms;
    const floors = floorsLeft.map((f) =>
      f.source.kind === 'room' && drop.has(f.source.roomId)
        ? { ...f, source: { kind: 'outline' as const, points: [...(derived.get(f.source.roomId)?.outline ?? [])] } }
        : f,
    );
    const placed = placedIn(doc);
    const openings = doc.openings
      .filter((o) => !gone.has(o.id))
      .map((o) =>
        (o.rule.kind === 'fromOpening' || o.rule.kind === 'aligned') && gone.has(o.rule.openingId)
          ? { ...o, rule: { kind: 'fromStart' as const, distance: placed.get(o.id)!.start } }
          : o,
      );
    return settleGroups(doc, { ...doc, walls, openings, rooms, floors });
  },
});

/**
 * The rule of another kind that leaves the opening where it is now, or null when there is none: a
 * reference opening must be another one on the same wall that does not already depend on this one.
 * Aligned is the exception: it moves the opening across from its reference, by the centres. Groups
 * are made with distributeOpenings, not here.
 */
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
export function alignFits(doc: Doc, id: OpeningId, refId: OpeningId, edge: AlignEdge, hosts: ReadonlyMap<string, HostInfo> = hostsIn(doc)): boolean {
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
    const placed = deriveOpenings(doc.openings, hosts, doc.openingGroups).placed;
    const members = [...list].sort((a, b) => placed.get(a.id)!.start - placed.get(b.id)!.start).map((o) => o.id);
    const openings = doc.openings.map((o) => (want.has(o.id) ? { ...o, rule: { kind: 'inGroup' as const, groupId } } : o));
    const lo = Math.min(...members.map((id) => placed.get(id)!.start));
    const hi = Math.max(...members.map((id) => placed.get(id)!.end));
    const joints = [...(hosts.get(list[0]!.wallId)?.joints ?? new Map<string, { lo: number; hi: number }>())];
    // The nearest joint wholly before the openings, and the nearest wholly after them.
    const before = joints.filter(([, j]) => j.hi <= lo).sort((a, b) => b[1].hi - a[1].hi)[0]?.[0] ?? null;
    const after = joints.filter(([, j]) => j.lo >= hi).sort((a, b) => a[1].lo - b[1].lo)[0]?.[0] ?? null;
    const between = before !== null || after !== null ? { between: [before, after] as const } : {};
    const group = { id: groupId, wallId: list[0]!.wallId, members, spacing, ...between };
    return settleGroups(doc, { ...doc, openings, openingGroups: [...doc.openingGroups.filter((g) => g.id !== groupId), group] });
  },
});

export const setGroupSpacing = (groupId: OpeningGroupId, spacing: GroupSpacing): Command<Doc> => ({
  label: 'cmd.setGroupSpacing',
  apply: (doc) => {
    const g = doc.openingGroups.find((x) => x.id === groupId);
    if (!g || JSON.stringify(g.spacing) === JSON.stringify(spacing)) return doc;
    return { ...doc, openingGroups: doc.openingGroups.map((x) => (x.id === groupId ? { ...x, spacing } : x)) };
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
