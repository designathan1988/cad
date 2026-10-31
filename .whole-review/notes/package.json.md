# package.json
Lines: 34
Summary: The project's manifest: an ES-module private package with the Vite/Vitest/TypeScript scripts, the dev tools and the runtime libraries (three and its BVH/CSG/path tracer add-ons, pdfjs-dist, polyclip-ts).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 name cad2, private true (npm refuses to publish it), version 0.0.0, "type": "module" (every .js under it is an ES module for Node)
- 6-14 scripts: dev = vite (dev server, the app's start command, URL http://localhost:5173/), build = vite build, preview, typecheck = tsc --noEmit (the static check of this review), test = vitest run, check = typecheck && test && build, mutation = stryker run
- 15-24 devDependencies: Stryker 10.1.1 (exact), @types/node ^22.15.30, @types/three ^0.186.0, fast-check ^4.1.1, typescript ^5.8.3, vite ^8.3.5, vitest ^3.2.4
- 25-33 dependencies (runtime, bundled into the app): pdfjs-dist ^4.10.38, polyclip-ts ^0.16.8, three ^0.186.1, three-bvh-csg ^0.0.18, three-gpu-pathtracer ^0.0.27, three-mesh-bvh ^0.9.16

## Contracts, state and data flow
- Installed (npm ls): pdfjs-dist 4.10.38, polyclip-ts 0.16.8, three 0.186.1, three-bvh-csg 0.0.18, three-gpu-pathtracer 0.0.27, three-mesh-bvh 0.9.16, typescript 5.8.3, vite 8.3.5, vitest 3.2.4, @types/three 0.186.0. Versions to research against in every file.
- Caret on 0.x: ^0.186.1 allows only 0.186.x, ^0.0.18 and ^0.0.27 allow only that exact version (node-semver), so three and its add-ons cannot drift across minor versions by an install.
- No lint script: the static check is tsc only.

## Depends on / used by
- uses: npm/Node (type module), Vite, Vitest, TypeScript, Stryker
- used by: every source file (imports of these libraries), tsconfig.json (types vitest/globals, node), vitest.config.ts, index.html via Vite

## Problems found (finding IDs)
- none in this file

## To check in other files
- three-gpu-pathtracer 0.0.27: the app logs "WebGLPathTracer: This class has been deprecated" (seen in the console 2026-10-28): check its use in render/scene-3d.ts against its docs.
- three-mesh-bvh 0.9.16 logs '"maxLeafTris" option has been deprecated': check who passes maxLeafTris (three-bvh-csg 0.0.18 internally, or the app).

## Sources (pages opened with WebFetch while reading this file, and what each settled)
- https://docs.npmjs.com/cli/v10/configuring-npm/package-json : private true refuses publish; scripts map; dependencies vs devDependencies
- https://github.com/npm/node-semver#caret-ranges-123-025-004 : caret on 0.x keeps the left-most non-zero part (^0.2.3 := >=0.2.3 <0.3.0, ^0.0.3 := only 0.0.3)
- https://nodejs.org/api/packages.html#type : "type": "module" makes .js files ES modules (lines 5)
