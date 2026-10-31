// Vite's own defaults, and a few old option and class names in libraries' sources renamed as they are bundled.

import { defineConfig } from 'vite';

/**
 * The latest three-bvh-csg (0.0.18) and three-gpu-pathtracer (0.0.27) still use names that three-mesh-bvh
 * 0.9 and three 0.186 read under their new names, warning each time: the same option or class under its
 * own name, nothing else changes, and the console stays clean.
 */
const RENAMES: readonly { readonly file: RegExp; readonly from: string; readonly to: string }[] = [
  // A brush's tree, at every boolean cut of an object's pieces.
  { file: /three-bvh-csg[\\/]src[\\/]core[\\/]Brush\.js$/, from: 'maxLeafSize: 3', to: 'targetLeafSize: 3' },
  // The photorealistic view's scene tree.
  { file: /three-gpu-pathtracer[\\/]src[\\/]core[\\/]PathTracingSceneGenerator\.js$/, from: 'maxLeafTris: 1,', to: 'targetLeafSize: 1,' },
  // Its sky's texture (three 0.186 renamed Source to TextureSource).
  { file: /three-gpu-pathtracer[\\/]src[\\/]uniforms[\\/]EquirectHdrInfoUniform\.js$/, from: 'HalfFloatType, Source,', to: 'HalfFloatType, TextureSource as Source,' },
];

const renames = {
  name: 'library-renames',
  transform(code: string, id: string) {
    const hits = RENAMES.filter((r) => r.file.test(id));
    if (hits.length === 0) return null;
    return { code: hits.reduce((c, r) => c.replace(r.from, r.to), code), map: null };
  },
};

export default defineConfig({
  plugins: [renames],
  // In development the libraries are pre-bundled by the dependency optimizer, which runs its own plugins.
  optimizeDeps: { rolldownOptions: { plugins: [renames] } },
});
