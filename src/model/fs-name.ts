/** A name as a file name: what one cannot hold (backslash slash colon star question quote lt gt pipe) becomes a dash. */
export const safeFileName = (text: string): string => text.replace(/[\\/:*?"<>|]+/g, '-');
