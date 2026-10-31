# vitest.config.ts
Lines: 10
Summary: Vitest configuration: the default excludes plus other sessions' worktrees (.claude/**) and Stryker's sandbox (.stryker-tmp/**).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 imports configDefaults and defineConfig from vitest/config
- 3-9 export default defineConfig({ test: { exclude: [...configDefaults.exclude, '.claude/**', '.stryker-tmp/**'] } }); the comment says why (worktrees of other sessions, Stryker's copies)

## Contracts, state and data flow
- exclude replaces Vitest's default list, so the defaults are spread first (as the docs show); include stays the default (**/*.{test,spec}.?(c|m)[jt]s?(x)), so tests/**/*.test.ts run and the oracle/fixture/scenes helpers (no .test.) are only imported.

## Depends on / used by
- uses: vitest 3.2.4
- used by: npm test (vitest run); vitest.stryker.config.ts (not in this review's scope) for mutation runs

## Problems found (finding IDs)
- none in this file

## To check in other files
- .breaks/ (scripts/breaks output) is gitignored but not excluded here; it holds no .test. files (only transpiled src), so nothing runs from it.

## Sources
- https://v3.vitest.dev/config : default test.exclude list; setting exclude replaces it, spreading configDefaults.exclude keeps it; defineConfig from vitest/config with options under test
