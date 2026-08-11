import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  base: './',
  // babyloncamtricks is a file: link to a local sibling repo (see
  // package.json) - by default, Node/Vite/esbuild resolve a symlinked
  // package's bare imports (e.g. `@babylonjs/core`) starting from its REAL
  // target directory, not from where the symlink actually sits inside THIS
  // project's node_modules. Since that real directory has no @babylonjs/core
  // of its own (its old local copy was deleted - it only ever needs the one
  // declared as a peerDependency), that walk-up would either fail outright
  // or - worse, if a local copy exists again someday - silently resolve a
  // SECOND, separate copy of the whole engine instead of this project's own
  // (confirmed earlier: two distinct @babylonjs/core roots, ~14MB of pure
  // duplication in the bundle). preserveSymlinks makes resolution walk up
  // from the symlink's own apparent location (client/node_modules/
  // babyloncamtricks) instead, which correctly finds THIS project's
  // node_modules/@babylonjs/core - same fix Node's own --preserve-symlinks
  // flag exists for, applied at the bundler level since that's what
  // actually resolves imports here.
  resolve: {
    preserveSymlinks: true
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm',
          dest: 'assets'
        }
      ]
    })
  ],
  optimizeDeps: {
    exclude: ['@babylonjs/havok', '@babylonjs/core', '@babylonjs/loaders', '@babylonjs/materials']
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
})