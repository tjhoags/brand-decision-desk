import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Pages serves this from <owner>.github.io/brand-decision-desk/, so the base
 * path is the same for every command. Applying it only on build left `vite
 * preview` serving the SPA fallback in place of the bundle, which looked like
 * a working page and was not one.
 */
const BASE = '/brand-decision-desk/';

export default defineConfig({
  base: BASE,
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
  // Match the test runner's IPv4 loopback URL on hosts where localhost is ::1.
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
