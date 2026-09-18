<template>
  <!--
    Réglage « Notifications » de l'onglet Aide.

    POURQUOI ICI, ET POURQUOI SI DISCRET
    ------------------------------------
    L'activation des notifications est une action VOLONTAIRE : elle vit dans
    l'onglet Aide, sous un intitulé identifiable, et rien ne la déclenche à la
    place du visiteur. Aucun bandeau, aucune invite, aucune demande de
    permission au chargement — c'est le principe déjà appliqué à l'invite
    d'installation (tâche 6.4), et la même règle vaut ici.

    Quand l'état ne mérite pas d'être montré (`indisponible` : pas d'API push
    dans ce contexte ; `non_configure` : le serveur n'a pas encore de clé
    publique VAPID), le bloc n'est pas rendu du tout. Le visiteur ne voit pas
    une fonctionnalité en panne, il ne voit rien — et Mia fonctionne à
    l'identique.
  -->
  <section v-if="afficher" class="ep-notifs" aria-labelledby="ep-notifs-titre">
    <span id="ep-notifs-titre" class="ep-eyebrow">Notifications</span>

    <div class="ep-notifs__carte">
      <span class="ep-notifs__icone" :class="{ 'ep-notifs__icone--active': abonne }" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10z"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M10.2 18.5a2 2 0 0 0 3.6 0"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
      </span>

      <div class="ep-notifs__corps">
        <p class="ep-notifs__titre">{{ titre }}</p>
        <p class="ep-notifs__texte">{{ texte }}</p>
      </div>

      <button
        v-if="action"
        type="button"
        class="ep-notifs__bouton"
        :class="{ 'ep-notifs__bouton--discret': action === 'desactiver' }"
        :disabled="store.enCours"
        :aria-busy="store.enCours ? 'true' : 'false'"
        data-testid="notifications-action"
        @click="declencher"
      >
        {{ libelleAction }}
      </button>
    </div>

    <p v-if="store.message" class="ep-notifs__message" role="status" data-testid="notifications-message">
      {{ store.message }}
    </p>
  </section>
</template>

<script setup lang="ts">
/**
 * Réglage des notifications push.
 *
 * Toute la décision est ailleurs : `store.affichable` vient de
 * `helpers/push.ts` (`etatAffichable`, `resoudreEtatNotifications`), et le
 * clic n'appelle qu'une action du store. Ce composant est une vue.
 */
import { computed, onMounted } from 'vue'

import { lireEtatNotifications, MESSAGE_ERREUR, MESSAGE_REFUS } from '@/helpers/push'
import { useNotificationsStore } from '@/stores/notifications'

const store = useNotificationsStore()

const afficher = computed(() => store.affichable)
const abonne = computed(() => store.etat === 'abonne')

/** Action proposée, ou null quand il n'y a rien à proposer (refus) */
const action = computed<'activer' | 'desactiver' | null>(() => {
  if (store.etat === 'abonne') return 'desactiver'
  if (store.etat === 'inactif') return 'activer'
  if (store.etat === 'erreur') {
    // Après un échec, on repropose l'action que le visiteur tentait : se
    // désabonner si un abonnement est encore en place, s'abonner sinon.
    return lireEtatNotifications().abonne ? 'desactiver' : 'activer'
  }
  return null
})

const titre = computed(() => {
  if (store.etat === 'abonne') return 'Mia peut vous prévenir'
  if (store.etat === 'refuse') return 'Notifications refusées'
  if (store.etat === 'erreur') return 'Les notifications n’ont pas pu être activées'
  return 'Recevoir les nouvelles de Mia'
})

const texte = computed(() => {
  if (store.etat === 'abonne') {
    return 'Cet appareil reçoit les annonces de Mia. Vous pouvez vous désabonner à tout moment.'
  }
  if (store.etat === 'refuse') return MESSAGE_REFUS
  if (store.etat === 'erreur') return store.message || MESSAGE_ERREUR
  return (
    'Autorisez Mia à vous prévenir sur cet appareil : annonces, nouveautés et ' +
    'réponses à vos demandes. Vous restez libre d’arrêter quand vous voulez.'
  )
})

const libelleAction = computed(() => {
  if (action.value === 'desactiver') return 'Désactiver'
  if (action.value === 'activer') return store.etat === 'erreur' ? 'Réessayer' : 'Activer'
  return ''
})

/**
 * Le clic est la SEULE porte d'entrée de l'activation. C'est ce qui garantit
 * qu'aucune demande de permission n'est émise sans que le visiteur l'ait
 * voulu.
 */
function declencher() {
  if (action.value === 'desactiver') {
    void store.desactiver()
    return
  }
  void store.activer()
}

onMounted(() => {
  // Lecture silencieuse : la configuration du serveur et l'état déjà mémorisé.
  // Aucune demande de permission, aucun effet visible.
  void store.charger().then(() => store.resynchroniser())
})
</script>

<style scoped>
.ep-notifs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Carte de réglage : même recette que .ep-ligne (surface, filet, rayon de
   bloc) — un réglage n'est pas une alerte, il n'a ni ombre ni bordure d'état. */
.ep-notifs__carte {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bloc);
  background: var(--card);
}

.ep-notifs__icone {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--gold-bg);
  border: 1px solid var(--gold-border);
  color: var(--gold);
  transition: background-color var(--t) var(--ease-out);
}

/* Abonné : la pastille passe en plein — l'état se lit aussi à la couleur,
   jamais par la couleur seule (le titre et le bouton le disent). */
.ep-notifs__icone--active {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
}

.ep-notifs__corps {
  flex: 1;
  min-width: 12rem;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ep-notifs__titre {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text);
}

.ep-notifs__texte {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--muted);
}

/* Action principale : recette .btn-gold (fond d'accent, --on-gold) */
.ep-notifs__bouton {
  flex-shrink: 0;
  padding: 8px 14px;
  border: none;
  border-radius: var(--arrondi-bouton);
  background: var(--gold);
  color: var(--on-gold);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  transition: background-color var(--t) var(--ease-out), transform var(--t-fast) var(--ease-out);
}

.ep-notifs__bouton:hover:not(:disabled) {
  background: var(--gold2);
}

.ep-notifs__bouton:active:not(:disabled) {
  transform: translateY(1px);
}

.ep-notifs__bouton:disabled {
  opacity: 0.6;
  cursor: default;
}

/* Désactivation : action secondaire, recette .btn-quiet — le geste destructeur
   ne doit pas être le plus voyant. */
.ep-notifs__bouton--discret {
  background: transparent;
  border: 1px solid var(--border-strong);
  color: var(--soft);
}

.ep-notifs__bouton--discret:hover:not(:disabled) {
  background: var(--gold-bg);
  border-color: var(--gold-border);
  color: var(--gold);
}

.ep-notifs__bouton:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}

/* Message d'état : discret, jamais une alerte rouge pour un choix du visiteur */
.ep-notifs__message {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--soft);
}

@media (max-width: 420px) {
  .ep-notifs__carte {
    align-items: flex-start;
  }

  .ep-notifs__bouton {
    width: 100%;
  }
}
</style>
