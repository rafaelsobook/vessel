import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { VitePWA } from 'vite-plugin-pwa'
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
    }),
    // THE PWA - installable from the browser ("Add to Home Screen" on an
    // iPhone), opening full screen with the app's own icon, and a service
    // worker that keeps the game's files on the device so later starts load
    // from there. Only in a build (`npm run build`, try it with `npm run
    // preview`): the dev server never registers it, so nothing is cached
    // under you while you work. The iOS-only tags are in index.html; the
    // update prompt is src/main/pwa.js.
    VitePWA({
      // a new version waits until the player says reload (src/main/pwa.js) -
      // never pulled out from under someone mid-fight
      registerType: 'prompt',
      injectRegister: false,
      // the icons are in globPatterns already - not listed twice
      includeManifestIcons: false,
      manifest: {
        name: 'Vessel',
        short_name: 'Vessel',
        description: 'Summoned as a vessel. Rise as a legend.',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        // Android locks to it; iOS ignores it (the player turns the phone)
        orientation: 'landscape',
        background_color: '#14101c',
        theme_color: '#14101c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // downloaded on install: the code, the physics wasm, the page and its
        // icons - ~12 MB. public/ is ~284 MB, far too much to pull down up
        // front on a phone, so everything else is cached as it's first used
        // (runtimeCaching below)
        globPatterns: ['index.html', 'assets/**/*.{js,css,wasm}', 'icons/*.png'],
        // the game's own bundle is ~9 MB, over workbox's 2 MB default
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // models, textures, images and sounds from public/. Their names
            // never change when their contents do (no hash), so: served from
            // the device at once, and fetched again in the background, so an
            // updated file shows up on the next start rather than never
            // Not ranged requests: an <audio> element (the home page's theme,
            // homemusic.js) streams its file in pieces and holds that request
            // open for as long as it plays - answered from here, it kept the
            // old service worker busy and a new version could never take over
            urlPattern: ({ url, request, sameOrigin }) => sameOrigin && !request.headers.has('range') &&
              /\.(glb|gltf|bin|jpe?g|png|webp|gif|svg|ktx2|env|dds|mp3|ogg|wav|m4a|json)$/i.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'vessel-assets',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
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