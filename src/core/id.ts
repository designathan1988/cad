// Random, stable ids. crypto.randomUUID is in every supported browser and in Node.

export const newId = (prefix: string): string => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
