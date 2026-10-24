// Commands on openings. Each returns a new document; the store makes each one undo step. No command
// moves an opening as a side effect: when a reference goes away, the rules that used it are rewritten
// to keep their openings where they were.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { WallId } from '../wall/schema';
import { deriveOpenings, hostsOf } from './derive';
import type { Opening, OpeningId, PositionRule, RuleKind } from './schema';

export const addOpening = (opening: Opening): Command<Doc> => ({
  label: 'cmd.addOpening',
  apply: (doc) => ({ ...doc, openings: [...doc.openings, opening] }),
});

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
    return changed ? { ...doc, openings } : doc;
  },
});

/**
 * Deletes walls and openings by id in one step. The openings a deleted wall hosts go with it; an
 * opening measured from a deleted one is measured from its wall's start instead, at the same place.
 */
export const deleteElements = (ids: readonly (WallId | OpeningId)[]): Command<Doc> => ({
  label: 'cmd.deleteElements',
  apply: (doc) => {
    const drop = new Set(ids);
    const walls = doc.walls.filter((w) => !drop.has(w.id));
    const gone = new Set(doc.openings.filter((o) => drop.has(o.id) || drop.has(o.wallId)).map((o) => o.id));
    if (walls.length === doc.walls.length && gone.size === 0) return doc;
    const { placed } = deriveOpenings(doc.openings, hostsOf(doc));
    const openings = doc.openings
      .filter((o) => !gone.has(o.id))
      .map((o) =>
        o.rule.kind === 'fromOpening' && gone.has(o.rule.openingId)
          ? { ...o, rule: { kind: 'fromStart' as const, distance: placed.get(o.id)!.start } }
          : o,
      );
    return { ...doc, walls, openings };
  },
});

/**
 * The rule of another kind that leaves the opening where it is now, or null when there is none: a
 * reference opening must be another one on the same wall that does not already depend on this one.
 */
export function ruleKeepingPosition(doc: Doc, id: OpeningId, kind: RuleKind, referenceId?: OpeningId): PositionRule | null {
  const { placed } = deriveOpenings(doc.openings, hostsOf(doc));
  const me = placed.get(id);
  const host = me && hostsOf(doc).get(me.opening.wallId);
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
  }
}

/** Does opening `id` reach `target` by following references? */
function dependsOn(openings: readonly Opening[], id: OpeningId, target: OpeningId): boolean {
  const byId = new Map(openings.map((o) => [o.id, o]));
  const seen = new Set<OpeningId>();
  let at = byId.get(id);
  while (at && at.rule.kind === 'fromOpening' && !seen.has(at.id)) {
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
