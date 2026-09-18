import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

import './style.css'
import { capterInviteNavigateur } from '@/helpers/installation'
import { enregistrerServiceWorker } from '@/helpers/pwa'
import { initReseau } from '@/helpers/reseau'
import { initThemeAuto } from '@/helpers/theme'
import { useConfigStore } from '@/stores/config'
import type { WidgetConfig } from '@/types/api'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')

/**
 * Socle applicatif (tâche 6.4) — quatre initialisations, sans effet sur le
 * fonctionnement du widget dans une iframe :
 *
 *   · `capterInviteNavigateur()` est branché au plus tôt : Chromium émet
 *     `beforeinstallprompt` une seule fois par chargement, parfois avant que
 *     l'interface ne soit montée. L'événement est conservé pour être rejoué
 *     depuis le bouton de l'invite d'installation.
 *   · `initReseau()` alimente l'écran d'attente hors-ligne (`online`/`offline`).
 *   · `enregistrerServiceWorker()` ne fait rien dans une iframe ni en
 *     développement (voir helpers/pwa.ts) : coquille hors-ligne et
 *     installation ne concernent que le document de premier niveau.
 *   · `initThemeAuto()` suit la préférence du système hors iframe, tant que le
 *     visiteur n'a pas choisi et que le SDK n'impose pas de thème.
 */
capterInviteNavigateur()
initReseau()
initThemeAuto()
void enregistrerServiceWorker()

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
