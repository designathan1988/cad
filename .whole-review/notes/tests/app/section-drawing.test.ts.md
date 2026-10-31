# tests/app/section-drawing.test.ts
Lines: 330
Summary: Tests of sections and elevations drawn from the model on a hand-worked 4×3 box of 15 cm walls: cut extents of the two walls, layers cut in their materials (plaster, brick, plaster), dimensions (heights, length), the drawing following a moved wall, what is seen beyond and depth limits, the other direction, openings dimensioned and rooms named, a room's interior elevation per level (and whole height without one), level marks; feature edges of triangles, outlines of side-by-side layers, closed loops; section marks (lettering, look direction, elevations around and inside, commands, validation, file round trip, older files).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: the box worked by hand; the section at x = 1 looking west
- 6-16 imports: vitest, document, geometry, section-drawing functions, Point3, section schema/commands, project file, newOpening, levelOfSolid, sectionKind
- 18-32 wall helper, box (south wall movable), the section mark across
- 34-42 extents of cut outlines (two stacked doc comments: F-0039 Also)
- 44-114 a section drawn from the model: the two cut walls' extents, layers in their materials, dimensions (heights, length), a moved wall moves its cut, seen faces and the depth limit, the other direction
- 116-140 openings dimensioned (window and door cut) and the room named; a section beside the house crosses nothing
- 142-198 a room's interior elevation per level (seen from inside, its level only, its side walls cut 30 cm in), the whole height without a level, the elevation on its level's plan and in the file, every level marked
- 200-276 the lines of a face: diagonals removed, partial shared edges, right-angle edges kept, side-by-side layers' outline, loops closed and open runs left out
- 278-329 section marks: names, look, elevations around, commands (rename, depth, flip), validation, file, older file

## Contracts, state and data flow
- Pure section drawing over derived solids; expect.closeTo used inside structural expectations.

## Depends on / used by
- uses: src/app/document, geometry, section-drawing, section-box (type), elements/section (schema, commands), io/project-file, elements/opening/schema, elements/registry, elements/kinds/section
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0039 (Also): two stacked doc comments at 34-36

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#expect-closeto : asymmetric closeTo inside toEqual/toMatchObject with a precision (lines 83-135)
