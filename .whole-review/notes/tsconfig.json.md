# tsconfig.json
Lines: 19
Summary: TypeScript compiler options for src and tests: ES2022 target, bundler module resolution (Vite), the strict family plus noUncheckedIndexedAccess and exactOptionalPropertyTypes, unused locals/params as errors, isolatedModules, globals only from vitest and node. It is what `npx tsc --noEmit` (the review's static check) checks.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 target ES2022 (no lib set: the target's full default lib, DOM included), module ESNext, moduleResolution Bundler (no extensions on relative imports, package exports honoured)
- 6-12 strict; noUncheckedIndexedAccess (index reads are T | undefined: the many `!` in the code); exactOptionalPropertyTypes (an optional prop cannot be set to undefined: the code's `...(x ? { k: x } : {})` spreads); noImplicitOverride; noUnusedLocals/Parameters (dead locals fail the check); noFallthroughCasesInSwitch
- 13-15 isolatedModules (each file transpilable alone: what Vite/esbuild and scripts/breaks/build.cjs rely on), skipLibCheck (.d.ts of libraries not checked), types: only vitest/globals and node add globals (no vite/client)
- 16-18 include src and tests (tests are type-checked with the app)

## Contracts, state and data flow
- The static check covers src and tests; exported but unused symbols are NOT reported (noUnusedLocals only covers locals), so dead exports need reading.
- No vite/client in types: any `import.meta.env` or asset import (`?url`, `?raw`) needs its own declaration (src/assets.d.ts).

## Depends on / used by
- uses: typescript 5.8.3, vitest/globals, @types/node
- used by: npm run typecheck, the review's check, editors; Vite does not type-check

## Problems found (finding IDs)
- none in this file

## To check in other files
- src/assets.d.ts: declares the asset imports the app uses (no vite/client types)
- tests using describe/it globals vs imports from vitest (both fine with vitest/globals)

## Sources (pages opened with WebFetch while reading this file, and what each settled)
- https://www.typescriptlang.org/tsconfig/ : moduleResolution bundler, noUncheckedIndexedAccess, exactOptionalPropertyTypes, types restricting global @types (below TS 6 all are included by default); the page's isolatedModules/skipLibCheck/lib parts were past the part read (lines 13-14 and the DOM default are described from the TS option names, marked as such)
