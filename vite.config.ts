// Vite's own defaults, and one fix to a library's source as it is bundled.

import { defineConfig } from 'vite';

/**
 * three-bvh-csg 0.0.18 (the latest) builds each brush's tree with three-mesh-bvh's old option name,
 * maxLeafSize; three-mesh-bvh 0.9 reads it as targetLeafSize and warns on every boolean cut. The same
 * option under its own name: nothing else changes, and the console stays clean.
 */
const csgLeafSize = {
  name: 'csg-leaf-size',
  transform(code: string, id: string) {
    if (!/three-bvh-csg[\\/]src[\\/]core[\\/]Brush\.js$/.test(id)) return null;
    return { code: code.replace('maxLeafSize: 3', 'targetLeafSize: 3'), map: null };
  },
};

export default defineConfig({
  plugins: [csgLeafSize],
  // In development the library is pre-bundled by the dependency optimizer, which runs its own plugins.
  optimizeDeps: { rolldownOptions: { plugins: [csgLeafSize] } },
});
