// Every element's id says its kind (docs/plano-de-escopo.md, phase 1: "tipo explícito no id"): it starts
// with its kind's prefix and an underscore (wall_, opening_, room_…), which is how the app tells a kind
// from an id (elements/registry.ts: kindOfId). A file written elsewhere, or by hand, may have ids
// without it: they are renamed on reading, with every reference to them. Pure.

import type { Doc } from './doc';
import type { DimAnchor } from '../elements/dimension/schema';
import { isArcMeasure } from '../elements/measure/schema';
import type { Opening, OpeningGroup, PositionRule } from '../elements/opening/schema';
import { GROUP_PREFIX } from '../elements/opening/schema';
import { KINDS, listOf, withList } from '../elements/registry';

/** The document with every id typed, and how many were renamed (0: the same document). */
export function typedIds(doc: Doc): { doc: Doc; renamed: number } {
  const taken = new Set([...KINDS.flatMap((k) => listOf(doc, k).map((e) => e.id)), ...doc.openingGroups.map((g) => g.id)]);
  // By the list an element is in, then its id: by the id alone, a wall "a" and a room "a" shared one rename and
  // every reference went to whichever was renamed last (F-0097).
  const renames = new Map<string, Map<string, string>>();
  const typed = (list: string, id: string, prefix: string): void => {
    if (id.startsWith(`${prefix}_`)) return;
    let next = `${prefix}_${id}`;
    for (let n = 2; taken.has(next); n++) next = `${prefix}_${id}_${n}`;
    taken.add(next);
    const mine = renames.get(list) ?? new Map<string, string>();
    renames.set(list, mine.set(id, next));
  };
  // The ids first, each list by its kind's prefix (the groups of doors and windows by theirs).
  for (const k of KINDS) for (const e of listOf(doc, k)) typed(k.key, e.id, k.prefix);
  for (const g of doc.openingGroups) typed('openingGroups', g.id, GROUP_PREFIX);
  const renamed = [...renames.values()].reduce((n, m) => n + m.size, 0);
  if (renamed === 0) return { doc, renamed: 0 };
  const into =
    (list: string) =>
    <I extends string>(id: I): I =>
      (renames.get(list)?.get(id) ?? id) as I;
  const wall = into('walls');
  const opening = into('openings');
  const group = into('openingGroups');
  const room = into('rooms');
  let next = doc;
  for (const k of KINDS) next = withList(next, k, listOf(next, k).map((e) => ({ ...e, id: into(k.key)(e.id) })));
  // Then what refers to them: a door's wall, its rule's door or group; a group's wall, members and the walls it
  // keeps between; a room's floor; a dimension's ends; a zone's rooms; a guardrail's stair or floor; an arc
  // measure's wall. Zones, hosts and arc measures kept the old names, their links broken (F-0097).
  const rule = (r: PositionRule): PositionRule =>
    r.kind === 'fromOpening' || r.kind === 'aligned' ? { ...r, openingId: opening(r.openingId) } : r.kind === 'inGroup' ? { ...r, groupId: group(r.groupId) } : r;
  const anchor = (a: DimAnchor): DimAnchor => (a.kind === 'wall' ? { ...a, wallId: wall(a.wallId) } : a.kind === 'opening' ? { ...a, openingId: opening(a.openingId) } : a);
  next = {
    ...next,
    openings: next.openings.map((o): Opening => ({ ...o, wallId: wall(o.wallId), rule: rule(o.rule) })),
    openingGroups: doc.openingGroups.map(
      (g): OpeningGroup => ({
        ...g,
        id: group(g.id),
        wallId: wall(g.wallId),
        members: g.members.map(opening),
        ...(g.between ? { between: [g.between[0] && wall(g.between[0]), g.between[1] && wall(g.between[1])] as const } : {}),
      }),
    ),
    floors: next.floors.map((f) => (f.source.kind === 'room' ? { ...f, source: { kind: 'room' as const, roomId: room(f.source.roomId) } } : f)),
    dimensions: next.dimensions.map((d) => ({ ...d, a: anchor(d.a), b: anchor(d.b) })),
    zones: next.zones.map((z) => ({ ...z, rooms: z.rooms.map(room) })),
    railings: next.railings.map((r) =>
      !r.host ? r : 'stairId' in r.host ? { ...r, host: { ...r.host, stairId: into('stairs')(r.host.stairId) } } : { ...r, host: { floorId: into('floors')(r.host.floorId) } },
    ),
    measures: next.measures.map((m) => (isArcMeasure(m) ? { ...m, wallId: wall(m.wallId) } : m)),
  };
  return { doc: next, renamed };
}
