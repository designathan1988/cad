// Checks for data read from a file: shared by the file reader and the kinds' validators.

export const isObject = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null;
export const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const isPoint = (p: unknown): boolean => isObject(p) && finite(p.x) && finite(p.y);

/** A #rrggbb colour (a # followed by six hex digits, either case). */
export const isColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
