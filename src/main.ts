import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

import './style.css'
import { useConfigStore } from '@/stores/config'
import type { WidgetConfig } from '@/types/api'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')

/**
 * Config depuis les query params posés par le SDK (buildFrameSrc).
 * Valeurs par défaut du config store si absentes (dev direct sans SDK).
 */
function configureFromQuery() {
  const params = new URLSearchParams(window.location.search)
  const overrides: Partial<WidgetConfig> = {}
  const apiUrl = params.get('apiUrl')
  const siteId = params.get('siteId')
  const color = params.get('color')
  const theme = params.get('theme')
  const indexUrl = params.get('indexUrl')
  if (apiUrl) overrides.apiUrl = apiUrl
  if (siteId) overrides.siteId = siteId
  if (color) overrides.color = color
  // Racine du blog : l'index des onglets Aide/Actualités y est publié
  if (indexUrl) overrides.blogIndexUrl = indexUrl
  if (theme === 'dark' || theme === 'light') {
    document.documentElement.setAttribute('data-theme', theme)
  }
  if (Object.keys(overrides).length) {
    useConfigStore(pinia).configure(overrides)
  }
}

configureFromQuery()
