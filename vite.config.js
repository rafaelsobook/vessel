import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
    preserveSymlinks: true,
    // preserveSymlinks alone is NOT enough once a file:-linked package has its
    // OWN node_modules/@babylonjs - which infterrain does, because it lists
    // @babylonjs/core as a devDependency as well as a peerDependency, so
    // `npm install` in that repo physically creates the folder.
    //
    // Resolution walks up from client/node_modules/infterrain/dist/, and
    // client/node_modules/infterrain/node_modules/@babylonjs/core really does
    // exist (through the symlink), so it stops there and pulls in a SECOND
    // copy of the whole engine. Measured: switching infterrain from the
    // registry version to a file: link took this bundle from 8.28 MB to
    // 15.02 MB. babyloncamtricks avoids this only because its own local copy
    // was deleted by hand - a fix that any `npm install` in that repo undoes.
    //
    // These aliases pin every @babylonjs/* specifier to THIS project's copy no
    // matter who imports it, which fixes it here rather than depending on the
    // state of another repo's node_modules. Prefix aliases, so subpath imports
    // (@babylonjs/core/Meshes/mesh.js) rewrite correctly too.
    alias: [
      { find: /^@babylonjs\/core/,     replacement: resolve(__dirname, "node_modules/@babylonjs/core") },
      { find: /^@babylonjs\/loaders/,  replacement: resolve(__dirname, "node_modules/@babylonjs/loaders") },
      { find: /^@babylonjs\/gui/,      replacement: resolve(__dirname, "node_modules/@babylonjs/gui") },
      { find: /^@babylonjs\/materials/,replacement: resolve(__dirname, "node_modules/@babylonjs/materials") },
      { find: /^@babylonjs\/havok/,    replacement: resolve(__dirname, "node_modules/@babylonjs/havok") },
    ],
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