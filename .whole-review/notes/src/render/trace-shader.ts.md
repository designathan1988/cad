# src/render/trace-shader.ts
Lines: 106
Summary: Two string patches applied to three-gpu-pathtracer 0.0.27's path-tracing fragment shader: one shadow ray per bounce instead of two attenuateHit calls (to cut the Direct3D compile time), and a per-sample luminance clamp against fireflies driven by a `fireflyClamp` uniform. Each patch throws when the source is not the one expected.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-8 header: why the shader is patched (two attenuateHit inlines make ANGLE/Direct3D compile for minutes), for version 0.0.27 only
- 9-77 DIRECT_LIGHT: the GLSL replacement of directLightContribution: picks one light or the environment uniformly, traces a single shadow ray, weights by MIS against the BSDF pdf, returns the contribution
- 79-94 clampedSamples: finds 'gl_FragColor.a *= opacity;' and 'void main()', throws if either is missing, declares `uniform float fireflyClamp;` and scales each sample down when its Rec. 709 luminance (0.2126/0.7152/0.0722) exceeds the clamp
- 96-105 oneShadowRay: finds directLightContribution up to its 'return result;' and closing brace, requires exactly two attenuateHit calls (throws otherwise) and splices DIRECT_LIGHT in its place

## Contracts, state and data flow
- Pure string functions over the library's fragment source; they throw on any mismatch so a silent wrong patch is impossible, but the caller does not catch the throw (F-0099 Also).
- The luminance clamp is applied to the linear radiance of the sample, which is where the Rec. 709 weights are valid.

## Depends on / used by
- uses: nothing (strings only); relies on the internal GLSL of three-gpu-pathtracer 0.0.27
- used by: render/scene-3d.ts:758 (traceStep setup), uniform set at 759 and 800

## Problems found (finding IDs)
- F-0099 (Also): the patches throw out of traceStep's setup, uncaught, when the library's shader changes; the dependency is on a caret range

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Relative_luminance : Y = 0.2126 R + 0.7152 G + 0.0722 B for Rec. 709/sRGB primaries, on linear values (lines 79-94)
