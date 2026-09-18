import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Le widget est intégré en iframe sur des sites tiers : le build doit
  // rester autonome (assets relatifs, pas de dépendance au domaine hôte).
  base: './',
  build: {
    target: 'es2019',
    // Objectif bundle < 150 KB (doc maître) — surveiller à chaque sprint
    chunkSizeWarningLimit: 150,
    // Sprint 9 : 2e entrée HTML pour le dashboard admin (GitHub Pages :
    // /eperformance-widget/admin.html), à côté de l'entrée widget.
    // Tâche 6.4 : le portail `/application` et la page de présentation
    // `/application/mia` sont des documents à part entière — leur contenu doit
    // être dans le HTML (indexable, lisible sans JavaScript), et non dans une
    // route du routeur à hash du widget.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
        application: fileURLToPath(new URL('./application/index.html', import.meta.url)),
        applicationMia: fileURLToPath(new URL('./application/mia/index.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
  },
})
