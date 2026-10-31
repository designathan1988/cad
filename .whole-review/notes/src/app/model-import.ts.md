# src/app/model-import.ts
Lines: 84
Summary: Bringing a glTF (.glb, or .gltf with embedded buffers) or OBJ model into the project as a library object: loaded by three.js's loaders (imported on demand), its meshes turned to plan axes and grouped by material colour, made a definition (io/import-mesh.ts), added in one undo step, then placed with the object tool.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: glTF/OBJ as a library object; meshes in plan axes; one group a material; width/depth/height/materials as parameters
- 5-10 imports: App type, three types, newId, el, t, import-mesh (MAX_TRIANGLES, MeshGroup, meshDefinition)
- 12-18 groupsOf: world matrices updated; every mesh with a geometry visited
- 19-27 the geometry cloned with its world matrix applied; positions remapped (x, −z, y): a proper rotation (determinant +1), so the winding is kept
- 28-29 indices: the index buffer, or 0..count−1 for a non-indexed geometry
- 30-31 materials as a list; a material's colour as #rrggbb via getHexString (sRGB by default), else #b5b1aa
- 32-36 a multi-material mesh: a group per geometry group (its slice of the indices, its material's colour); else one group; the clone disposed
- 37-39 the groups returned
- 41-45 load OBJ: OBJLoader imported on demand, parsed from the file's text
- 46-49 load glTF: GLTFLoader on demand; text for .gltf, ArrayBuffer for .glb; parse with path '' (external .bin or textures cannot be resolved: the header says buffers inside); onLoad gives gltf.scene; errors wrapped as Error
- 51-60 importModel: the name without extension; meshDefinition; null → too many triangles toast
- 61-65 one command adds the materials and the definition
- 66-69 toast with the guessed unit (m/cm/mm) and triangles; plan view; the object tool with the new definition
- 70-73 any failure (loader, parse, a compressed glTF without decoder) → a toast with the reason
- 75-83 pickModel: a file input (glb, gltf, obj) clicked; its first file imported

## Contracts, state and data flow
- Colours are sRGB hex from three's linear working colours (correct round trip with the material's colour field).
- A mesh with a negative world scale would flip its winding (not handled; rare in models).

## Depends on / used by
- uses: three (types), three/examples loaders (dynamic import), io/import-mesh.ts, ui/controls.ts (el), ui/i18n.ts, core/id.ts, app/app.ts (store, toast, setView, placeObject)
- used by: actions / object library dialog (pickModel), drop handler (importModel): to confirm when read

## Problems found (finding IDs)
- none

## To check in other files
- io/import-mesh.ts: unit guess and MAX_TRIANGLES

## Sources
- https://threejs.org/docs/pages/GLTFLoader.html : parse(data string|ArrayBuffer, path for external resources, onLoad(gltf) with gltf.scene, onError) (lines 46-48)
- https://threejs.org/docs/pages/Color.html : getHexString defaults to SRGBColorSpace, from the linear working space (line 31)
