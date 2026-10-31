# src/render/scene-3d.ts
Lines: 1603
Summary: The 3D view (three.js). It keeps meshes in step with the derived geometry by id (walls by visible faces, openings, registry kinds) and draws feature edges per level. It also handles materials with world-space patterns, visual styles (shaded, hidden, consistent, realistic with shadows/AO, photorealistic by path tracing), quality levels, x-ray and renovation phases, horizontal cut / section box / vertical section with cap fills, orthographic or perspective cameras, picking and rays, framing beside panels, and on-demand rendering.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: reads derived geometry, syncs meshes by id, disposes what it drops, renders on change; axis mapping; prisms without 3D booleans
- 5-30 imports: creaseEdges, three, pattern textures, OrbitControls, EffectComposer/RenderPass/GTAOPass/OutputPass, RoomEnvironment, three-gpu-pathtracer (DenoiseMaterial, GradientEquirectTexture, WebGLPathTracer), trace shader patches, FullScreenQuad, BVH worker, view types, geometry types, materials, wall paint, visible faces, prisms, registry, kind solid type, feature edges, opening parts, section box
- 32-36 ground span, minimum, field of view
- 37-49 QUALITY per level: render ratio, max, shadow map size, soft shadows, ambient occlusion samples and blend
- 50-68 Compiling type; TRACE per quality (scale, samples, picture samples, shown-from); trace exposure; x-ray and glass opacity
- 69-113 PatternUniforms and patterned(): onBeforeCompile injects world-position box mapping of a pattern texture (plan for up/down faces, along the wall for sideways), rotated and scaled by the period
- 115-123 patternUv: CPU UVs matching the shader (pattern-texture.ts)
- 125-141 LAMP_SCALE (lumens to point light) and groundFade (radial alpha texture)
- 143-157 Scene3D: renderer, perspective and orthographic cameras, the active camera, controls
- 158-200 scene, wall groups by id, shape keys, layer and phase materials, x-ray, the base materials (sides, tops, floor, roof, selection, preview, glass, leaf, frame, invalid), clipping planes (cut and section box), caps groups and materials, last sync
- 201-230 edges per level, lights (sky, sun, fill, ambient), shadows flag, style, brightness, sun scale, quality, composer, environment, hidden-line face material, shadow ground
- 231-249 covered insets and view shift, grid, ground (kept as a frame, never drawn), render flags
- 250-283 path tracer state: tracer, its shader, sky, scene, build promise, traced pattern materials, traced glass, ground (a misplaced comment at 263: F-0039 Also), frosted glass, photo ground, stand height, what was traced, content version, callbacks
- 285-341 constructor: renderer, camera, orbit controls (wheel zoom at cursor, middle pans, right rotates, left free for tools; polar limit), lights and shadows, shadow ground, grid, ground frame, photo ground, local clipping, materials prepared, cap groups
- 343-369 setCut: a horizontal clip plane at z; cap fills from the wall sections at that height (keyed by JSON of the sections)
- 371-378 prepare: clipping planes and polygon offset so edges show
- 380-409 layerMaterial: one per project material, "mep_" materials kept whole in x-ray (services removed: F-0036 Also), patterned, colour white under a pattern, finish, see-through materials (glass, frosted, water)
- 411-430 setPattern: repainted when the pattern or colour changes, the old texture disposed; the PATTERN define toggled (recompile)
- 432-439 faint: x-ray or see-through opacity and depth writing
- 441-466 setPhases (an x-ray doc comment left above it: F-0039 Also): one material per renovation phase in its colour, demolished ones see-through
- 468-475 setXray: walls, floors and layers faint, edges stronger
- 477-486 lifelike (realistic or photo) and applyEdges by style
- 488-526 setLook: quality's pixel ratio, PCF shadows and their map size, ACES tone mapping and a room environment for realistic styles, edges, shadows
- 528-547 setLight and applyLights: ambient for consistent colours, sun and sky by style, fill for shaded/hidden, environment intensity
- 549-564 applyShadows: realistic only; materials recompiled when shadows toggle
- 566-595 effects: GTAO post-processing (multisampled half-float target) when the quality and style ask and nothing clips
- 597-650 draw: hidden-line faces swapped to white; the trace when photo and nothing clips; else the raster frame (photo's sky and ground, realistic's fading ground)
- 652-670 trace: one sample more; "preparing" said until the first traced picture
- 672-688 photoSky (gradient equirect) and fireflyClamp
- 690-772 traceStep setup: WebGLPathTracer with 5 bounces, no low-res preview, glossy filter, a denoise with tone mapping and lower exposure; BVH in a worker; private internals patched (shader defines, fragment source, compile target, linear filtering: F-0099)
- 773-820 per step: render scale; the scene rebuilt in the background when content changed (old geometries disposed); camera and lights given when they changed; a sample; waiting on the background compile; the realistic view kept until enough samples
- 822-885 traceCopies: every visible mesh split by material groups into world-space copies; glass as transmissive glass, patterns as textured materials; a matte ground under all; the luminaires' lights copied
- 887-898 tracedPattern: a textured material per patterned one, rebuilt when the texture changes
- 900-923 setBox: six inward planes for the section box
- 925-937 setSection: a vertical plane behind the section line
- 939-989 syncBoxCaps: cap fills where the box's faces and the section cut walls and floors (keyed by identity and JSON)
- 991-999 clipPlanes: the shared planes (cut, box, section), caps clipped by the box only
- 1001-1028 setOrtho: perspective ↔ orthographic keeping direction, target and size
- 1030-1037 opened doors and windows
- 1039-1084 setTheme: base materials, caps, edges, ground and lights from design tokens; grid colours per vertex and opacity by theme
- 1086-1114 invalidate (one rAF) and render: resize, aspect, ortho frustum, view offset for panels, draw, onChange after a projection change
- 1116-1180 snapshot: a larger picture with finer shadows, traced up to the picture's samples in a blocking loop (up to 60 s); no caller since image export left (F-0047 Also)
- 1182-1214 sync: lift per level; openings keyed by state, open and shape (JSON of frame and opening), rebuilt only on change
- 1215-1256 registry kinds with a solid: keyed by JSON of the derived solid; parts in scene or project materials, crease/edge lines, luminaires' point lights scaled from lumens
- 1257-1290 walls: layer materials refreshed; keyed by state, phase and shape (blocks, materials and visible faces); built; unseen groups dropped
- 1291-1296 edges, last sync, box caps, ground placed, invalidate
- 1298-1334 syncEdges: feature lines per level when the walls change, lifted with their levels, never picked
- 1336-1355 placeSun: fixed direction over the model's middle, shadow camera round it
- 1357-1366 castShadows: every mesh casts and receives while shadows are on
- 1368-1389 placeGround: ground and grid under the model's extent at the lowest base; the photo view's stand at the walls' foot
- 1391-1406 facesOf: visible faces of every block of every wall, cached per derived geometry
- 1408-1420 build: each block a prism of its visible faces (sloped under a roof) in side/top materials, or a phase's
- 1422-1442 buildOpening: parts in the state's or their own materials, tilted about their axis, outlined
- 1444-1450 outline: crease edges for cut object parts, else EdgesGeometry at 20°, never picked
- 1452-1458 drop: geometry disposed (materials shared)
- 1460-1470 pick: the element under a screen point by raycast
- 1472-1485 surfacePoint: the first accepted element hit, in plan coordinates with its height
- 1487-1496 rayAt: the camera ray in plan coordinates, no level lift (F-0040 Also)
- 1498-1506 groundPoint: a screen point on the horizontal plane at z
- 1508-1514 metresPerPixel: by the distance to the point at height z (F-0022 Also)
- 1516-1530 a stray doc comment, panScreen (view shift) and setCovered
- 1532-1558 frame: fit a box in what the panels leave visible, perspective or orthographic
- 1560-1587 orbit and zoomBy by keyboard within the mouse's limits
- 1589-1601 dispose: groups, base and layer materials (with pattern textures), edges, controls, renderer (the tracer, composer, environment, phase and traced materials are not disposed)

