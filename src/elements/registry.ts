// The registry of element kinds (contract.ts): the order they are drawn, picked and shown in the panel.
// Generic helpers over the document and the derived geometry for the app's shared code.

import type { Doc } from '../app/document';
import type { Point2 } from '../core/vector';
import type { Transform } from '../tools/transform';
import type { AnyKind, KindKey } from './contract';
import { beamKind } from './kinds/beam';
import { columnKind } from './kinds/column';
import { gridKind } from './kinds/grid';
import { noteKind } from './kinds/note';
import { railingKind } from './kinds/railing';
import { roofKind } from './kinds/roof';
import { stairKind } from './kinds/stair';

/** Drawn in this order (later over earlier); the panel shows the first with a selected element. */
export const KINDS: readonly AnyKind[] = [stairKind, railingKind, columnKind, roofKind, gridKind, beamKind, noteKind];

export const kindOfKey = (key: KindKey): AnyKind => KINDS.find((k) => k.key === key)!;

/** The kind an id belongs to, by its prefix; null for the elements not in the registry yet. */
export const kindOfId = (id: string): AnyKind | null => KINDS.find((k) => id.startsWith(`${k.prefix}_`)) ?? null;

/** A kind's list in the document (an axis has no level: it is on every one). */
export const listOf = (doc: Doc, k: AnyKind): readonly { readonly id: string; readonly levelId: string }[] =>
  doc[k.key] as readonly { readonly id: string; readonly levelId: string }[];

/** The level a derived element is on; null for one on every level. */
export const levelOfSolid = (k: AnyKind, s: unknown): string | null => (k.everyLevel ? null : (k.element(s) as { levelId: string }).levelId);

/** The document with a kind's list replaced. */
export const withList = (doc: Doc, k: AnyKind, list: readonly unknown[]): Doc => ({ ...doc, [k.key]: list }) as Doc;

/** The derived forms of every kind's elements, by kind then id. */
export type KindSolids = ReadonlyMap<KindKey, ReadonlyMap<string, unknown>>;

export function deriveKinds(doc: Doc): KindSolids {
  return new Map(KINDS.map((k) => [k.key, new Map(listOf(doc, k).map((e) => [e.id, k.derive(doc, e)]))]));
}

/** The derived forms, keeping only those `keep` says. */
export function filterKinds(solids: KindSolids, keep: (k: AnyKind, s: unknown) => boolean): KindSolids {
  return new Map(KINDS.map((k) => [k.key, new Map([...(solids.get(k.key) ?? new Map())].filter(([, s]) => keep(k, s)))]));
}

/** Every derived element, with its kind. */
export function* eachSolid(solids: KindSolids): Generator<{ kind: AnyKind; solid: unknown; id: string; levelId: string | null }> {
  for (const k of KINDS)
    for (const [id, s] of solids.get(k.key) ?? new Map()) {
      yield { kind: k, solid: s, id, levelId: levelOfSolid(k, s) };
    }
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

/** The document without the registry elements among `ids`; the same document when none goes. */
export function dropKinds(doc: Doc, ids: ReadonlySet<string>): Doc {
  let next = doc;
  for (const k of KINDS) {
    const list = listOf(doc, k);
    if (list.some((e) => ids.has(e.id))) next = withList(next, k, list.filter((e) => !ids.has(e.id)));
  }
  return next;
}

/** The registry elements among `ids` taken by `t` where they are. */
export function mapKinds(doc: Doc, ids: ReadonlySet<string>, t: Transform): Doc {
  let next = doc;
  for (const k of KINDS) {
    const list = listOf(doc, k);
    if (list.some((e) => ids.has(e.id))) next = withList(next, k, list.map((e) => (ids.has(e.id) ? k.mapped(e, t, e.id) : e)));
  }
  return next;
}

/** Copies of the registry elements among `ids` taken by `t`, each under `fresh(id, prefix)`; the new ids in order. */
export function copyKinds(doc: Doc, ids: ReadonlySet<string>, t: Transform, fresh: (id: string, prefix: string) => string): { doc: Doc; added: string[] } {
  let next = doc;
  const added: string[] = [];
  for (const k of KINDS) {
    const list = listOf(doc, k);
    const taken = list.filter((e) => ids.has(e.id));
    if (taken.length === 0) continue;
    // One after another: a copy named on from the copies before it.
    const all = taken.reduce<unknown[]>((so, e) => {
      const copy = k.mapped(e, t, fresh(e.id, k.prefix));
      return [...so, k.copied ? k.copied(so, copy) : copy];
    }, [...list]);
    added.push(...all.slice(list.length).map((e) => (e as { readonly id: string }).id));
    next = withList(next, k, all);
  }
  return { doc: next, added };
}

/** The registry elements `after` has beyond `before` (appended at the ends of its lists), on the level `levelId`. */
export function kindsOnLevel(after: Doc, before: Doc, levelId: string): Doc {
  let next = after;
  for (const k of KINDS) {
    if (k.everyLevel) continue;
    const n = listOf(before, k).length;
    next = withList(next, k, listOf(after, k).map((e, i) => (i >= n ? { ...e, levelId } : e)));
  }
  return next;
}

/** The registry elements `after` has beyond `before`, added at the ends of `onto`'s lists. */
export function appendKinds(onto: Doc, after: Doc, before: Doc): Doc {
  let next = onto;
  for (const k of KINDS) {
    // An axis is on every level already: pasting it would lay a second one over it.
    if (k.everyLevel) continue;
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
    return list.filter((e) => e.levelId === levelId && picked.some((x) => k.similar!(x, e))).map((e) => e.id);
  });
}

/** Whether the document has any registry element. */
export const anyKinds = (doc: Doc): boolean => KINDS.some((k) => listOf(doc, k).length > 0);
