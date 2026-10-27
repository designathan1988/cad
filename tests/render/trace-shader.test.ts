// The path tracer's direct light rewritten with one shadow ray: it applies to the installed library's shader.

import { describe, expect, it } from 'vitest';
import * as tracer from 'three-gpu-pathtracer';
import { clampedSamples, oneShadowRay } from '../../src/render/trace-shader';

// Exported by the library's JavaScript (index.js), left out of its typings.
const { PhysicalPathTracingMaterial } = tracer as unknown as { PhysicalPathTracingMaterial: new () => { fragmentShader: string } };

const calls = (s: string) => (s.match(/attenuateHit\(/g) ?? []).length;

describe('oneShadowRay', () => {
  it('leaves one shadow ray in the direct light, the rest of the shader as it was', () => {
    const before = new PhysicalPathTracingMaterial().fragmentShader;
    const after = oneShadowRay(before);
    expect(calls(before) - calls(after)).toBe(1);
    expect(after).toContain('vec3 directLightContribution(');
    expect(after.slice(0, before.indexOf('vec3 directLightContribution('))).toBe(before.slice(0, before.indexOf('vec3 directLightContribution(')));
  });

  it('a shader it was not written for is refused, not half rewritten', () => {
    expect(() => oneShadowRay('void main() {}')).toThrow();
    expect(() => clampedSamples('void main() {}')).toThrow();
  });

  it('each sample is held under the firefly clamp, declared before main, written before its alpha', () => {
    const s = clampedSamples(new PhysicalPathTracingMaterial().fragmentShader);
    expect(s.indexOf('uniform float fireflyClamp;')).toBeLessThan(s.indexOf('void main()'));
    expect(s.indexOf('fireflyClamp / sampleLum')).toBeLessThan(s.indexOf('gl_FragColor.a *= opacity;'));
    expect(s.indexOf('fireflyClamp / sampleLum')).toBeGreaterThan(s.indexOf('void main()'));
  });
});
