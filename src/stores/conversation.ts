/**
 * Store conversation — session et reprise après refresh.
 *
 * Contrat V2 :
 * - conversation_id généré côté client au 1er message (accepté par le backend),
 *   puis remplacé par l'ID serveur (metadata.conversation_id) dès la 1re réponse
 * - Persistance localStorage : rechargement de page = même conversation
 * - restore() hydrate depuis GET /conversation/{id} ; 404 → session vierge
 */

import { defineStore } from 'pinia'

import { ConversationNotFoundError, getConversation } from '@/api/railway'
import type { ConversationStatus } from '@/types/api'
import { useConfigStore } from '@/stores/config'
import { useMessagesStore } from '@/stores/messages'

const CONVERSATION_KEY = 'eperf_conversation_id'

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `conv_${crypto.randomUUID()}`
  }
  return `conv_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export interface WidgetIdentity {
  userId: number | string | null
  userData: Record<string, unknown>
}

export const useConversationStore = defineStore('conversation', {
  state: () => ({
    conversationId: localStorage.getItem(CONVERSATION_KEY) as string | null,
    status: 'active' as ConversationStatus,
    isRestoring: false,
    hasRestored: false,
    /** Identification posée via window.ePerformance.identify() (SDK) */
    identity: null as WidgetIdentity | null,
  }),

  getters: {
    hasConversation: (state) => Boolean(state.conversationId),
  },

  actions: {
    /** Retourne l'ID courant, en créant un ID client si nécessaire */
    ensureConversation(): string {
      if (!this.conversationId) {
        this.conversationId = newClientId()
        localStorage.setItem(CONVERSATION_KEY, this.conversationId)
      }
      return this.conversationId
    },

    /** L'ID serveur fait foi dès qu'on le reçoit (metadata.conversation_id) */
    setServerId(id: string | null | undefined) {
      if (id && id !== this.conversationId) {
        this.conversationId = id
        localStorage.setItem(CONVERSATION_KEY, id)
      }
    },

    /** window.ePerformance.identify(userId, userData) — lié à visitor_info à l'envoi */
    identify(userId: number | string | null, userData: Record<string, unknown> = {}) {
      this.identity = { userId, userData }
    },

    /**
     * Reprise après refresh : hydrate les messages depuis le backend.
     * 404 → session vierge silencieuse (nouvelle conversation au prochain message).
     */
    async restore(): Promise<boolean> {
      if (!this.conversationId) {
        this.hasRestored = true
        return false
      }
      this.isRestoring = true
      try {
        const config = useConfigStore()
        const history = await getConversation(this.conversationId, config.config.apiUrl)
        this.status = history.status
        useMessagesStore().hydrateFromHistory(history.messages)
        // Conversation déjà prise en charge par un conseiller: reprendre le mode
        // humain (polling) sans réafficher la bulle d'info
        if (history.status === 'escalated') {
          useMessagesStore().enterHumanMode(false)
        }
        return true
      } catch (err) {
        if (err instanceof ConversationNotFoundError) {
          this.reset()
        }
        return false
      } finally {
        this.isRestoring = false
        this.hasRestored = true
      }
    },

    /** Nouvelle conversation (bouton "recommencer", purge locale) */
    reset() {
      this.conversationId = null
      this.status = 'active'
      this.hasRestored = true
      localStorage.removeItem(CONVERSATION_KEY)
      useMessagesStore().clear()
    },
  },
})
