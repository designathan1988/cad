# tests/render/trace-shader.test.ts
Lines: 33
Summary: Tests the two shader patches the app applies to three-gpu-pathtracer's GLSL, against the installed library.
- oneShadowRay removes exactly one attenuateHit call from the direct light and leaves everything before that function unchanged.
- Both patches throw on a shader they were not written for, instead of half rewriting it.
- clampedSamples declares the firefly clamp uniform before main, and applies the clamp inside main before the alpha line.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the direct light with one shadow ray, against the installed shader
- 3-5 imports: vitest, the whole three-gpu-pathtracer module, clampedSamples/oneShadowRay
- 7-8 PhysicalPathTracingMaterial taken through a cast (exported by the JS, missing from the typings)
- 10 calls(): counts attenuateHit( in a source
- 12-19 one call fewer after the patch; directLightContribution still present; the prefix up to it unchanged
- 21-24 both patches throw on 'void main() {}'
- 26-32 fireflyClamp declared before main; the clamp line after main and before 'gl_FragColor.a *= opacity;'; suite closes (line 33 blank)

## Contracts, state and data flow
- The patches work by string search on the library's private shader source. This test pins them to the installed version when the suite runs; at runtime nothing checks them (F-0099). The library's current README documents a WebGPU path tracer and does not mention PhysicalPathTracingMaterial, so an update past the caret-pinned 0.0.x would likely break these patches.

## Depends on / used by
- uses: three-gpu-pathtracer, src/render/trace-shader
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0099 (Also: the cast to an untyped export; no runtime check)

## To check in other files
- none

## Sources
- https://github.com/gkjohnson/three-gpu-pathtracer : the README documents a WebGPU tracer and does not list PhysicalPathTracingMaterial (lines 4-8)
