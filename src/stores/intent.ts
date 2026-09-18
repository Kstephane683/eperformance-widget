import { defineStore } from 'pinia'

/**
 * Intentions de navigation inter-écrans (Accueil → Conversation).
 *
 * L'onglet Accueil propose deux entrées qui aboutissent dans la conversation :
 * « Poser une question » (focus sur le champ, aucun message) et les
 * suggestions (message pré-rempli envoyé à Mia). Le routeur ne transporte pas
 * d'état : ces intentions transitent par un store, consommées une seule fois
 * par la vue Conversation (comme les `flash` d'un routeur classique).
 */
export const useIntentStore = defineStore('intent', {
  state: () => ({
    /** Le champ de saisie doit prendre le focus à l'ouverture de la conversation */
    focusComposer: false,
    /** Message à envoyer dès l'arrivée dans la conversation (suggestion cliquée) */
    pendingMessage: null as string | null,
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

    envoyerDansConversation(message: string) {
      this.pendingMessage = message
      this.focusComposer = true
    },

    /** Lecture destructive : le message n'est envoyé qu'une fois */
    consommerMessage(): string | null {
      const message = this.pendingMessage
      this.pendingMessage = null
      return message
    },
  },
})
