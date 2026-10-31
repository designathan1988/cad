// Random, stable ids. crypto.randomUUID is in every supported browser and in Node.

export const newId = (prefix: string): string => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

/** A string with a kind of its own: an id of one kind is not accepted where another's is expected. Only a
 * type (erased when compiled): the id in the file and in memory is the same string. */
export type Brand<B extends string> = string & { readonly __brand: B };

/** Any element's id, of whatever kind: what a selection, a hover or a set of elements to draw lit holds. */
export type ElementId = string;
