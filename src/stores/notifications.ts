/**
 * État des notifications push, partagé par le widget (P3-PUSH).
 *
 * Le store ne décide RIEN : la politique est dans `helpers/push.ts` (fonctions
 * pures `supportPush`, `resoudreEtatNotifications`, `etatAffichable`) et le
 * composant ne fait qu'afficher. Ici vivent seulement l'état courant, les trois
 * actions du visiteur, et la lecture de la configuration serveur.
 *
 * DEUX RÈGLES QUE LE STORE FAIT RESPECTER
 * ---------------------------------------
 *   · `charger()` ne demande JAMAIS la permission : il lit la configuration du
 *     serveur et l'état déjà mémorisé. C'est ce qui permet d'afficher le
 *     réglage sans rien déclencher.
 *   · `activer()` est la SEULE action qui peut ouvrir une demande de
 *     permission, et elle n'est appelée que par le clic du visiteur (le
 *     composant ne l'expose que sur un bouton).
 */

import { defineStore } from 'pinia'

import {
  activerNotifications,
  desabonnerNotifications,
  etatAffichable,
  lireEtatNotifications,
  permissionNotifications,
  recupererConfigPush,
  resoudreEtatNotifications,
  resynchroniserAbonnement,
  supportPush,
  type ConfigPush,
  type EtatNotifications,
} from '@/helpers/push'
import { useConfigStore } from '@/stores/config'
import { useConversationStore } from '@/stores/conversation'

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    /** Configuration annoncée par le serveur (null tant qu'elle n'est pas lue) */
    config: null as ConfigPush | null,
    /** État affiché, recalculé après chaque action */
    etat: 'indisponible' as EtatNotifications,
    /** Message destiné au visiteur (vide tant qu'il n'y a rien à dire) */
    message: '',
    /** Une action est en cours : le bouton doit être neutralisé */
    enCours: false,
    /** La configuration a été lue au moins une fois */
    charge: false,
  }),

  getters: {
    /** L'état mérite-t-il d'être montré ? (`indisponible` et `non_configure` non) */
    affichable: (state): boolean => etatAffichable(state.etat),
  },

  actions: {
    /** Recalcule l'état à partir de ce qui est observable maintenant */
    rafraichirEtat() {
      this.etat = resoudreEtatNotifications({
        support: supportPush(),
        config: this.config,
        permission: permissionNotifications(),
        abonne: lireEtatNotifications().abonne,
      })
    },

    /**
     * Lecture silencieuse : configuration serveur, puis état. Aucune demande
     * de permission, aucun effet visible pour le visiteur. En cas d'échec
     * réseau, l'état reste « non configuré » — la fonctionnalité n'est pas
     * proposée, ce qui est le bon comportement par défaut.
     */
    async charger() {
      const config = useConfigStore()
      try {
        this.config = await recupererConfigPush(config.config.apiUrl)
      } catch {
        this.config = null
      }
      this.rafraichirEtat()
      this.charge = true
    },

    /**
     * Remet le serveur au courant d'un abonnement déjà consenti. Appelée au
     * chargement, sans effet si le visiteur n'a jamais activé les
     * notifications.
     */
    async resynchroniser() {
      if (!lireEtatNotifications().abonne) return
      const config = useConfigStore()
      const conversation = useConversationStore()
      await resynchroniserAbonnement({
        apiBase: config.config.apiUrl,
        siteId: config.config.siteId,
        conversationId: conversation.conversationId,
      })
      this.rafraichirEtat()
    },

    /**
     * Activation — le clic du visiteur est la seule porte d'entrée. Le
     * navigateur demande la permission, et l'abonnement n'est enregistré que
     * si elle est accordée.
     */
    async activer() {
      if (this.enCours) return
      this.enCours = true
      const config = useConfigStore()
      const conversation = useConversationStore()
      try {
        const resultat = await activerNotifications({
          apiBase: config.config.apiUrl,
          siteId: config.config.siteId,
          conversationId: conversation.conversationId,
        })
        this.etat = resultat.etat
        this.message = resultat.message
      } finally {
        this.enCours = false
      }
    },

    /** Désabonnement — le serveur d'abord, le navigateur ensuite */
    async desactiver() {
      if (this.enCours) return
      this.enCours = true
      const config = useConfigStore()
      try {
        const resultat = await desabonnerNotifications({ apiBase: config.config.apiUrl })
        this.etat = resultat.etat
        this.message = resultat.message
      } finally {
        this.enCours = false
      }
    },

    /** Après un échec, on remet l'état à ce qu'il est réellement */
    oublierMessage() {
      this.message = ''
    },
  },
})
