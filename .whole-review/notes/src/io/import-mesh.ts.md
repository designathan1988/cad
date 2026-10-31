# src/io/import-mesh.ts
Lines: 126
Summary: Turns a loaded 3D model (glTF or OBJ meshes, already in plan axes) into a parametric object definition. Each colour becomes one mesh in a unit box, which width, depth and height (with handles) stretch, and a material parameter per colour defaults to that colour. The file's unit is guessed from its size. Also holds the convex hull of the plan outline.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: phase 11 import as a library object; unit guessed from the size (F-0093); pure, the loaders are the app's
- 8-9 imports: Material and object schema types
- 11-18 MeshGroup: positions, optional indices, colour
- 20-21 MAX_TRIANGLES 60,000
- 23-39 hull: Andrew's monotone chain on points deduplicated to 1e-5, counter-clockwise
- 41-48 MeshDefinition: definition, new materials, unit, triangle count
- 50-53 meshDefinition: triangle count; none or too many → null
- 54-64 bounding box, size per axis, the unit guess (> 2,000 → mm, > 20 → cm, else m) for every format
- 65-68 dimensions in metres (at least 1 cm), one material per distinct colour
- 69-91 per colour: positions normalised to the unit box, indices rebased, plan hull; a mesh part stretched to the box with its material parameter
- 92-107 length parameters (default, 10 % to 10× range, 5 mm step) and material parameters
- 108-125 the definition: handles on width (both sides), depth (both sides) and height; one type "as imported"; meshes

## Contracts, state and data flow
- Pure. Definitions it makes pass object/valid.ts (positions in the unit box, indices in range).
- The unit is a guess for every format, glTF included (F-0093).

## Depends on / used by
- uses: material/schema and object/schema (types)
- used by: app/model-import.ts (glTF/OBJ import)

## Problems found (finding IDs)
- F-0093 (S3): glTF unit guessed instead of metres

## To check in other files
- src/app/model-import.ts

## Sources
- https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html : §3.4 "The units for all linear distances are meters"; +Y up (lines 5-6, 62-64)
