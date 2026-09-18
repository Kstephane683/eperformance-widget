/**
 * Point d'entrée de la console d'administration (admin.html → #admin).
 *
 * Entrée Vite séparée : aucune influence sur le bundle du widget (#app), ni sur
 * celui des pages publiques `application/`. Les trois entrées partagent en
 * revanche les MÊMES jetons (`src/styles/jetons.css`) et la même feuille de
 * socle (`src/style.css`).
 *
 * Le routeur est construit dans `router.ts`, à partir du registre
 * `navigation.ts` : une route ne peut pas exister sans entrée de barre latérale,
 * ni l'inverse.
 */
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { setUnauthorizedHandler } from './api'
import { MODULE_PAR_DEFAUT } from './navigation'
import { creerRouteur } from './router'
import { appliquerChoix, lireChoix } from './theme'
import { useAdminAuthStore } from './stores/auth'

import '../style.css'
import './admin.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Tout 401 remonté par api.ts → déconnexion réactive : le shell (App.vue)
// bascule immédiatement sur l'écran de connexion.
setUnauthorizedHandler(() => useAdminAuthStore(pinia).logout())

const router = creerRouteur()

router.beforeEach((to) => {
  const auth = useAdminAuthStore(pinia)
  if (to.meta.requiresAuth === true && !auth.isAuthenticated) return { name: 'login' }
  if (to.name === 'login' && auth.isAuthenticated) return { name: MODULE_PAR_DEFAUT }
  return true
})

app.use(router)
app.mount('#admin')

// Thème : le script en ligne de admin.html a déjà posé `data-theme` avant le
// premier rendu (aucun flash). Ici on aligne la couleur de barre du navigateur
// sur le jeton `--bg` du thème retenu — aucune couleur en dur, donc.
appliquerChoix(lireChoix(), false)

// Intégration LWS (admin2/chatbot.php) : le shell PHP injecte le JWT FastAPI
// via postMessage — authentification partagée, sans double connexion.
// Origine stricte : uniquement le shell admin sur api.eperformance.pro.
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://api.eperformance.pro') return
  try {
    const raw = typeof e.data === 'string' ? e.data : ''
    if (!raw.startsWith('{')) return
    const data = JSON.parse(raw) as { type?: string; token?: unknown }
    if (
      data.type === 'ep-admin-auth' &&
      typeof data.token === 'string' &&
      data.token.length > 0
    ) {
      // 1. Mémoriser le jeton (même clé que le store d'authentification)
      localStorage.setItem('eperf_admin_token', data.token)

      // 2. Mettre à jour le store Pinia (pas de rechargement de page)
      const auth = useAdminAuthStore(pinia)
      auth.token = data.token

      // 3. Rejoindre le module par défaut si nécessaire
      if (router.currentRoute.value.name !== MODULE_PAR_DEFAUT) {
        void router.push({ name: MODULE_PAR_DEFAUT })
      }
    }
  } catch {
    /* message non JSON — ignoré */
  }
})
