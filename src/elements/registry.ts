// The registry of element kinds (contract.ts): the order they are drawn, picked and shown in the panel.
// Generic helpers over the document and the derived geometry for the app's shared code.

import type { Doc } from '../app/document';
import type { Point2 } from '../core/vector';
import type { Transform } from '../tools/transform';
import type { DerivedGeometry } from '../app/geometry';
import type { FloorSolid } from './room/derive';
import { type Box, boxOf, RTree } from '../core/rtree';
import type { AnyKind, BaseGeometry, KindKey } from './contract';
import { beamKind } from './kinds/beam';
import { columnKind } from './kinds/column';
import { dimensionKind } from './kinds/dimension';
import { floorKind } from './kinds/floor';
import { gridKind } from './kinds/grid';
import { guideKind } from './kinds/guide';
import { noteKind } from './kinds/note';
import { objectKind } from './kinds/object';
import { openingKind } from './kinds/opening';
import { railingKind } from './kinds/railing';
import { roomKind } from './kinds/room';
import { separatorKind } from './kinds/separator';
import { curtainKind } from './kinds/curtain';
import { zoneKind } from './kinds/zone';
import { sectionKind } from './kinds/section';
import { roofKind } from './kinds/roof';
import { stairKind } from './kinds/stair';
import { wallKind } from './kinds/wall';

/** Drawn in this order (later over earlier); the panel shows the first with a selected element. */
export const KINDS: readonly AnyKind[] = [wallKind, openingKind, stairKind, railingKind, columnKind, roofKind, objectKind, floorKind, zoneKind, roomKind, separatorKind, curtainKind, gridKind, sectionKind, beamKind, guideKind, noteKind, dimensionKind];

export const kindOfKey = (key: KindKey): AnyKind => KINDS.find((k) => k.key === key)!;

/** The kind an id belongs to, by its prefix; null for the elements not in the registry yet. */
export const kindOfId = (id: string): AnyKind | null => KINDS.find((k) => id.startsWith(`${k.prefix}_`)) ?? null;

/** A kind's list in the document (an axis has no level: it is on every one). */
export const listOf = (doc: Doc, k: AnyKind): readonly { readonly id: string; readonly levelId: string }[] =>
  doc[k.key] as readonly { readonly id: string; readonly levelId: string }[];

/** The level a derived element is on; null for one on every level. */
export const levelOfSolid = (k: AnyKind, s: unknown): string | null => (k.everyLevel ? null : k.levelOf ? k.levelOf(s) : (k.element(s) as { levelId: string }).levelId);

/** The level of an element of the document (a door's, its wall's); null for one on every level. */
export const levelOfElement = (k: AnyKind, e: { readonly levelId?: string }, doc: Doc): string | null => (k.everyLevel ? null : k.levelIn ? k.levelIn(e, doc) : (e.levelId ?? null));

/** The document with a kind's list replaced. */
export const withList = (doc: Doc, k: AnyKind, list: readonly unknown[]): Doc => ({ ...doc, [k.key]: list }) as Doc;

/** The derived forms of every kind's elements, by kind then id. */
export type KindSolids = ReadonlyMap<KindKey, ReadonlyMap<string, unknown>>;

/** What was derived of an element, and the level it was derived on (contract.ts: memo). */
const derived = new WeakMap<object, { readonly level: unknown; readonly s: unknown }>();

/**
 * `g`: the walls, doors and the rest already derived, which a dimension is placed from. The document is
 * never changed in place: an element not changed is the same object, so what was derived of it holds
 * while what it depends on (contract.ts: memo) is the same too, and only the rest is derived again.
 */
export function deriveKinds(doc: Doc, g: BaseGeometry): KindSolids {
  return new Map(
    KINDS.map((k) => [
      k.key,
      new Map(
        listOf(doc, k).flatMap((e) => {
          const level = k.memo === 'level' ? doc.levels.find((l) => l.id === e.levelId) : null;
          const kept = k.memo ? derived.get(e) : undefined;
          const s = kept && kept.level === level ? kept.s : k.derive(doc, e, g);
          if (k.memo && kept?.s !== s) derived.set(e, { level, s });
          return s === null ? [] : [[e.id, s] as const];
        }),
      ),
    ]),
  );
}

/** The derived forms, keeping only those `keep` says. */
export function filterKinds(solids: KindSolids, keep: (k: AnyKind, s: unknown) => boolean): KindSolids {
  return new Map(
    KINDS.map((k) => {
      const all = solids.get(k.key) ?? new Map<string, unknown>();
      const kept = [...all].filter(([, s]) => keep(k, s));
      // A kind that loses nothing keeps its own map: what was drawn of it stays as it was.
      return [k.key, kept.length === all.size ? all : new Map(kept)];
    }),
  );
}

