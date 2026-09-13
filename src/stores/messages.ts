/**
 * Store messages — état de la conversation affichée.
 *
 * Contrat V2 :
 * - Envoi : TOUT l'historique (messages[-1] = message courant, role 'user')
 * - Réception : suggestions JSON → quick_replies natifs (jamais parser le HTML)
 * - Le HTML backend est stocké brut ici ; la sanitization DOMPurify se fait
 *   au rendu (composant) — Sprint 4
 */

import { defineStore } from 'pinia'

import { sendMessage } from '@/api/railway'
import { playNotificationSound } from '@/helpers/notificationSound'
import type {
  BackendMessage,
  ChatbotMessageResponse,
  ConversationHistoryMessage,
  WidgetMessage,
  WidgetRole,
} from '@/types/api'
import { toBackendRole } from '@/types/api'
import { useConfigStore } from '@/stores/config'
import { useConversationStore } from '@/stores/conversation'

let messageCounter = 0
function localId(): string {
  messageCounter += 1
  return `msg_${Date.now().toString(36)}_${messageCounter}`
}

export const useMessagesStore = defineStore('messages', {
  state: () => ({
    messages: [] as WidgetMessage[],
    quickReplies: [] as string[],
    isTyping: false,
    isSending: false,
    lastError: null as string | null,
  }),

  actions: {
    addLocal(
      role: WidgetRole,
      content: string,
      html: string | null = null,
      agentUsed: string | null = null,
    ): WidgetMessage {
      const message: WidgetMessage = {
        id: localId(),
        role,
        content,
        html,
        agent_used: agentUsed,
        created_at: new Date().toISOString(),
      }
      this.messages.push(message)
      return message
    },

    /** Historique complet pour le backend — le dernier élément est le message courant */
    toBackendMessages(): BackendMessage[] {
      return this.messages.map((m) => ({
        role: toBackendRole(m.role),
        text: m.content,
      }))
    },

    async sendMessage(content: string): Promise<void> {
      const trimmed = content.trim()
      if (!trimmed || this.isSending) {
        return
      }
      this.lastError = null

      // 1. Message user local (devient messages[-1] envoyé au backend)
      this.addLocal('user', trimmed)

      const conversation = useConversationStore()
      const conversationId = conversation.ensureConversation()
      const config = useConfigStore()

      this.isSending = true
      this.isTyping = true
      try {
        // 2. Appel backend — contrat V2 (timeout 30s géré par le client API)
        const response = await sendMessage(
          {
            messages: this.toBackendMessages(),
            conversationId,
            extraVisitorInfo: conversation.identity?.userData,
          },
          config.config.apiUrl,
          config.config.siteId,
          conversation.identity?.userId ?? null,
        )
        this.applyResponse(response, conversationId)
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : 'Erreur réseau'
        // NB: DOMException (AbortError) n'hérite pas Error en Node — vérifier name
        const isTimeout = (err as { name?: string })?.name === 'AbortError'
        // Fallback WhatsApp : jamais laisser le visiteur sans issue (héritage v6.0)
        this.addWhatsAppFallback(isTimeout)
        throw err
      } finally {
        this.isTyping = false
        this.isSending = false
      }
    },

    /** Message de secours + redirection WhatsApp si l'IA est indisponible */
    addWhatsAppFallback(isTimeout: boolean) {
      const config = useConfigStore()
      const message = isTimeout
        ? 'Le délai de réponse est dépassé. Pour ne pas vous faire attendre, contactez-nous directement sur WhatsApp — nous vous répondons rapidement.'
        : 'Notre assistante IA est momentanément indisponible. Pour ne pas vous faire attendre, contactez-nous directement sur WhatsApp — nous vous répondons rapidement.'
      const waLink = `https://wa.me/${config.config.whatsappNumber.replace(/[^0-9]/g, '')}`
      const html =
        `<div style="line-height: 1.6;">${message}</div>` +
        `<div style="margin-top: 10px;"><a href="${waLink}" target="_blank" rel="noopener" style="color: #c9a96e; font-weight: 600;">Continuer sur WhatsApp →</a></div>`
      this.addLocal('agent', message, html, null)
      this.quickReplies = []
    },

    /** Applique une réponse backend normalisée (utilisé aussi par les tests) */
    applyResponse(response: ChatbotMessageResponse, fallbackConversationId: string) {
      const conversation = useConversationStore()
      conversation.setServerId(response.metadata?.conversation_id ?? fallbackConversationId)

      this.isTyping = false
      const text = response.text ?? ''
      this.addLocal('agent', text, response.html, response.metadata?.agent_used)
      this.quickReplies = response.metadata?.suggestions ?? []
      // Son discret de réception (héritage v6.0)
      playNotificationSound()
    },

    /** Reprise après refresh — hydrate depuis GET /conversation (roles 'user'|'assistant') */
    hydrateFromHistory(list: ConversationHistoryMessage[]) {
      this.messages = list.map((m) => ({
        id: localId(),
        // role reçu en format DB ('user'|'assistant') → converti dans le type WidgetMessage
        role: m.role === 'assistant' ? ('agent' as WidgetRole) : ('user' as WidgetRole),
        content: m.content,
        agent_used: m.agent_used,
        quick_replies: m.suggestions ?? undefined,
        created_at: m.created_at ?? new Date().toISOString(),
      }))
    },

    sendQuickReply(value: string) {
      return this.sendMessage(value)
    },

    clear() {
      this.$reset()
    },
  },
})
