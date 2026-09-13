import { createRouter, createWebHashHistory } from 'vue-router'

import Home from '@/views/Home.vue'
import Messages from '@/views/Messages.vue'

/**
 * Hash history : le widget tourne dans une iframe sur des sites tiers,
 * pas de contrôle serveur sur les routes — hash évite les 404.
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/messages', name: 'messages', component: Messages },
  ],
})

export default router
