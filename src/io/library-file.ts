// A library to share (docs/plano-de-escopo.md, diferenciais, 9: "bibliotecas compartilháveis de
// objetos e materiais por link"): object definitions with the definitions they nest and the materials
// they use, and materials alone; as a JSON file, or in a link (#lib=…, the file deflated and in
// base64url) that opens the app and brings them into the project open. Read in, each is checked as the
// project file checks it; a definition or a material whose id the project has, and is not the same,
// comes in under a new id, and what refers to it follows, so an object looks as it did where it was
// made. Pure but for the link's compression.

import { newId } from '../core/id';
import type { Doc } from '../app/document';
import type { Material } from '../elements/material/schema';
import { DEFINITION_PREFIX, type ObjectDefinition, type Part } from '../elements/object/schema';
import { isDefinition } from '../elements/object/valid';
import { isMaterial } from './project-file';

export const LIBRARY_VERSION = 2;

export interface LibraryFile {
  readonly cad2Library: number;
  readonly definitions: readonly ObjectDefinition[];
  readonly materials: readonly Material[];
}

/** Every place a definition names a material, each through `f` (an id, or a material parameter's name). */
function mapMaterials(d: ObjectDefinition, all: readonly ObjectDefinition[], f: (id: string) => string): ObjectDefinition {
  const materialParams = new Set(d.params.filter((p) => p.kind === 'material').map((p) => p.name));
  // A parameter's name is not a material: only ids go through f.
  const ref = (s: string) => (materialParams.has(s) ? s : f(s));
  const part = (p: Part): Part => {
    const material = p.material === undefined ? {} : { material: ref(p.material) };
    if (p.kind !== 'object' || !p.values) return { ...p, ...material };
    // A nested object's material parameters given here, as material ids.
    const nested = all.find((x) => x.id === p.definition);
    const its = new Set(nested?.params.filter((q) => q.kind === 'material').map((q) => q.name) ?? []);
    const values = Object.fromEntries(Object.entries(p.values).map(([k, v]) => [k, its.has(k) && typeof v === 'string' ? ref(v) : v]));
    return { ...p, ...material, values };
  };
  return {
    ...d,
    params: d.params.map((p) => (p.kind === 'material' && typeof p.default === 'string' ? { ...p, default: f(p.default) } : p)),
    parts: d.parts.map(part),
    types: d.types.map((ty) => ({ ...ty, values: Object.fromEntries(Object.entries(ty.values).map(([k, v]) => [k, materialParams.has(k) && typeof v === 'string' ? f(v) : v])) })),
  };
}

/** The materials a definition uses, by id. */
export function materialsUsed(d: ObjectDefinition, all: readonly ObjectDefinition[]): Set<string> {
  const used = new Set<string>();
  mapMaterials(d, all, (id) => {
    used.add(id);
    return id;
  });
  return used;
}

/**
 * A library of these definitions (all the project's when `ids` is null) with every definition they
 * nest, and these materials with every one the definitions use.
 */
export function libraryOf(doc: Doc, ids: readonly string[] | null, materialIds: readonly string[] = []): LibraryFile {
  const chosen = new Set(ids ?? doc.definitions.map((d) => d.id));
  // The nested ones, as deep as they go.
  const queue = [...chosen];
  while (queue.length > 0) {
    const id = queue.pop();
    const d = doc.definitions.find((x) => x.id === id);
    for (const p of d?.parts ?? []) if (p.kind === 'object' && !chosen.has(p.definition)) (chosen.add(p.definition), queue.push(p.definition));
  }
  const definitions = doc.definitions.filter((d) => chosen.has(d.id));
  const wanted = new Set(materialIds);
  for (const d of definitions) for (const id of materialsUsed(d, doc.definitions)) wanted.add(id);
  const materials = doc.materials.filter((m) => wanted.has(m.id));
  return { cad2Library: LIBRARY_VERSION, definitions, materials };
}

export type MergeResult =
  | { readonly ok: true; readonly doc: Doc; readonly definitions: number; readonly materials: number; readonly bad: number }
  | { readonly ok: false; readonly error: 'notLibrary' };

/**
 * A library read into the project: its valid definitions and materials added. A material whose id the
 * project has is the project's when the same, else comes in under a new id; a definition whose id the
 * project has comes in under a new one. What refers to either follows. A plain list of definitions
 * (the first library files) is read too.
 */
export function mergeLibrary(doc: Doc, raw: unknown): MergeResult {
  const r = raw as { definitions?: unknown; materials?: unknown } | null;
  const list = Array.isArray(raw) ? raw : r?.definitions;
  const mats = Array.isArray(raw) ? [] : (r?.materials ?? []);
  if (!Array.isArray(list) || !Array.isArray(mats)) return { ok: false, error: 'notLibrary' };
  const goodMats = mats.filter(isMaterial);
  const good = list.filter(isDefinition);
  // Materials: the same one is the project's; another under a taken id gets a new id.
  const same = (a: Material, b: Material) => JSON.stringify(a) === JSON.stringify(b);
  const matIds = new Map<string, string>();
  const addedMats: Material[] = [];
  const takenMats = new Set(doc.materials.map((m) => m.id));
  for (const m of goodMats) {
    const mine = doc.materials.find((x) => x.id === m.id);
    if (mine && same(mine, m)) continue;
    const id = takenMats.has(m.id) ? newId('mat') : m.id;
    takenMats.add(id);
    matIds.set(m.id, id);
    addedMats.push({ ...m, id });
  }
  // Definitions: a taken id gets a new one; the definitions of the library that nest it follow.
  const taken = new Set(doc.definitions.map((d) => d.id));
  const defIds = new Map<string, string>();
  for (const d of good) {
    const id = taken.has(d.id) ? newId(DEFINITION_PREFIX) : d.id;
    taken.add(id);
    defIds.set(d.id, id);
  }
  const added = good.map((d): ObjectDefinition => {
    const moved = mapMaterials(d, good, (id) => matIds.get(id) ?? id);
    return {
      ...moved,
      id: defIds.get(d.id)!,
      parts: moved.parts.map((p) => (p.kind === 'object' && defIds.has(p.definition) ? { ...p, definition: defIds.get(p.definition)! } : p)),
    };
  });
  return {
    ok: true,
    doc: { ...doc, materials: [...doc.materials, ...addedMats], definitions: [...doc.definitions, ...added] },
    definitions: added.length,
    materials: addedMats.length,
    bad: list.length - good.length + mats.length - goodMats.length,
  };
}

/** What a link carries the library after: `#lib=`. */
export const LINK_KEY = 'lib=';

const toBase64Url = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

async function through(bytes: Uint8Array, t: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(t)).arrayBuffer());
}

/** The library as a link's hash: `#lib=` and the JSON deflated, in base64url. */
export async function libraryHash(file: LibraryFile): Promise<string> {
  const bytes = await through(new TextEncoder().encode(JSON.stringify(file)), new CompressionStream('deflate-raw'));
  return `#${LINK_KEY}${toBase64Url(bytes)}`;
}

/** The library a link's hash carries, as read (to be checked by mergeLibrary); null when it carries none. */
export async function libraryFromHash(hash: string): Promise<unknown> {
  const at = hash.indexOf(LINK_KEY);
  if (at < 0) return null;
  const bytes = await through(fromBase64Url(hash.slice(at + LINK_KEY.length)), new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}
