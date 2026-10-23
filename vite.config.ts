import { defineConfig } from "vite";
import { cipherframe } from "./scripts/vite-plugin-cipherframe.ts";

export default defineConfig({
  plugins: [cipherframe()],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // GSAP core (+ DrawSVG, used by both lazy motion chunks) gets one clearly named shared chunk.
        manualChunks(id: string) {
          if (/node_modules\/gsap\/(index|gsap-core|CSSPlugin|DrawSVGPlugin)\.js$/.test(id)) return "gsap-core";
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
