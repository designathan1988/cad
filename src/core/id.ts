// Random, stable ids. crypto.getRandomValues is in every browser, secure context or not (randomUUID
// is not: the app served over plain http on a local network had none), and in Node. 12 hex digits, 48
// random bits: with 8 (32 bits) two ids of a large project had about a 1 in 1,000 chance to meet among
// 3,000 elements.

export const newId = (prefix: string): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `${prefix}_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
};

/** A string with a kind of its own: an id of one kind is not accepted where another's is expected. Only a
 * type (erased when compiled): the id in the file and in memory is the same string. */
export type Brand<B extends string> = string & { readonly __brand: B };

/** Maps an id to its copy's, of the same kind (a copy's id has its original's prefix). */
export type IdMap = <I extends string>(id: I) => I;

/** Any element's id, of whatever kind: what a selection, a hover or a set of elements to draw lit holds. */
export type ElementId = string;
