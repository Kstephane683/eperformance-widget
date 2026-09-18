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

import { getConversation, sendMessage } from '@/api/railway'
import { playNotificationSound } from '@/helpers/notificationSound'
import type {
  BackendMessage,
  ChatbotMessageResponse,
  ConversationHistoryMessage,
  MessageAttachment,
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

const HUMAN_POLL_MS = 8_000
let humanPollTimer: ReturnType<typeof setInterval> | null = null
let humanDbCount = 0

export const useMessagesStore = defineStore('messages', {
  state: () => ({
    messages: [] as WidgetMessage[],
    quickReplies: [] as string[],
    isTyping: false,
    isSending: false,
    lastError: null as string | null,
    /** Contenu du dernier message qui a échoué (bouton Réessayer) */
    failedContent: null as string | null,
    /** Un conseiller humain a pris la main (polling des réponses actif) */
    humanMode: false,
  }),

  actions: {
    /**
     * Ajoute un message local.
     * @param extra.humanName  nom réel du conseiller (badge « Conseiller »)
     * @param extra.attachment pièce jointe locale (aperçu uniquement, jamais envoyée)
     */
    addLocal(
      role: WidgetRole,
      content: string,
      html: string | null = null,
      agentUsed: string | null = null,
      extra: { humanName?: string | null; attachment?: MessageAttachment | null } = {},
    ): WidgetMessage {
      const message: WidgetMessage = {
        id: localId(),
        role,
        content,
        html,
        agent_used: agentUsed,
        human_name: extra.humanName ?? null,
        attachment: extra.attachment ?? null,
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

    /**
     * Envoie un message. `attachment` (tâche 6.2-bis) reste LOCAL : le contrat
     * V2 (#5) n'expose aucun endpoint d'upload. Seul le NOM du fichier voyage,
     * ajouté au texte du message — l'aperçu data URL n'est jamais transmis.
     */
    async sendMessage(
      content: string,
      attachment: MessageAttachment | null = null,
    ): Promise<void> {
      const saisie = content.trim()
      const texte = attachment
        ? `${saisie ? `${saisie} — ` : ''}Pièce jointe : ${attachment.name}`
        : saisie
      if (!texte || this.isSending) {
        return
      }
      this.lastError = null

      // 1. Message user local (devient messages[-1] envoyé au backend)
      this.addLocal('user', texte, null, null, { attachment })

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
        this.failedContent = null
        this.applyResponse(response, conversationId)
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : 'Erreur réseau'
        this.failedContent = texte
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
        `<div style="margin-top: 10px;"><a href="${waLink}" target="_blank" rel="noopener" style="color: var(--gold); font-weight: 600;">Continuer sur WhatsApp →</a></div>`
      this.addLocal('agent', message, html, null)
      this.quickReplies = []
    },

    /** Applique une réponse backend normalisée (utilisé aussi par les tests) */
    applyResponse(response: ChatbotMessageResponse, fallbackConversationId: string) {
      const conversation = useConversationStore()
      conversation.setServerId(response.metadata?.conversation_id ?? fallbackConversationId)

      this.isTyping = false

      // Takeover humain: pas de réponse LLM — basculer en mode conseiller
      if (response.metadata?.human_active) {
        this.enterHumanMode()
        return
      }

      const text = response.text ?? ''
      this.addLocal('agent', text, response.html, response.metadata?.agent_used)
      this.quickReplies = response.metadata?.suggestions ?? []
      // Son discret de réception (héritage v6.0)
      playNotificationSound()
    },

    // ============================================================
    // Mode conseiller humain (takeover dashboard)
    // ============================================================

    /** Bascule en mode humain: bulle d'info + polling des réponses (8s) */
    enterHumanMode(showNotice = true) {
      this.quickReplies = []
      if (this.humanMode) return
      this.humanMode = true
      if (showNotice) {
        this.addLocal('agent', 'Votre message a été transmis à un conseiller. Il vous répond ici même.',
        null,
        'Conseiller ePerformance')
      }

      // Nombre de messages déjà connus côté DB pour ne rajouter que les nouveaux
      const conversation = useConversationStore()
      const config = useConfigStore()
      const conversationId = conversation.conversationId
      if (!conversationId) return
      getConversation(conversationId, config.config.apiUrl)
        .then((history) => {
          humanDbCount = history.messages.length
        })
        .catch(() => {
          humanDbCount = this.messages.length
        })

      if (humanPollTimer) clearInterval(humanPollTimer)
      humanPollTimer = setInterval(() => {
        void this.pollHumanReply()
      }, HUMAN_POLL_MS)
    },

    /** Polling: nouveaux messages humains depuis la DB + détection du release */
    async pollHumanReply() {
      const conversation = useConversationStore()
      const config = useConfigStore()
      if (!conversation.conversationId || !this.humanMode) return
      try {
        const history = await getConversation(conversation.conversationId, config.config.apiUrl)

        // Release: l'humain a rendu la main → l'IA reprend
        if (history.status !== 'escalated') {
          this.exitHumanMode()
          this.addLocal('agent', 'Mia reprend la main. Comment puis-je continuer à vous aider ?', null, 'Mia')
          return
        }

        const fresh = history.messages.slice(humanDbCount)
        for (const msg of fresh) {
          if (msg.role === 'assistant' || msg.role === 'user') {
            this.addLocal(
              msg.role === 'user' ? 'user' : 'agent',
              msg.content,
              null,
              // Le nom réel du conseiller alimente le badge « Conseiller »
              // (MessageBubble) — jamais un libellé générique.
              msg.role === 'assistant' ? msg.human_name || 'Conseiller ePerformance' : null,
              { humanName: msg.role === 'assistant' ? (msg.human_name ?? null) : null },
            )
            if (msg.role === 'assistant') playNotificationSound()
          }
          humanDbCount += 1
        }
      } catch {
        // Erreur de poll — silencieuse, on retentera au prochain tick
      }
    },

    /** Fin du mode conseiller (release découvert ou reset) */
    exitHumanMode() {
      this.humanMode = false
      if (humanPollTimer) {
        clearInterval(humanPollTimer)
        humanPollTimer = null
      }
    },

    /** Reprise après refresh — hydrate depuis GET /conversation (roles 'user'|'assistant') */
    hydrateFromHistory(list: ConversationHistoryMessage[]) {
      this.messages = list.map((m) => ({
        id: localId(),
        // role reçu en format DB ('user'|'assistant') → converti dans le type WidgetMessage
        role: m.role === 'assistant' ? ('agent' as WidgetRole) : ('user' as WidgetRole),
        content: m.content,
        agent_used: m.agent_used,
        /** Conseiller humain : le nom réel vient de la DB (Phase 2 — tâche 5.3) */
        human_name: m.human_name ?? null,
        quick_replies: m.suggestions ?? undefined,
        created_at: m.created_at ?? new Date().toISOString(),
      }))
    },

    sendQuickReply(value: string) {
      return this.sendMessage(value)
    },

    /** Réessayer le dernier message échoué : retire le fallback + la bulle
     *  user du message perdu (jamais parvenu au backend), puis renvoie. */
    async retryLast(): Promise<void> {
      const text = this.failedContent
      if (!text || this.isSending) return
      this.failedContent = null
      const last = this.messages.at(-1)
      if (last?.role === 'agent' && last.content.includes('WhatsApp')) {
        this.messages.pop()
      }
      const secondLast = this.messages.at(-1)
      if (secondLast?.role === 'user' && secondLast.content === text) {
        this.messages.pop()
      }
      await this.sendMessage(text)
    },

    clear() {
      this.exitHumanMode()
      this.$reset()
    },
  },
})
