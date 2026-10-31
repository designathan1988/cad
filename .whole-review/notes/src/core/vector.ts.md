# src/core/vector.ts
Lines: 29
Summary: 2D vector helpers: Point2, vec, add, sub, scale, dot, cross, length, distance, left perpendicular, normalize (zero stays zero) and the intersection of two parametric lines.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 Point2: readonly x and y
- 6-13 vec, add, sub, scale, dot, cross (z of the 3D cross), length (Math.hypot), distance
- 14-15 perp: rotates +90° (left of the direction)
- 17-20 normalize: unit vector; the zero vector stays zero
- 22-28 intersectLines: p + s·u meets q + t·v; null only when cross(u, v) is exactly 0 (nearly parallel lines give a point far away: callers must guard)

## Contracts, state and data flow
- Pure, immutable results.

## Depends on / used by
- uses: nothing
- used by: nearly every geometry module

## Problems found (finding IDs)
- none

## To check in other files
- intersectLines callers with nearly parallel lines (wall joins)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/hypot : no intermediate overflow/underflow; NaN or Infinity cases; () is 0 (line 12)
