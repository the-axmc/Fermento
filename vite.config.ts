import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer"],
      globals: { Buffer: true },
    }),
    wasm(),
  ],
  resolve: {
    alias: {
      non_fungible_contract: path.resolve(
        __dirname,
        "packages/non_fungible_contract/dist"
      ),
    },
  },
  build: { target: "esnext" },
  optimizeDeps: { exclude: ["@stellar/stellar-xdr-json"] },
  define: { global: "window" },
  envPrefix: "PUBLIC_",
  server: {
    proxy: {
      "/friendbot": {
        target: "http://localhost:8000/friendbot",
        changeOrigin: true,
      },
    },
  },
});
