# src/app/section-drawing.ts
Lines: 711
Summary: A section or elevation drawn from the model: every solid as triangles (wall blocks by material, opening parts, kinds' meshes), clipped to the mark's plane, ends and depth; the cut filled (wall layers by material with hatch) and outlined; what lies beyond as paper-filled faces far to near with their feature edges; levels, rooms crossed and cut openings; and the painting on paper with dimensions.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-9 header: every solid as triangles; the plane's cut filled and outlined with the cut pen; what lies beyond drawn far to near with paper fill and feature edges (> 20°); levels marked; wall layers by material with hatch; openings' sill/head dimensioned; rooms named
- 11-22 imports: three, document, geometry (hideCategories), vector, Point3, registry eachSolid, KindSolid, openingParts, insideRing/RoomSolid, lookOf/SectionMark, CutPattern, paperHatch
- 24-35 Solid3: group, triangles, cut fill (material colour and pattern), outline group, opening info (floor, bottom, top)
- 37-42 SeenFace: polygon in (along, height), depth, edges to draw
- 44-71 SectionDrawing: faces far to near, cuts per group (loops, segments, fill, fine pen), extent, cut extent, levels, base, openings cut, rooms crossed, line length
- 73-74 topAt: a sloped top clamped to [bottom, top]
- 76-91 prismTriangles: side quads as two triangles each and a fan for top and bottom (correct only for a convex polygon, as its doc says)
- 93-108 geometryTriangles: a three.js geometry's triangles, indexed or not, (x, height, −y) → plan (x, −z... y = −z, z = y + raise); getX denormalizes normalized attributes in the installed three (src/core/BufferAttribute.js:419-427)
- 110-124 turned: Rodrigues rotation about a level axis through o (a door leaf opened)
- 126-142 modelSolids: categories hidden plus guides; wall blocks grouped by material (cut fill from the material), outline group 'walls'; doc unused (`void doc`)
- 143-153 openings' parts (leaf turned), each its own group with the opening's floor/bottom/top
- 154-163 the registry kinds' solids (one or several meshes) as triangles
- 165-176 keys to 0.1 mm, vector helpers, SMOOTH = cos 20°
- 178-213 featureEdges: each triangle edge as a stretch of a line keyed by direction (one way round) and foot point, with the way into its face
- 214-236 per edge, the stretches no other face continues from within 20° (the opposite way in): free stretches as fractions of the edge
- 238-241 V (along, beyond, up) and Ring (vertices with their edge kind: none, face edge, cut)
- 243-261 clipRing: Sutherland–Hodgman on a ring, new edges marked
- 263-275 clipSegment: Liang–Barsky style clip of a segment against several half-spaces
- 277-316 outlineOf: of the cut segments on each line, the stretches only one piece covers (the outline, not inner joints)
- 318-353 loopsOf: cut segments chained end to end (keys at 0.1 mm) into closed loops; open runs left out
- 355-380 longestInside: the longest stretch of a line inside a ring
- 382-400 sectionDrawing start: look, length, along; the frame (along, beyond, up); kept between the ends, out to the depth, and for a room's elevation within its level's floor-to-ceiling; accumulators
- 401-407 the extent grown point by point; flat (along, up)
- 408-414 per solid, its feature edges; per triangle in the frame: skipped wholly in front of the line or past a side
- 415-421 a room's elevation: faces lying on its ceiling facing down or its floor facing up skipped (they belong to the level above/below)
- 422-426 the triangle clipped: at the plane (new edges marked cut) and by the sides; the cut edges kept as cut segments
- 427-440 the face's feature-edge stretches clipped as the face is, as paper lines
- 441-444 the face (polygon, mean depth, edges) kept; the extent grown
- 445-450 the cut outline; an opening's far side along the line (Math.max over a spread of every outline point)
- 451-457 cut groups: wall layers filled with their material and a fine pen, their segments kept for the walls' common outline; others with the cut fill and pen
- 458-462 the walls' outline over all their layers with the cut pen
- 463-469 faces far to near; the levels (the room's own, or all by elevation); the cut extent by Math.min/Math.max over a SPREAD of every cut point (F-0037)
- 470-479 rooms crossed (sections only): the middle of the longest stretch inside, half the room's height up; the drawing returned
- 481-493 sectionDims: heights from the base to each level inside and to the top; the length of what is cut (or all shown)
- 495-515 SectionPaint: paper transform, pens, colours, font, text height, level text, px/mm, length and room text
- 517-518 HATCH_MM: 2 mm hatch spacing on paper
- 520-553 paintSection: faces far to near, each filled with paper, a hair of paper stroke, its edges with the seen pen
- 554-585 cuts: loops filled even-odd with the material colour or the cut fill, the hatch pattern over; segments with the fine or cut pen
- 586-619 the ground line past both ends; each level's dashed line, triangle mark and text at the right
- 620-635 rooms' names over a paper halo
- 636-646 dimensions (when lengths are written) and each cut opening's floor/sill/head chain 3 mm past its far side
- 648-680 upChain: a vertical chain of heights with 45° ticks, extension lines, values turned to read upward
- 682-710 paintDims: the heights up the left 8 mm out; the whole length under the ground 8 mm down

## Contracts, state and data flow
- Pure but for painting; inputs are triangles from modelSolids (doc unused there, line 129).
- Large models: every cut point is spread as arguments into Math.min/Math.max (lines 448, 468); argument counts past engine limits throw (F-0037).

## Depends on / used by
- uses: three (BufferGeometry), app/document.ts, app/geometry.ts, elements/registry.ts, elements/opening/parts.ts, elements/room/derive.ts, elements/section/schema.ts, render/hatch.ts
- used by: app/section-view.ts (sectionCanvas), ui/sections-dialog.ts, render (elevation views): to confirm

## Problems found (finding IDs)
- F-0037 extents computed by spreading every cut point into Math.min/Math.max

## To check in other files
- how many triangles a typical model gives (objects' meshes) for F-0037's reach

## Sources
- https://threejs.org/docs/pages/EdgesGeometry.html : thresholdAngle default 1°, an edge drawn when the faces' normals differ more (header lines 5-6 compare with 20°)
- https://threejs.org/docs/pages/BufferAttribute.html : getX reads the stored item; index attributes have itemSize 1 (lines 94-108); the installed source denormalizes normalized attributes (node_modules/three/src/core/BufferAttribute.js:419-427)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply : argument count limits are engine-defined (JavaScriptCore 65536), most engines throw past them; spread has the same limit (lines 448, 468)
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fill : fill(fillRule) on the current path, "evenodd" (lines 566-573)
