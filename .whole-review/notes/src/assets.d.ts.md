# src/assets.d.ts
Lines: 6
Summary: An ambient module declaration so TypeScript accepts Vite's "?url" imports (the pdf.js worker's address in app/reference-ui.ts) as a default string export.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: what Vite gives for "?url" and who uses it
- 2-5 declare module '*?url' with a default export url: string

## Contracts, state and data flow
- tsconfig.json's "types" lists vitest/globals and node, not vite/client, so this file is what types the "?url" import (Vite: TypeScript does not know asset imports unless vite/client is included).

## Depends on / used by
- uses: nothing
- used by: app/reference-ui.ts:39 (pdfjs-dist/build/pdf.worker.min.mjs?url)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vite.dev/guide/assets : "?url" gives the asset's resolved URL; TypeScript needs vite/client (or a declaration) to accept asset imports (lines 1-5)
