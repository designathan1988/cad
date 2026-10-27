/**
 * The path tracer's shader (three-gpu-pathtracer 0.0.27) made quicker to compile. Its direct light
 * (a light or the sky, one picked at random) tested the way to each with a shadow ray of its own:
 * two calls of attenuateHit, and Direct3D (Chrome on Windows, through ANGLE) writes each call out in
 * full, its scene traversal with it. Three traversals inside the bounce loop took the graphics card
 * over 30 s to compile the first time, the page standing still. Here the light or the sky is picked,
 * then one shadow ray tested: the same light, the same weights, one traversal less.
 */
const DIRECT_LIGHT = /* glsl */ `
	vec3 directLightContribution( vec3 worldWo, SurfaceRecord surf, RenderState state, vec3 rayOrigin ) {

		vec3 result = vec3( 0.0 );
		bool sampled = false;
		vec3 direction = vec3( 0.0 );
		float dist = INFINITY;
		float pdf = 0.0;
		vec3 emission = vec3( 0.0 );
		bool delta = false;

		// uniformly pick a light or environment map
		if( lightsDenom != 0.0 && rand( 5 ) < float( lights.count ) / lightsDenom ) {

			LightRecord lightRec = randomLightSample( lights.tex, iesProfiles, lights.count, rayOrigin, rand3( 6 ) );
			sampled = true;
			direction = lightRec.direction;
			dist = lightRec.dist;
			pdf = lightRec.pdf;
			emission = lightRec.emission;
			delta = lightRec.type == SPOT_LIGHT_TYPE || lightRec.type == DIR_LIGHT_TYPE || lightRec.type == POINT_LIGHT_TYPE;

		} else if ( envMapInfo.totalSum != 0.0 && environmentIntensity != 0.0 ) {

			vec3 envColor, envDirection;
			pdf = sampleEquirectProbability( rand2( 7 ), envColor, envDirection );
			sampled = true;
			direction = invEnvRotation3x3 * envDirection;
			dist = INFINITY;
			emission = environmentIntensity * envColor;

		}

		bool isSampleBelowSurface = ! surf.volumeParticle && dot( surf.faceNormal, direction ) < 0.0;
		if ( isSampleBelowSurface ) {

			pdf = 0.0;

		}

		Ray shadowRay;
		shadowRay.origin = rayOrigin;
		shadowRay.direction = direction;
		vec3 attenuatedColor;
		if (
			sampled &&
			pdf > 0.0 &&
			isDirectionValid( direction, surf.normal, surf.faceNormal ) &&
			! attenuateHit( state, shadowRay, dist, attenuatedColor )
		) {

			vec3 sampleColor;
			float materialPdf = bsdfResult( worldWo, direction, surf, sampleColor );
			bool isValidSampleColor = all( greaterThanEqual( sampleColor, vec3( 0.0 ) ) );
			if ( materialPdf > 0.0 && isValidSampleColor ) {

				float lightPdf = pdf / lightsDenom;
				float misWeight = delta ? 1.0 : misHeuristic( lightPdf, materialPdf );
				result = attenuatedColor * emission * state.throughputColor * sampleColor * misWeight / lightPdf;

			}

		}

		return result;

	}
`;

/**
 * The shader with each sample's brightness held under the uniform `fireflyClamp`: a path that found the sun
 * through a lucky glossy bounce (glass, a varnished door) gave one pixel hundreds of times its neighbours'
 * light, a white speck the denoise cannot hide and the samples take minutes to average away. Held at about
 * the sun's own light on a white wall, the picture loses nothing a wall or a floor shows.
 */
export function clampedSamples(fragmentShader: string): string {
  const end = 'gl_FragColor.a *= opacity;';
  const at = fragmentShader.indexOf(end);
  const main = fragmentShader.indexOf('void main()');
  if (at < 0 || main < 0 || fragmentShader.indexOf(end, at + 1) >= 0) {
    throw new Error('three-gpu-pathtracer: its sample output is not the one clampedSamples holds (version changed?)');
  }
  const clamp = 'float sampleLum = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );\n\t\t\t\t\tif ( sampleLum > fireflyClamp ) gl_FragColor.rgb *= fireflyClamp / sampleLum;\n\t\t\t\t\t';
  return `${fragmentShader.slice(0, main)}uniform float fireflyClamp;\n${fragmentShader.slice(main, at)}${clamp}${fragmentShader.slice(at)}`;
}

/** The shader with its direct light tested by one shadow ray; it throws when the library's shader is not the one this was written for. */
export function oneShadowRay(fragmentShader: string): string {
  const start = fragmentShader.indexOf('vec3 directLightContribution(');
  const ret = start < 0 ? -1 : fragmentShader.indexOf('return result;', start);
  const end = ret < 0 ? -1 : fragmentShader.indexOf('}', ret);
  if (end < 0 || (fragmentShader.slice(start, end).match(/attenuateHit\(/g) ?? []).length !== 2) {
    throw new Error('three-gpu-pathtracer: its directLightContribution is not the one oneShadowRay rewrites (version changed?)');
  }
  return fragmentShader.slice(0, start) + DIRECT_LIGHT.trim() + fragmentShader.slice(end + 1);
}
