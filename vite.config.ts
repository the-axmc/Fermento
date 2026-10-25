import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

/** Generated contract clients live in the workspace; resolve them to their built output. */
const clients = [
  "batch_registry_contract",
  "batch_shares_contract",
  "condition_oracle_contract",
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
  define: { global: "window" },
  envPrefix: "PUBLIC_",
  server: {
    host: true,
    port: 5173,
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
