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
import {
  clicEnAttenteDeTransmission,
  consommerClicSuggestion,
  signalerLead,
  signalerMessage,
} from '@/helpers/tracking'
import type {
  BackendMessage,
  ChatbotMessageResponse,
  ConversationHistoryMessage,
  ImagePayload,
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

/**
 * Message d'ouverture de Mia — tâche 6.3-BIS A.4.
 *
 * Il est posé à la PREMIÈRE ouverture de la session, avant toute interaction,
 * et n'est pas une réponse : c'est une prise de contact. La clé de session
 * garantit qu'il n'est pas redéclenché à chaque ouverture du widget dans la
 * même session ; une session expirée (conversation inconnue du serveur)
 * remet le compteur à zéro, et Mia se présente de nouveau.
 */
export const MESSAGE_ACCUEIL =
  'Bonjour 👋 Vous parlez maintenant avec Mia. Comment puis-je vous aider ?'
const ACCUEIL_KEY = 'eperf_mia_accueil'

/**
 * Découpe une data URL d'aperçu en payload d'image pour le backend (A.1).
 * `data:image/png;base64,AAAA` → { data: 'AAAA', media_type: 'image/png' }
 */
export function imagePayloadDepuisDataUrl(
  dataUrl: string | null | undefined,
  mediaType: string | null = null,
  name: string | null = null,
): ImagePayload | null {
  if (!dataUrl) return null
  const separateur = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || separateur < 0) return null
  const entete = dataUrl.slice(5, separateur) // ex. « image/png;base64 »
  const data = dataUrl.slice(separateur + 1)
  if (!data) return null
  const declare = entete.split(';')[0] || mediaType || null
  return {
    data,
    media_type: declare,
    // `auto` : le serveur borne la taille, le fournisseur choisit
    // l'échantillonnage. Le champ reste exposé au contrat (low|high|auto).
    detail: 'auto',
    name,
  }
}

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
    /** Le message d'ouverture a déjà été posé dans cette instance (A.4) */
    accueilPose: false,
    /** Une capture de contact a eu lieu dans cette conversation (N3) */
    leadCapture: false,
  }),

  actions: {
    /**
     * Ajoute un message local.
     * @param extra.humanName  nom réel du conseiller (badge « Conseiller »)
     * @param extra.attachment pièce jointe locale (aperçu ; une image part au
     *   backend, les autres fichiers restent locaux)
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

    /**
     * Message d'ouverture de Mia (A.4) — une seule fois par session.
     *
     * @returns true si le message vient d'être posé, false si c'était déjà fait
     */
    accueillirSiNecessaire(): boolean {
      if (this.accueilPose) return false
      try {
        if (sessionStorage.getItem(ACCUEIL_KEY)) {
          this.accueilPose = true
          return false
        }
      } catch {
        // Stockage bloqué : on se rabat sur la garde mémoire ci-dessus
      }
      if (this.messages.length) {
        this.accueilPose = true
        return false
      }
      this.addLocal('agent', MESSAGE_ACCUEIL)
      this.accueilPose = true
      try {
        sessionStorage.setItem(ACCUEIL_KEY, '1')
      } catch {
        /* stockage bloqué : la garde mémoire suffit pour cette instance */
      }
      return true
    },

    /** Historique complet pour le backend — le dernier élément est le message courant */
    toBackendMessages(): BackendMessage[] {
      return this.messages.map((m) => ({
        role: toBackendRole(m.role),
        text: m.content,
      }))
    },

    /**
     * Autorise de nouveau le message d'ouverture (A.4).
     *
     * Appelé quand la session repart de zéro : `clear()` seul laisserait la
     * clé de session en place et Mia ne se présenterait plus, alors que la
     * conversation, elle, est bien neuve.
     */
    reprendreAccueil() {
      this.accueilPose = false
      try {
        sessionStorage.removeItem(ACCUEIL_KEY)
      } catch {
        /* stockage bloqué — la garde mémoire suffit */
      }
    },

    /**
     * Envoie un message.
     *
     * @param content    texte affiché dans la bulle du visiteur
     * @param attachment pièce jointe : une IMAGE est transmise au backend en
     *   base64 (A.1) ; les autres fichiers ne partent que par leur nom.
     * @param intentPayload texte RÉELLEMENT transmis au backend s'il diffère
     *   de `content` — utilisé par les suggestions : la bulle montre le
     *   libellé (« Trouver plus de clients »), le backend reçoit
     *   « [intent:clients] Trouver plus de clients » (A.8). Le préfixe est
     *   retiré côté serveur avant tout affichage, enregistrement et appel LLM.
     */
    async sendMessage(
      content: string,
      attachment: MessageAttachment | null = null,
      intentPayload: string | null = null,
    ): Promise<void> {
      const saisie = content.trim()
      const estImage = Boolean(attachment?.estImage && attachment.dataUrl)
      const texte = attachment && !estImage
        ? `${saisie ? `${saisie} — ` : ''}Pièce jointe : ${attachment.name}`
        : saisie
      if ((!texte && !estImage) || this.isSending) {
        return
      }
      this.lastError = null

      // 1. Message user local (devient messages[-1] envoyé au backend)
      this.addLocal('user', texte, null, null, { attachment })

      const conversation = useConversationStore()
      const conversationId = conversation.ensureConversation()
      const config = useConfigStore()

      // Le clic de suggestion voyage avec CE message, une seule fois (A.8)
      const clic = clicEnAttenteDeTransmission()
      const imagePayload = estImage
        ? imagePayloadDepuisDataUrl(attachment?.dataUrl, attachment?.mediaType ?? null, attachment?.name ?? null)
        : null

      // Payload backend : l'historique affiché auquel on substitue le texte
      // réellement transmis pour le message courant (préfixe d'intent).
      const historique = this.toBackendMessages()
      if (intentPayload && historique.length) {
        historique[historique.length - 1].text = intentPayload
      }

      this.isSending = true
      this.isTyping = true
      try {
        // 2. Appel backend — contrat V2.2 (timeout 30s géré par le client API)
        const response = await sendMessage(
          {
            messages: historique,
            conversationId,
            extraVisitorInfo: {
              ...(conversation.identity?.userData ?? {}),
              ...(clic ? { suggestion_click: clic } : {}),
            },
            image: imagePayload,
          },
          config.config.apiUrl,
          config.config.siteId,
          conversation.identity?.userId ?? null,
        )
        this.failedContent = null
        // Le clic n'est consommé qu'après un appel accepté : en cas d'échec
        // réseau, le « Réessayer » le renvoie avec le message (une seule fois).
        if (clic) consommerClicSuggestion()
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
      // `data-ep-lead` (contrat N3) : le clic sur ce lien est une capture de
      // contact — l'écouteur délégué de ChatMessages émet `eperf:chatbot:lead`
      // avec `whatsapp_clic`. Le type est une énumération, jamais une donnée
      // personnelle (le numéro n'est pas transmis à la page hôte).
      const html =
        `<div style="line-height: 1.6;">${message}</div>` +
        `<div style="margin-top: 10px;"><a href="${waLink}" target="_blank" rel="noopener" data-ep-lead="whatsapp_clic" style="color: var(--gold); font-weight: 600;">Continuer sur WhatsApp →</a></div>`
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

      // Contrat N3 — le site mesure chaque réponse de Mia (catégorie d'intent,
      // jamais le texte). Émis APRÈS l'ajout de la bulle : l'événement décrit
      // un message réellement affiché.
      signalerMessage(response.metadata?.intent)

      // Contrat N3 — capture de contact détectée par le pipeline backend
      // (`actions` contient l'action exécutée : lead_capture, schedule_callback).
      const actions = Array.isArray(response.metadata?.actions) ? response.metadata?.actions : []
      const capture = actions.some((action) => {
        const nom = (action as { action?: string; type?: string })?.action ??
          (action as { type?: string })?.type
        return nom === 'lead_capture' || nom === 'schedule_callback'
      })
      if (capture) {
        this.leadCapture = true
        signalerLead('formulaire')
      }
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
