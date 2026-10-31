# src/elements/kinds/object.ts
Lines: 382
Summary: Parametric objects in the registry: derivation cached per instance (definition evaluated into pieces, plan rings lowest first, voids, the turned box, floor/bottom/top), 3D geometry per piece (box, rounded box, cylinder, sphere/ellipsoid, revolve, profile, mesh) with voids cut out by CSG, pieces merged per material, crease edges for cut pieces, round-piece side counts by ARC_SAG, plan drawing (hidden at coarse detail), fields; plus dead GLB/DXF members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: pieces per evaluated definition; plan lowest first; 3D per material; "the GLB the same" (export taken out: F-0047); cached while object, level, definitions and materials are the same
- 6-20 imports: three, three-bvh-csg (Brush, Evaluator, SUBTRACTION), RoundedBoxGeometry, mergeGeometries, Material, ARC_SAG, Doc, insideRing, contract types, evaluate helpers, fields, valid, schema, paint, t
- 22-33 ObjectSolid: the item plus rings, voids, turned box, floor, bottom, top
- 35-45 derive with a WeakMap cache per instance (same definitions, materials and level object → reused)
- 47-68 build: solid pieces sorted by top; their outlines; the box in the object's own axes turned back (Math.min/max spread over all ring points); bottom/top from the pieces; voids' outlines
- 70-103 cutGeometries: no voids → each piece's geometry; else a CSG Evaluator (position and normal only, no groups); each void a Brush (world matrix updated) with its bounding box; each solid piece whose box meets a void's is subtracted (non-indexed first), marked cut. three-bvh-csg requires watertight two-manifold brushes: the boxes, cylinders and lathes are; mesh pieces from imported models may not be (results then not manifold)
- 105-150 byMaterial: cut pieces kept apart; others grouped by material JSON and merged (non-indexed, only position/normal/uv where all have it, morphs and groups cleared); mergeGeometries returns null for mismatched attributes (installed three: BufferGeometryUtils.js:133-212), then kept apart
- 152-215 creaseEdges: vertices welded by position (0.1 mm); every triangle edge split at every welded vertex lying on it, found by testing ALL vertices for EACH edge (190-195): O(edges × vertices) (F-0052); edges with two faces meeting at ≥ angle kept
- 217-227 roundSides: sides keeping the chord within ARC_SAG, a multiple of 4, 8 to 64
- 229-241 pieceGeometry revolve: a lathe closed onto the axis, placed
- 242-249 profile: extruded plan shape turned up
- 250-259 mesh, box (rounded when round > 0.1 mm), sphere (scaled), cylinder (r2 top, r bottom)
- 260-289 an ellipsoid, a leaning cylinder, a leaning box: about the base's centre, tilt, roll, turn, then placed
- 290-293 a plain box or mesh turned; placed by its centre
- 295-309 meshGeometry: the unit-box mesh scaled to w × h × d in three.js axes, indexed, normals computed
- 311-326 the kind: key, prefix, category objects, icon, title (definition · type), warnings and problems of the evaluation, dropped, exportName/exportColour (F-0047), valid
- 327-340 derive, element, outlines (box), hit, pick before walls, span, moved, mapped (point and x axis by the transform; a mirror turns rather than mirrors an asymmetric object), similar (definition and type)
- 341-369 plan: hidden at coarse detail unless selected; each ring filled and outlined from the lowest up; voids outlined; the box dashed when selected
- 370-374 solid: per material, at the floor; the lights with the first part
- 375-379 dxfLayers/dxf (F-0047)
- 380-381 fields: objectFields

## Contracts, state and data flow
- The derivation cache keys on the instance object identity; the doc's immutability makes that safe.

## Depends on / used by
- uses: three, three-bvh-csg 0.0.18, three examples (RoundedBoxGeometry, BufferGeometryUtils), elements/object/*, elements/material/schema.ts, core/tolerance.ts
- used by: elements/registry.ts; app/object-handles.ts, app/kind-tools.ts (ObjectSolid); ui definition editor (pieceGeometry, cutGeometries, byMaterial, creaseEdges: to confirm); render/scene-3d.ts (creaseEdges for cut pieces)

## Problems found (finding IDs)
- F-0052 crease edges found in quadratic time
- F-0047 (header GLB mention, exportName/exportColour, dxf)

## To check in other files
- elements/object/evaluate.ts: piece counts; meshes from model-import as CSG brushes

## Sources
- https://github.com/gkjohnson/three-bvh-csg : Evaluator.attributes and useGroups; evaluate returns a new Brush; brushes updateMatrixWorld first; brushes must be watertight two-manifold (lines 78-98)
- https://threejs.org/docs/pages/BufferGeometryUtils.html (404) — read in the installed source instead: node_modules/three/examples/jsm/utils/BufferGeometryUtils.js:133-212 (mergeGeometries returns null when index presence, attribute sets/counts or morph attributes differ) (lines 130-145)
