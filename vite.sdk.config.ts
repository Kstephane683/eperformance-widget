import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'

/**
 * Build du SDK d'injection — IIFE autonome (dist/eperformance-sdk.js),
 * séparé du bundle widget. Ne vide PAS dist/ (le widget y est déjà).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2019',
    lib: {
      entry: fileURLToPath(new URL('./src/sdk/entry.ts', import.meta.url)),
      formats: ['iife'],
      name: 'ePerformanceSDK',
      fileName: () => 'eperformance-sdk.js',
    },
  },
})
