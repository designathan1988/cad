// Tuple types.

/** A tuple without its first element: a facade method's arguments, the function's less the app. */
export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : never;
