// Every element's id says its kind (docs/plano-de-escopo.md, phase 1: "tipo explícito no id"): it starts
// with its kind's prefix and an underscore (wall_, opening_, room_…), which is how the app tells a kind
// from an id (elements/registry.ts: kindOfId). A file written elsewhere, or by hand, may have ids
// without it: they are renamed on reading, with every reference to them. Pure.

import type { Doc } from '../project/doc';
import type { DimAnchor } from '../elements/dimension/schema';
import type { Opening, OpeningGroup, PositionRule } from '../elements/opening/schema';
import { GROUP_PREFIX } from '../elements/opening/schema';
import { KINDS, listOf, withList } from '../elements/registry';

/** The document with every id typed, and how many were renamed (0: the same document). */
export function typedIds(doc: Doc): { doc: Doc; renamed: number } {
  const taken = new Set([...KINDS.flatMap((k) => listOf(doc, k).map((e) => e.id)), ...doc.openingGroups.map((g) => g.id)]);
  const renames = new Map<string, string>();
  const typed = (id: string, prefix: string): string => {
    if (id.startsWith(`${prefix}_`)) return id;
    let next = `${prefix}_${id}`;
    for (let n = 2; taken.has(next); n++) next = `${prefix}_${id}_${n}`;
    taken.add(next);
    renames.set(id, next);
    return next;
  };
  // The ids first, each list by its kind's prefix (the groups of doors and windows by theirs).
  for (const k of KINDS) for (const e of listOf(doc, k)) typed(e.id, k.prefix);
  for (const g of doc.openingGroups) typed(g.id, GROUP_PREFIX);
  if (renames.size === 0) return { doc, renamed: 0 };
  const to = (id: string) => renames.get(id) ?? id;
  let next = doc;
  for (const k of KINDS) next = withList(next, k, listOf(next, k).map((e) => ({ ...e, id: to(e.id) })));
  // Then what refers to them: a door's wall, its rule's door or group; a group's wall, members and the
  // walls it keeps between; a room's floor; a dimension's ends.
  const rule = (r: PositionRule): PositionRule =>
    r.kind === 'fromOpening' || r.kind === 'aligned' ? { ...r, openingId: to(r.openingId) } : r.kind === 'inGroup' ? { ...r, groupId: to(r.groupId) } : r;
  const anchor = (a: DimAnchor): DimAnchor => (a.kind === 'wall' ? { ...a, wallId: to(a.wallId) } : a.kind === 'opening' ? { ...a, openingId: to(a.openingId) } : a);
  next = {
    ...next,
    openings: next.openings.map((o): Opening => ({ ...o, wallId: to(o.wallId), rule: rule(o.rule) })),
    openingGroups: doc.openingGroups.map(
      (g): OpeningGroup => ({ ...g, id: to(g.id), wallId: to(g.wallId), members: g.members.map(to), ...(g.between ? { between: [g.between[0] && to(g.between[0]), g.between[1] && to(g.between[1])] as const } : {}) }),
    ),
    floors: next.floors.map((f) => (f.source.kind === 'room' ? { ...f, source: { kind: 'room' as const, roomId: to(f.source.roomId) } } : f)),
    dimensions: next.dimensions.map((d) => ({ ...d, a: anchor(d.a), b: anchor(d.b) })),
  };
  return { doc: next, renamed: renames.size };
}
