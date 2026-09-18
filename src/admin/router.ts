/**
 * Routeur de la console — construit À PARTIR du registre des modules.
 *
 * Le routeur vit dans son propre fichier pour être testable sans monter
 * l'application ni toucher au réseau : les tests de navigation instancient
 * `creerRouteur()` et parcourent les onze modules.
 *
 * Trois garanties :
 *   · un module du registre a TOUJOURS sa route (la table `VUES` est exhaustive,
 *     le typage refuse un module sans vue) ;
 *   · les chemins des versions précédentes redirigent — un favori ne casse pas ;
 *   · toute route inconnue retombe sur le module par défaut.
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import type { Router } from 'vue-router'
import type { Component } from 'vue'

import { MODULE_PAR_DEFAUT, MODULES, type NomModule } from './navigation'
import ActiviteView from './views/ActiviteView.vue'
import CandidaturesView from './views/CandidaturesView.vue'
import CompetencesView from './views/CompetencesView.vue'
import ConnaissancesView from './views/ConnaissancesView.vue'
import ConversationsView from './views/ConversationsView.vue'
import IntegrationsView from './views/IntegrationsView.vue'
import LoginView from './views/LoginView.vue'
import PerformanceView from './views/PerformanceView.vue'
import ProspectsView from './views/ProspectsView.vue'
import PublicationsView from './views/PublicationsView.vue'
import TableauDeBordView from './views/TableauDeBordView.vue'
import UtilisateursView from './views/UtilisateursView.vue'

/** Une vue par module — la table est exhaustive : un module sans vue ne compile pas. */
export const VUES: Record<NomModule, Component> = {
  'tableau-de-bord': TableauDeBordView,
  activite: ActiviteView,
  performance: PerformanceView,
  conversations: ConversationsView,
  prospects: ProspectsView,
  candidatures: CandidaturesView,
  connaissances: ConnaissancesView,
  publications: PublicationsView,
  competences: CompetencesView,
  utilisateurs: UtilisateursView,
  integrations: IntegrationsView,
}

/** Redirections des chemins de la version précédente (favoris, liens externes). */
export const REDIRECTIONS_ANCIENS_CHEMINS: ReadonlyArray<{ path: string; nom: NomModule }> = [
  { path: '/chatbot', nom: 'conversations' },
  { path: '/users', nom: 'utilisateurs' },
  { path: '/candidats', nom: 'candidatures' },
  { path: '/crm', nom: 'integrations' },
]

export function creerRouteur(): Router {
  return createRouter({
    // createWebHashHistory() sans argument dérive la base de location.pathname :
    // robuste quel que soit le sous-chemin de déploiement (GitHub Pages).
    history: createWebHashHistory(),
    routes: [
      { path: '/', redirect: { name: MODULE_PAR_DEFAUT } },
      ...MODULES.map((module) => ({
        path: module.chemin,
        name: module.nom,
        component: VUES[module.nom],
        meta: { requiresAuth: true },
      })),
      { path: '/login', name: 'login', component: LoginView },
      ...REDIRECTIONS_ANCIENS_CHEMINS.map((redirection) => ({
        path: redirection.path,
        redirect: { name: redirection.nom },
      })),
      // Toute route inconnue (lien profond périmé) → module par défaut
      { path: '/:pathMatch(.*)*', redirect: { name: MODULE_PAR_DEFAUT } },
    ],
  })
}
