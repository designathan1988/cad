# tests/ui/ribbon-objects.test.ts
Lines: 28
Summary: Tests that the ribbon shows only some of the library's objects. Showing 16 pushed the Rooms and Reference panels out of sight, so the ribbon now shows at most RIBBON_OBJECTS. A new project shows the library's first ones. When an object is being placed and another is already placed, both are shown, in library order, after the first ones.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: why the ribbon shows a few objects, and which
- 4-6 imports: vitest, RIBBON_OBJECTS/ribbonObjects, newDocument
- 8-11 the doc, its definition ids, appOf (a stub app cast `as never` with a tool and the object being placed)
- 13-16 more definitions than the ribbon shows; a new project shows ids[0 .. RIBBON_OBJECTS)
- 18-27 the last definition being placed and the second-last placed: RIBBON_OBJECTS shown, the last two being placed and last, the rest the first ids; suite closes (line 27; 28 blank)

## Contracts, state and data flow
- ribbonObjects picks the object being placed and the ones in use, plus the library's first ones up to the cap, in library order. This is ribbon layout logic; the other session's interface work questions the ribbon itself (orders 17:15).

## Depends on / used by
- uses: src/app/ribbon-tabs, src/app/document
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice : negative indices count from the end; end is exclusive (lines 24-25)
