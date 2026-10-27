---
name: photoreal-trace
description: How the photorealistic view (three-gpu-pathtracer 0.0.27) is kept clean and quick, and the traps found
metadata:
  type: project
---

The photorealistic view (src/render/scene-3d.ts traceStep, src/render/trace-shader.ts) must never show grain, fireflies, stair-stepped shadows or a frozen page.

- The first compile froze the page ~30 s on Windows (ANGLE/D3D inlines every function; directLightContribution called attenuateHit twice). oneShadowRay rewrites it to one call. Do NOT set FEATURE_MIS 0: it removes the sun's direct light, black specks everywhere.
- clampedSamples clamps each sample's luminance (fireflyClamp uniform, ~sun intensity).
- The library reads its targets NearestFilter: set them to LinearFilter (if OES_texture_float_linear), or the 0.75-scale trace has stair-stepped shadow edges.
- The trace is shown only from TRACE[quality].shown samples; until then the raster view is drawn on the trace's sky (photoSky) and ground (photoGround), so a camera move does not flash the dark theme background.
- The ground sits at the walls' foot (`stand`), not the lowest slab's bottom: otherwise the sun leaked under the walls of a room without a floor (bright streaks in the shadow).

**Why:** the user rejected each of these defects in screenshots ("TIRE ESSE MALDITO GRANULADO", "DEFEITOS EVIDENTES NAS SOMBRAS", "TRAVA A APLICAÇÃO").

**How to apply:** after any change to the trace, check in the app at 5, 20 and 40 s, after a right-button orbit, and zoomed on shadow edges, wall faces and the ground in the house's shadow.
