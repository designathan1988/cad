import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Other sessions work in git worktrees under .claude/worktrees, and Stryker in .stryker-tmp: their
    // tests are not this checkout's.
    exclude: [...configDefaults.exclude, '.claude/**', '.stryker-tmp/**'],
  },
});
