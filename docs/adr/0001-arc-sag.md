# ADR 0001 — ARC_SAG: maximum chord sag of arc walls

Date: 2026-10-24 · Status: accepted

## Context

Arc walls are drawn as chains of straight segments (spec §5.2): every piece stays convex and every cut
a half-plane, which is what makes the join engine exact. The chain must follow the circle closely
enough that nobody sees or measures the difference, and the segment count must depend only on the
wall, never on zoom or view.

## Decision

Add `ARC_SAG = 5e-4` m (0.5 mm) to `src/core/tolerance.ts`, the value the spec already names. An arc
of sweep θ whose largest face radius is R is split into

    n = ceil(|θ| / (2 · acos(1 − ARC_SAG / R)))

equal segments, so no face chord strays more than 0.5 mm from its circle. Half of POINT_TOLERANCE
(1 mm), so the chord error never reaches what the model treats as one point.

## Consequences

A semicircle of radius 3 m with a 20 cm wall has 88 segments. Very large radii give many segments
(158 for R = 100 m over one radian); the count is capped at 2048 per wall, where a chord of a full
circle sags R·(1 − cos(π/2048)) ≈ 1.2e-6·R.
