<template>
  <!--
    Notifications : la cloche de l'en-tête. Elle ne « notifie » pas d'un
    évènement inventé — chaque entrée vient d'une donnée réelle (conversations
    en attente de conseiller, candidatures à traiter, prospects capturés) et
    mène au module qui permet d'agir.

    Aucune entrée ne nomme un agent : Mia, ou un conseiller, jamais autre chose.
  -->
  <div ref="racine" class="adm-notifications">
    <button
      ref="bouton"
      type="button"
      class="adm-entete__bouton"
      aria-haspopup="true"
      aria-controls="adm-panneau-notifications"
      :aria-expanded="ouvert"
      :aria-label="
        nombre > 0 ? `Notifications — ${nombre} en attente` : 'Notifications — rien en attente'
      "
      @click="basculer"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M18 9a6 6 0 1 0-12 0c0 4.4-1.6 5.6-2 6.4-.2.4 0 1 .5 1h15c.5 0 .7-.6.5-1-.4-.8-2-2-2-6.4z" />
        <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
      </svg>
      <span v-if="nombre > 0" class="adm-compteur" aria-hidden="true">{{ nombre }}</span>
    </button>

    <div
      v-if="ouvert"
      id="adm-panneau-notifications"
      ref="panneau"
      class="adm-panneau"
      role="dialog"
      aria-label="Notifications"
      tabindex="-1"
    >
      <p class="adm-panneau__titre">À traiter</p>

      <ul v-if="notifications.length > 0" class="adm-panneau__liste">
        <li v-for="entree in notifications" :key="entree.id">
          <RouterLink
            :to="{ name: entree.vers.nom, query: entree.vers.query }"
            class="adm-notif"
            @click="fermer"
          >
            <span class="adm-notif__point" :class="`adm-notif__point--${entree.ton}`" aria-hidden="true"></span>
            <span class="adm-notif__corps">
              <span class="adm-notif__titre">{{ entree.titre }}</span>
              <span class="adm-notif__texte">{{ entree.texte }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>

      <p v-else class="adm-panneau__vide">
        Rien en attente. Les nouvelles demandes apparaîtront ici.
      </p>

      <p class="adm-panneau__pied">
        Dernier chargement : {{ consoleStore.fraicheur }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { useConsoleStore } from '../stores/console'
import { usePopover } from '../popover'

const consoleStore = useConsoleStore()

const racine = ref<HTMLElement | null>(null)
const bouton = ref<HTMLButtonElement | null>(null)
const panneau = ref<HTMLElement | null>(null)
const ouvert = ref(false)

const notifications = computed(() => consoleStore.notifications)
const nombre = computed(() => notifications.value.length)

function fermer(): void {
  ouvert.value = false
}

function basculer(): void {
  ouvert.value = !ouvert.value
}

usePopover({ racine, ouvert, declencheur: bouton, cible: panneau, fermer })
</script>

<style scoped>
.adm-notifications {
  position: relative;
}

.adm-panneau {
  position: absolute;
  inset-inline-end: 0;
  top: calc(100% + 8px);
  z-index: 30;
  width: min(360px, 92vw);
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bloc);
  background: var(--card);
  box-shadow: var(--shadow-md);
}

.adm-panneau__titre {
  margin: 0 0 8px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

.adm-panneau__liste {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.adm-notif {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: var(--arrondi-input);
  text-decoration: none;
  color: inherit;
  transition: background-color var(--t-fast) var(--ease-out);
}

.adm-notif:hover {
  background: var(--neutre-trace);
}

/* Le point coloré double le texte : il ne porte jamais l'information seul */
.adm-notif__point {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--muted);
}

.adm-notif__point--alerte {
  background: var(--alerte);
}

.adm-notif__point--info {
  background: var(--info);
}

.adm-notif__point--succes {
  background: var(--succes);
}

.adm-notif__corps {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.adm-notif__titre {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.adm-notif__texte {
  font-size: 12px;
  color: var(--muted);
}

.adm-panneau__vide {
  margin: 0;
  padding: 10px;
  font-size: 13px;
  color: var(--muted);
}

.adm-panneau__pied {
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 11.5px;
  color: var(--muted);
}
</style>
