/**
 * Store de la console — ce que plusieurs modules regardent en même temps.
 *
 * Trois besoins, un seul chargement :
 *   · les pastilles de la barre latérale (conversations et candidatures en attente) ;
 *   · le panneau de notifications de l'en-tête ;
 *   · la recherche globale, qui cherche dans les conversations déjà chargées.
 * Sans ce store, l'en-tête, la barre latérale et la boîte de réception
 * interrogeraient la même API trois fois pour la même donnée.
 *
 * Il ne remplace PAS les vues : la boîte de réception garde la main sur le
 * détail d'une conversation et sur ses actions (prise en main, réponse). Ici on
 * ne garde que la LISTE et les statistiques, avec leur horodatage de fraîcheur.
 *
 * Aucun nom d'agent n'est lu ni exposé : les seuls champs exploités sont le
 * statut, la prise en main humaine, le prospect et le compteur de messages.
 */

import { defineStore } from 'pinia'

import { fetchAdminStats, fetchConversations } from '../api'
import type { AdminConversationSummary, AdminStats } from '../api'
import { tempsRelatif } from '@/helpers/relativeTime'

/** Nombre de conversations chargées par défaut (contrat de la liste admin). */
export const LIMITE_CONVERSATIONS = 50

export interface Notification {
  id: string
  ton: 'alerte' | 'info' | 'succes'
  titre: string
  texte: string
  /** Destination du clic : nom de module + requête de filtre éventuelle */
  vers: { nom: string; query?: Record<string, string> }
}

function messageErreur(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  return 'Chargement impossible.'
}

export const useConsoleStore = defineStore('consoleAdmin', {
  state: () => ({
    stats: null as AdminStats | null,
    statsErreur: null as string | null,
    statsEnCours: false,
    conversations: [] as AdminConversationSummary[],
    conversationsTotal: 0,
    conversationsErreur: null as string | null,
    conversationsEnCours: false,
    /** Horodatage (ms) du dernier chargement réussi, toutes sources confondues */
    rafraichiLe: null as number | null,
  }),

  getters: {
    /** Conversations escaladées qu'aucun conseiller n'a encore prises. */
    enAttenteHumaine: (state): AdminConversationSummary[] =>
      state.conversations.filter((c) => c.status === 'escalated' && !c.human_active),

    /** Conversations portant des coordonnées exploitables (prospect capturé). */
    prospects: (state): AdminConversationSummary[] =>
      state.conversations.filter(
        (c) => c.lead_captured || c.lead_name !== null || c.lead_phone !== null,
      ),

    /** « il y a 2 minutes » — fraîcheur du dernier chargement réussi. */
    fraicheur(): string {
      if (this.rafraichiLe === null) return 'jamais'
      return tempsRelatif(new Date(this.rafraichiLe).toISOString()) || "à l'instant"
    },

    /**
     * Ce qui mérite l'attention de l'opérateur, du plus urgent au plus doux.
     * Chaque entrée mène au module qui permet d'agir — jamais à un agent nommé.
     */
    notifications(): Notification[] {
      const liste: Notification[] = []
      const enAttente = this.enAttenteHumaine
      if (enAttente.length > 0) {
        liste.push({
          id: 'conversations-en-attente',
          ton: 'alerte',
          titre:
            enAttente.length === 1
              ? '1 conversation attend un conseiller'
              : `${enAttente.length} conversations attendent un conseiller`,
          texte: 'Prenez la main pour répondre vous-même.',
          vers: { nom: 'conversations', query: { statut: 'escalated' } },
        })
      }
      const candidatsEnAttente = this.stats?.candidats_en_attente ?? 0
      if (candidatsEnAttente > 0) {
        liste.push({
          id: 'candidatures-en-attente',
          ton: 'info',
          titre:
            candidatsEnAttente === 1
              ? '1 candidature à traiter'
              : `${candidatsEnAttente} candidatures à traiter`,
          texte: 'Les diagnostics reçus du site attendent une décision.',
          vers: { nom: 'candidatures', query: { statut: 'en_attente' } },
        })
      }
      const nouveauxProspects = this.prospects.filter((c) => c.lead_captured).length
      if (nouveauxProspects > 0) {
        liste.push({
          id: 'prospects',
          ton: 'succes',
          titre:
            nouveauxProspects === 1
              ? '1 prospect a laissé ses coordonnées'
              : `${nouveauxProspects} prospects ont laissé leurs coordonnées`,
          texte: 'À recontacter depuis le module Prospects.',
          vers: { nom: 'prospects' },
        })
      }
      return liste
    },

    /** Nombre de notifications — la pastille de la cloche. */
    nombreNotifications(): number {
      return this.notifications.length
    },
  },

  actions: {
    /** GET /admin/stats — silencieux en cas d'erreur réseau (badges figés). */
    async chargerStats(): Promise<void> {
      this.statsEnCours = true
      try {
        this.stats = await fetchAdminStats()
        this.statsErreur = null
        this.rafraichiLe = Date.now()
      } catch (e) {
        this.statsErreur = messageErreur(e)
      } finally {
        this.statsEnCours = false
      }
    },

    /** GET /admin/conversations — la liste partagée. */
    async chargerConversations(): Promise<void> {
      this.conversationsEnCours = true
      try {
        const reponse = await fetchConversations(LIMITE_CONVERSATIONS)
        this.conversations = reponse.conversations ?? []
        this.conversationsTotal = reponse.total ?? this.conversations.length
        this.conversationsErreur = null
        this.rafraichiLe = Date.now()
      } catch (e) {
        this.conversationsErreur = messageErreur(e)
      } finally {
        this.conversationsEnCours = false
      }
    },

    /** Remplace la liste sans requête (la vue détail renvoie ce qu'elle vient de lire). */
    definirConversations(liste: AdminConversationSummary[], total?: number): void {
      this.conversations = liste
      if (typeof total === 'number') this.conversationsTotal = total
      this.rafraichiLe = Date.now()
    },

    /** Efface tout (déconnexion) : aucune donnée client ne survit à la session. */
    reinitialiser(): void {
      this.stats = null
      this.statsErreur = null
      this.conversations = []
      this.conversationsTotal = 0
      this.conversationsErreur = null
      this.rafraichiLe = null
    },
  },
})
