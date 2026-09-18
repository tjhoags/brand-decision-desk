import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Pages is served from https://<owner>.github.io/brand-decision-desk/, so the
// production bundle is built for that base path. Dev and unit runs use '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/brand-decision-desk/' : '/',
  plugins: [react()],
  build: {
    target: 'es2022',
    // Everything ships from the same origin; no remote chunks, no font CDNs.
    assetsInlineLimit: 0,
    // The bundle has no dynamic imports, so the modulepreload polyfill has
    // nothing to preload - and dropping it keeps the only network primitive in
    // the output out of it entirely, which the privacy check then asserts.
    modulePreload: { polyfill: false },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
}));
