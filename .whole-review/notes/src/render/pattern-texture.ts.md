# src/render/pattern-texture.ts
Lines: 248
Summary: Paints a material's surface pattern (tiles, boards with grain, marble veins, granite speckles, irregular flagstones) on a canvas of one period. It makes a repeating sRGB texture of it, gives a geometry triplanar-like UVs in metres turned by the pattern's angle, and builds preview meshes for the dialogs (cached).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: one period painted, joints then pieces, tinted by tone; the 3D lays it in metres
- 5-6 imports: three; patternPieces, SurfacePattern, tone
- 8-9 SIDE 1024 px on the longer side
- 11-19 tint: a #rrggbb colour lighter or darker by a fraction
- 21-63 paintPattern: canvas of the period; background the joint colour (or the piece colour without joints); joints at least a pixel; flagstones apart; each piece tinted (alternating colour), drawn again a period over each way, with grain, veins or speckles by kind
- 65-92 grain: streaks along a board, deterministic by tone
- 94-98 hash: a deterministic number in [0, 1)
- 100-137 veins: a few long curves across a slab, three strokes each (line, halo, offshoot), clipped
- 139-169 stones: a 4 × 4 grid of irregular stones whose corners and side middles move together (so they fit and repeat), each tinted, the joint stroked
- 171-180 speckles: lighter and darker dots over a granite slab (w·h/30 per piece)
- 182-191 patternTexture: CanvasTexture with repeat wrapping, sRGB, anisotropy; the period in metres
- 193-227 patternUvAt: non-indexed geometry (the indexed one disposed); per triangle the dominant normal picks the plane (plan, along x, along z); UVs rotated by the angle and divided by the period
- 229-247 previewTextures cache (unbounded, never disposed: F-0098) and previewMesh: plain or patterned standard material, transparent when an opacity is given

## Contracts, state and data flow
- Pure painting but for the DOM canvas; the preview cache is module state.

## Depends on / used by
- uses: three, elements/material/pattern
- used by: render/scene-3d.ts (patternTexture, patternUvAt for layers), ui object/definition/material dialogs (previewMesh)

## Problems found (finding IDs)
- F-0098 (S3): preview textures never released

## To check in other files
- src/render/scene-3d.ts: disposal of the view's pattern textures

## Sources
- https://threejs.org/docs/pages/Texture.html : dispose() frees GPU resources and must be called when unused; wrapS/wrapT RepeatWrapping; anisotropy; colour data in SRGBColorSpace (lines 182-191, 229-247)