/** Every derived element, with its kind. */
export function* eachSolid(solids: KindSolids): Generator<{ kind: AnyKind; solid: unknown; id: string; levelId: string | null }> {
  for (const k of KINDS)
    for (const [id, s] of solids.get(k.key) ?? new Map()) {
      yield { kind: k, solid: s, id, levelId: levelOfSolid(k, s) };
    }
}

/** The floors as built, by id (kinds/floor.ts). */
export const floorsOf = (g: { readonly kinds: KindSolids }): ReadonlyMap<string, FloorSolid> => (g.kinds.get('floors') ?? new Map()) as ReadonlyMap<string, FloorSolid>;

/** The spatial index of a derivation's elements (core/rtree.ts), built once per derivation. Those whose
 * reach depends on the view's scale (a text's letters, an axis's bubbles) or has no end (a guide) are
 * always asked. */
const indexes = new WeakMap<KindSolids, { tree: RTree; ids: string[]; always: string[] }>();

/** The ids of the elements whose box comes within `near` of p: what a click there can take. */
export function kindsNear(solids: KindSolids, p: Point2, near: number): Set<string> {
  let index = indexes.get(solids);
  if (!index) {
    const boxes: Box[] = [];
    const ids: string[] = [];
    const always: string[] = [];
    for (const x of eachSolid(solids)) {
      const k = x.kind;
      const box = k.endless || k.grab || k.layer === 'over' ? null : boxOf(k.extent ? k.extent(x.solid) : k.outlines(x.solid).flat());
      if (box) {
        boxes.push(box);
        ids.push(x.id);
      } else always.push(x.id);
    }
    index = { tree: new RTree(boxes), ids, always };
    indexes.set(solids, index);
  }
  const found = index.tree.search({ minX: p.x - near, minY: p.y - near, maxX: p.x + near, maxY: p.y + near });
  return new Set([...found.map((i) => index.ids[i]!), ...index.always]);
}

/** The derived forms of one kind. */
export const solidsOf = <S>(solids: KindSolids, k: AnyKind): S[] => [...((solids.get(k.key) ?? new Map()) as Map<string, S>).values()];

/** Whether a derived element with this id is there. */
export const hasSolid = (solids: KindSolids, id: string): boolean => {
  const k = kindOfId(id);
  return k !== null && (solids.get(k.key)?.has(id) ?? false);
};

/** The document with the registry elements among `ids` moved by d; the same document when none moves. */
export function moveKinds(doc: Doc, ids: ReadonlySet<string>, d: { readonly x: number; readonly y: number }): Doc {
  if (ids.size === 0 || (d.x === 0 && d.y === 0)) return doc;
  let next = doc;
  for (const k of KINDS) {
    // A door or window goes with its wall (contract.ts: walled).
    if (k.walled) continue;
    const list = listOf(doc, k);
    if (!list.some((e) => ids.has(e.id))) continue;
    next = withList(next, k, list.map((e) => (ids.has(e.id) ? k.moved(e, d) : e)));
  }
  return next;
}

/** The ids of the registry elements among `ids`. */
export const kindIds = (doc: Doc, ids: Iterable<string>): Set<string> => {
  const set = new Set(ids);
  return new Set(KINDS.flatMap((k) => listOf(doc, k).filter((e) => set.has(e.id)).map((e) => e.id)));
};

/** The registry's lists of a document: to carry them over into another version of it. */
export const kindLists = (doc: Doc): Partial<Doc> => Object.fromEntries(KINDS.map((k) => [k.key, doc[k.key]])) as Partial<Doc>;

/** Whether any registry element is among `ids`. */
export const hasKinds = (doc: Doc, ids: ReadonlySet<string>): boolean => KINDS.some((k) => listOf(doc, k).some((e) => ids.has(e.id)));

/** Whether an element goes with what goes: among `ids`, or held by one of them (contract.ts: holders). */
const goesWith = (k: AnyKind, e: { readonly id: string }, ids: ReadonlySet<string>): boolean => ids.has(e.id) || (k.holders?.(e) ?? []).some((h) => ids.has(h));

/** The document without the registry elements among `ids`, and those held by them (a dimension by a
 * deleted wall, as Revit's goes); one following a deleted element stands alone (a room's floor keeps
 * its outline: contract.ts, released). The same document when nothing changes. `g`: the document's. */
export function dropKinds(doc: Doc, ids: ReadonlySet<string>, g: DerivedGeometry): Doc {
  let next = doc;
  for (const k of KINDS) {
    if (k.walled) continue;
    const list = listOf(doc, k);
    const released = (e: { readonly id: string }) => {
      const f = k.follows?.(e);
      return f !== null && f !== undefined && ids.has(f) && k.released ? k.released(e, g) : e;
    };
    const kept = list.filter((e) => !goesWith(k, e, ids)).map(released);
    if (kept.length !== list.length || kept.some((e, i) => e !== list[i])) next = withList(next, k, kept);
  }
  return next;
}

