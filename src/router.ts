import { createRouter, createWebHashHistory } from 'vue-router'

import Accueil from '@/views/Home.vue'
import Aide from '@/views/Help.vue'
import Actualites from '@/views/News.vue'
import Conversation from '@/views/Conversation.vue'
import Messages from '@/views/Messages.vue'

/**
 * Hash history : le widget tourne dans une iframe sur des sites tiers,
 * pas de contrôle serveur sur les routes — hash évite les 404.
 *
 * Quatre onglets (Accueil, Messages, Aide, Actualités) + l'écran Conversation,
 * qui n'est pas un onglet : on y entre depuis l'accueil, la liste des
 * conversations ou une suggestion, et on en sort par le retour du header.
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: Accueil },
    { path: '/messages', name: 'messages', component: Messages },
    { path: '/conversation', name: 'conversation', component: Conversation },
    { path: '/aide', name: 'aide', component: Aide },
    { path: '/actualites', name: 'actualites', component: Actualites },
    // Toute route inconnue (ancien lien profond, favori) → accueil
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

export default router
