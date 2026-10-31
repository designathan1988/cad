// The app's whole style sheet as the browser reads it: styles.css with each of its @import lines
// replaced by the part it names (src/ui/styles/*.css), in order.

import { readFileSync } from 'node:fs';

const index = new URL('../../src/ui/styles.css', import.meta.url);

export const stylesText = (): string =>
  readFileSync(index, 'utf8').replace(/^@import '([^']+)';$/gm, (_, part: string) => readFileSync(new URL(part, index), 'utf8'));
