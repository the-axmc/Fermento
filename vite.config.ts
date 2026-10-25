import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

/** Generated contract clients live in the workspace; resolve them to their built output. */
const clients = [
  "batch_registry_contract",
  "batch_shares_contract",
  "condition_oracle_contract",
  "confidential_token_contract",
];

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer"],
      globals: { Buffer: true },
    }),
  ],
  resolve: {
    alias: Object.fromEntries(
      clients.map((name) => [
        name,
        path.resolve(__dirname, `packages/${name}/dist`),
      ]),
    ),
  },
  build: { target: "esnext" },
  // The confidential-token provers (bb.js, Noir acvm) locate their wasm and
  // workers with `new URL(..., import.meta.url)`, which esbuild pre-bundling
  // breaks. Serve them as they ship.
  optimizeDeps: {
    exclude: [
      "@aztec/bb.js",
      "@noir-lang/noir_js",
      "@noir-lang/acvm_js",
      "@noir-lang/noirc_abi",
      "stellar-confidential-token-sdk",
    ],
    esbuildOptions: { target: "esnext" },
  },
  worker: { format: "es" },
  // `globalThis`, not `window`: the provers run in Web Workers too.
  define: { global: "globalThis" },
  envPrefix: "PUBLIC_",
  server: {
    host: true,
    port: 5173,
    // bb.js proves on several threads when SharedArrayBuffer is available,
    // which needs cross-origin isolation. `credentialless` keeps the RPC and
    // font fetches working without those servers sending CORP headers.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
    // Producer API (scripts/producer-api.ts) lists batches with the admin key.
    proxy: { "/api": "http://localhost:8787" },
    // Tunnels used to reach the dev server from a phone (passkeys need HTTPS).
    allowedHosts: [
      ".loca.lt",
      ".trycloudflare.com",
      ".ngrok-free.app",
      ".lhr.life",
      ".serveo.net",
    ],
  },
});