## Contracts, state and data flow
- Reads derived geometry; meshes keyed by id and a shape key (JSON strings cached per solid object); dropped groups' geometries disposed; renders on demand through one rAF.
- The photorealistic path tracer depends on private internals of three-gpu-pathtracer (F-0099).
- Level lift (exploded view) is applied to groups, not to rays or the pixel scale (F-0040, F-0022).

## Depends on / used by
- uses: three and addons (OrbitControls, postprocessing, RoomEnvironment), three-gpu-pathtracer, three-mesh-bvh worker, render (pattern-texture, prisms, wall-paint, trace-shader), elements (faces, edges, opening parts, registry, materials, kinds/object creaseEdges), app (geometry types, section-box, view-3d types)
- used by: app.ts (scene), frame.ts (sync, theme, look, cut, box, opened), input.ts (pick, surfacePoint, rayAt, groundPoint, metresPerPixel), view-3d/view-ui (frame, orbit, zoom, ortho), overlay projection

## Problems found (finding IDs)
- F-0099 (S4): private pathtracer internals with a caret version range
- F-0047 (Also): snapshot() unused since image export left
- F-0036 (Also): "mep_" materials
- F-0039 (Also): misplaced doc comments (263, 441-444, 1516)
- F-0040, F-0022 (Also): ray and pixel scale without the lift
- F-0098 (Also): the view's own pattern textures are disposed

## To check in other files
- src/render/trace-shader.ts: the shader string patches

## Sources
- https://threejs.org/docs/pages/OrbitControls.html : mouseButtons mapping, zoomToCursor, screenSpacePanning, maxPolarAngle, damping, change event (lines 289-303)
- https://threejs.org/docs/pages/PerspectiveCamera.html : setViewOffset renders a sub-region; updateProjectionMatrix after camera changes (lines 1104-1107, 1146-1147)
- https://github.com/gkjohnson/three-gpu-pathtracer : its README documents the public API only, not `_pathTracer` or its targets (lines 690-772; F-0099)
- https://threejs.org/docs/pages/Texture.html : dispose frees GPU memory (lines 411-430; opened for pattern-texture.ts)
