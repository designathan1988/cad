# src/elements/material/schema.ts
Lines: 174
Summary: Materials as project data (colour, PBR roughness/metalness, cut hatch, optional surface pattern and physics), the built-in library (~70 materials), see-through opacities, the stand-in for an unknown id, lookup with fallback, and the plan's cut fill (shaded for the theme and mixed until the wall line has 3:1 contrast).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: phase 2; PBR as three.js and glTF read them, "in 3D and in the GLB" (export taken out: F-0047); a pattern painted in 3D
- 7-8 imports: PATTERN_DEFAULTS/SurfacePattern, MaterialPhysics
- 10-15 MaterialId, CutPattern and CUT_PATTERNS
- 17-32 Material: id, name (empty for built-ins, translated), colour, roughness, metalness, cut, pattern, physics
- 34-115 BUILT_IN_MATERIALS: walls (plaster, brick, concrete, gypsum, insulation), woods, metals, glass, floors (tile, screed, gravel), fabrics, stones, plastics, roofs (clayTile), construction blocks and boards, floorings with patterns (uniform: one literal per material, same shape)
- 117-118 SEE_THROUGH: glass 0.45, frosted 0.8, water 0.7
- 120-121 materialFor: a built-in by id, else a plain grey one named by its id
- 123 isColor: #rrggbb
- 125-126 materialIn: the project's by id, else materialFor (a deleted built-in comes back with its built-in values; a deleted user material becomes plain grey: F-0058's effect)
- 128-136 channels: from #rrggbb or rgb(r g b)
- 138-146 luminance (WCAG relative luminance, 0.03928 threshold) and contrast ((L1 + 0.05)/(L2 + 0.05))
- 148-165 cutFill: shaded; contrast with the line ≥ 3 → as is; else mixed toward white or black in 5 % steps until 3:1
- 167-173 shade: channels × k for the dark theme

## Contracts, state and data flow
- Layers and kinds store material ids; lookups never fail (materialIn falls back).

## Depends on / used by
- uses: elements/material/pattern.ts, physics.ts (type)
- used by: materials dialog, kinds (materialIn), render/plan-view.ts (cutFill, shade), render/scene-3d.ts, io/project-file.ts (isColor, built-ins), layer-sets.ts (isColor)

## Problems found (finding IDs)
- F-0058 (effect completed: materialIn's fallback)
- F-0047 (header)

## To check in other files
- none

## Sources
- https://www.w3.org/TR/WCAG21/#dfn-relative-luminance : contrast ratio (L1 + 0.05)/(L2 + 0.05); non-text graphics need 3:1 (1.4.11) (lines 138-165)
