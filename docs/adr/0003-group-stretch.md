# 0003 — A distributed group keeps to its stretch of wall

Status: accepted, 2026-10-24.

## Context

Equal spacing spread a group over the whole length of its wall. On a wall that another wall meets in
the middle (a T or an X), an opening could land on that joint and be marked invalid
(`openingAtJoint`). The tester saw it twice: two windows left of an X, one put on it (CK65 → CK66),
and the same with a T.

## Decision

A group may keep a stretch: `between`, the two walls whose joints bound it along the host (null is
the host's end). Distribute records it from the joints just outside the selected openings; a wall
with no joint inside it records none, and the group takes the whole wall as before. The stretch is a
reference the user chose, like Revit's EQ between references: positions are derived from the joints
as the walls are now, so the group follows when a bounding wall moves, and takes the whole wall back
when that wall is gone. Fixed spacing measures its anchor from the same stretch.

Only joints inside the wall count (`app/geometry.ts`, `jointsIn`); a corner at a wall's end does not,
so groups between corners are placed as before. File version 4 carries the field; version 3 groups
have none.

## Openings on both sides of a joint (2026-10-26)

Openings selected on both sides of a joint are first spread over the whole wall, as before; when that
puts none on a joint, it is kept. When it would put one on a joint, there is no single equal spacing
that skips it, so the selection is split where a joint lies between two neighbours: each run of two or
more becomes its own group, spread in its own stretch (`between` recorded for each); one opening alone
on its side stays where it is.

## Not done

Every run of one (one opening on each side of a joint) with the whole-wall spread landing on the joint:
it is spread over the wall anyway, and the opening on the joint says so (`openingAtJoint`).
