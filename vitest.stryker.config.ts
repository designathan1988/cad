// The tests Stryker runs against the wall engine's mutants (docs/wall-joins-spec.md §12.2): the wall
// element's own, the property suites among them.
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/elements/wall/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '.claude/**', '.stryker-tmp/**'],
  },
});
