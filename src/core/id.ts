// Random, stable ids. crypto.getRandomValues is in every browser, secure context or not (randomUUID
// is not: the app served over plain http on a local network had none), and in Node. 12 hex digits, 48
// random bits: with 8 (32 bits) two ids of a large project had about a 1 in 1,000 chance to meet among
// 3,000 elements.

export const newId = (prefix: string): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `${prefix}_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
};
