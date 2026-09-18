import { defineStore } from 'pinia'

/**
 * Intentions de navigation inter-écrans (Accueil/Aide → Conversation).
 *
 * Trois entrées aboutissent dans la conversation :
 * « Poser une question » (focus sur le champ, aucun message), une suggestion
 * de l'accueil ou une capacité de l'onglet Aide. Le routeur ne transporte pas
 * d'état : ces intentions transitent par un store, consommées une seule fois
 * par la vue Conversation (comme les `flash` d'un routeur classique).
 *
 * Une suggestion transporte DEUX textes (tâche 6.3-BIS A.8) :
 *   · `message` : le libellé affiché dans la bulle du visiteur ;
 *   · `payload` : le texte transmis au backend, préfixé `[intent:…]`.
 * Le backend retire ce préfixe avant tout affichage, enregistrement et appel
 * LLM (voir `ChatbotService.extraire_intent_explicite`).
 */

export interface IntentionSuggestion {
  /** Libellé affiché et conservé dans le fil */
  message: string
  /** Texte réellement envoyé au backend (avec le préfixe d'intent) */
  payload: string
}

export const useIntentStore = defineStore('intent', {
  state: () => ({
    /** Le champ de saisie doit prendre le focus à l'ouverture de la conversation */
    focusComposer: false,
    /** Suggestion cliquée, en attente d'envoi */
    pending: null as IntentionSuggestion | null,
  }),

  actions: {
    demanderFocus() {
      this.focusComposer = true
    },

    /** Lecture destructive : le focus n'est demandé qu'une fois */
    consommerFocus(): boolean {
      const demande = this.focusComposer
      this.focusComposer = false
      return demande
    },

    /**
     * Suggestion cliquée → conversation ouverte + message envoyé à Mia.
     * @param message libellé affiché
     * @param payload texte backend (défaut : le libellé)
     */
    envoyerDansConversation(message: string, payload: string | null = null) {
      this.pending = { message, payload: payload ?? message }
      this.focusComposer = true
    },

    /** Lecture destructive : la suggestion n'est envoyée qu'une fois */
    consommerIntention(): IntentionSuggestion | null {
      const intention = this.pending
      this.pending = null
      return intention
    },
  },
})
