/**
 * Point d'entrée du dashboard admin chatbot (Sprint 9).
 *
 * Entrée Vite séparée (admin.html → #admin) : aucune influence sur le
 * bundle widget (#app). Réutilise le design system Chime (style.css).
 */
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'

import App from './App.vue'
import { setUnauthorizedHandler } from './api'
import { useAdminAuthStore } from './stores/auth'
import DashboardView from './views/DashboardView.vue'
import LoginView from './views/LoginView.vue'

import '../style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Tout 401 remonté par api.ts → logout réactif : le shell (App.vue)
// bascule immédiatement sur l'écran de login.
setUnauthorizedHandler(() => useAdminAuthStore(pinia).logout())

const router = createRouter({
  // Hash history : GitHub Pages ne réécrit pas les URLs (sous-chemin
  // /eperformance-widget/) — le hash évite les 404 au refresh,
  // createWebHashHistory() sans argument dérive la base de
  // location.pathname : robuste quel que soit le sous-chemin de déploiement.
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAdminAuthStore(pinia)
  if (to.meta.requiresAuth === true && !auth.isAuthenticated) return { name: 'login' }
  if (to.name === 'login' && auth.isAuthenticated) return { name: 'dashboard' }
  return true
})

app.use(router)
app.mount('#admin')