/** What a Modify tool tells the kinds held by others: what goes along, the copies' ids, the document before. */
export interface KindTransform {
  readonly going: (id: string) => boolean;
  readonly doc: Doc;
  readonly geometry: DerivedGeometry;
}

/** The registry elements among `ids` taken by `t` where they are; one held by what goes, with it. */
export function mapKinds(doc: Doc, ids: ReadonlySet<string>, t: Transform, c: KindTransform): Doc {
  let next = doc;
  for (const k of KINDS) {
    if (k.walled) continue;
    const list = listOf(doc, k);
    const { transformed } = k;
    if (transformed) {
      const mapped = list.map((e) => transformed(e, { ...c, t, id: e.id, selected: ids.has(e.id), copy: false, to: (id) => id }) ?? e);
      if (mapped.some((e, i) => e !== list[i])) next = withList(next, k, mapped);
    } else if (list.some((e) => ids.has(e.id))) next = withList(next, k, list.map((e) => (ids.has(e.id) ? k.mapped(e, t, e.id) : e)));
  }
  return next;
}

/** Copies of the registry elements among `ids` taken by `t`, each under `fresh(id, prefix)`; the new ids in order. */
export function copyKinds(
  doc: Doc,
  ids: ReadonlySet<string>,
  t: Transform,
  fresh: (id: string, prefix: string) => string,
  c: KindTransform & { readonly to: (id: string) => string },
): { doc: Doc; added: string[] } {
  // What each kind copies: the selected, those going along (a room with all its walls), and those
  // following what is copied (a room's floor its room).
  const taken = KINDS.map((k) => {
    if (k.walled) return [];
    const following = (e: { readonly id: string }) => {
      const f = k.follows?.(e);
      return f !== null && f !== undefined && (c.going(f) || ids.has(f));
    };
    return listOf(doc, k).filter((e) => ids.has(e.id) || c.going(e.id) || following(e));
  });
  // Every copy's id first, so one copy can refer to another's (a floor to its room's copy).
  const fresher = new Map(taken.flatMap((list, i) => list.map((e) => [e.id, fresh(e.id, KINDS[i]!.prefix)] as const)));
  const to = (id: string) => fresher.get(id) ?? c.to(id);
  let next = doc;
  const added: string[] = [];
  KINDS.forEach((k, i) => {
    const list = listOf(doc, k);
    if (taken[i]!.length === 0) return;
    const all = taken[i]!.reduce<unknown[]>((so, e) => {
      const id = fresher.get(e.id)!;
      // One held by others: held by their copies, or left out (contract.ts: transformed).
      const copy = k.transformed ? k.transformed(e, { ...c, to, t, id, selected: ids.has(e.id), copy: true }) : k.mapped(e, t, id);
      if (copy === null) return so;
      // The copies of the selected are selected; those that only went along are not.
      if (ids.has(e.id)) added.push(id);
      return [...so, k.copied ? k.copied(so, copy) : copy];
    }, [...list]);
    next = withList(next, k, all);
  });
  return { doc: next, added };
}

/** The registry elements `after` has beyond `before` (appended at the ends of its lists), on the level `levelId`. */
export function kindsOnLevel(after: Doc, before: Doc, levelId: string): Doc {
  let next = after;
  for (const k of KINDS) {
    if (k.everyLevel || k.walled) continue;
    const n = listOf(before, k).length;
    next = withList(next, k, listOf(after, k).map((e, i) => (i >= n ? { ...e, levelId } : e)));
  }
  return next;
}

/** The registry elements `after` has beyond `before`, added at the ends of `onto`'s lists. */
export function appendKinds(onto: Doc, after: Doc, before: Doc): Doc {
  let next = onto;
  for (const k of KINDS) {
    // An axis is on every level already: pasting it would lay a second one over it. A door goes with its wall.
    if (k.everyLevel || k.walled) continue;
    const extra = listOf(after, k).slice(listOf(before, k).length);
    if (extra.length > 0) next = withList(next, k, [...listOf(onto, k), ...extra]);
  }
  return next;
}

/** The ids of the registry elements on the axis line `onLine` (every level). */
export const kindsOnLine = (doc: Doc, onLine: (p: Point2) => boolean): string[] =>
  KINDS.flatMap((k) => (k.onGrid ? listOf(doc, k).filter((e) => k.onGrid!(e, onLine)).map((e) => e.id) : []));

/** "Select similar" over the registry: the elements on `levelId` like a selected one of their kind. */
export function similarKinds(doc: Doc, selected: ReadonlySet<string>, levelId: string): string[] {
  return KINDS.flatMap((k) => {
    if (!k.similar) return [];
    const list = listOf(doc, k);
    const picked = list.filter((e) => selected.has(e.id));
    return list.filter((e) => levelOfElement(k, e, doc) === levelId && picked.some((x) => k.similar!(x, e))).map((e) => e.id);
  });
}

/** Whether the document has any registry element. */
export const anyKinds = (doc: Doc): boolean => KINDS.some((k) => listOf(doc, k).length > 0);
