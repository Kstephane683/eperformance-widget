/**
 * Point d'entrée du cockpit admin unifié (Sprint 9 + unification).
 *
 * Entrée Vite séparée (admin.html → #admin) : aucune influence sur le
 * bundle widget (#app). Réutilise le design system Chime (style.css).
 * Modules: Chatbot / Utilisateurs / Candidats / Portail CRM LWS.
 */
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'

import App from './App.vue'
import { setUnauthorizedHandler } from './api'
import { useAdminAuthStore } from './stores/auth'
import CandidatsView from './views/CandidatsView.vue'
import CrmPortalView from './views/CrmPortalView.vue'
import DashboardView from './views/DashboardView.vue'
import LoginView from './views/LoginView.vue'
import UsersView from './views/UsersView.vue'

import '../style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Tout 401 remonté par api.ts → logout réactif : le shell (App.vue)
// bascule immédiatement sur l'écran de login.
setUnauthorizedHandler(() => useAdminAuthStore(pinia).logout())

const router = createRouter({
  // createWebHashHistory() sans argument dérive la base de
  // location.pathname : robuste quel que soit le sous-chemin de déploiement.
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/chatbot' },
    { path: '/chatbot', name: 'chatbot', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/users', name: 'users', component: UsersView, meta: { requiresAuth: true } },
    {
      path: '/candidats',
      name: 'candidats',
      component: CandidatsView,
      meta: { requiresAuth: true },
    },
    { path: '/crm', name: 'crm', component: CrmPortalView, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/:pathMatch(.*)*', redirect: '/chatbot' },
  ],
})

router.beforeEach((to) => {
  const auth = useAdminAuthStore(pinia)
  if (to.meta.requiresAuth === true && !auth.isAuthenticated) return { name: 'login' }
  if (to.name === 'login' && auth.isAuthenticated) return { name: 'chatbot' }
  return true
})

app.use(router)
app.mount('#admin')

// Intégration LWS (admin2/chatbot.php) : le shell PHP injecte le JWT
// FastAPI via postMessage — auth partagée sans double login.
// Origine stricte : uniquement le shell admin sur api.eperformance.pro.
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://api.eperformance.pro') return
  try {
    const raw = typeof e.data === 'string' ? e.data : ''
    if (!raw.startsWith('{')) return
    const data = JSON.parse(raw) as { type?: string; token?: unknown }
    if (data.type === 'ep-admin-auth' && typeof data.token === 'string' && data.token.length > 0) {
      // 1. Stocker le token dans localStorage
      localStorage.setItem('eperf_admin_token', data.token)

      // 2. Mettre à jour le store Pinia (au lieu de reload)
      const auth = useAdminAuthStore(pinia)
      auth.token = data.token

      // 3. Naviguer vers /chatbot si nécessaire
      if (router.currentRoute.value.name !== 'chatbot') {
        router.push({ name: 'chatbot' })
      }

      // 4. PAS de window.location.reload() — c'est ce qui causait la boucle infinie
    }
  } catch {
    /* message non JSON — ignoré */
  }
})
