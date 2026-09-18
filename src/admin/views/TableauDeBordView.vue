<template>
  <!--
    Tableau de bord — l'état de la conversation client en un écran.
    Aucune donnée inventée : les chiffres viennent de `/admin/stats` et de la
    liste des conversations déjà chargée par le shell. Ce qui demande une action
    est en haut, ce qui se consulte est en dessous.
  -->
  <div class="adm-page">
    <p class="adm-note">
      Chiffres du dernier chargement ({{ consoleStore.fraicheur }}). Les conversations
      sont relues toutes les 30 secondes, et à chaque retour sur cet onglet.
    </p>

    <p v-if="consoleStore.statsErreur" class="adm-erreur" role="alert">
      {{ consoleStore.statsErreur }}
    </p>

    <section class="adm-grille adm-grille--kpi" aria-label="Chiffres clés">
      <RouterLink
        v-for="indicateur in indicateurs"
        :key="indicateur.cle"
        :to="{ name: indicateur.vers }"
        class="adm-carte adm-carte--lien adm-kpi"
      >
        <span class="adm-eyebrow">{{ indicateur.libelle }}</span>
        <span class="adm-kpi__valeur" :class="{ 'adm-kpi__valeur--or': indicateur.accent }">
          {{ nombre(indicateur.valeur) }}
        </span>
        <span class="adm-kpi__detail">{{ indicateur.detail }}</span>
      </RouterLink>
    </section>

    <div class="adm-filet"><span class="adm-eyebrow">À traiter</span></div>

    <ul v-if="consoleStore.notifications.length > 0" class="adm-liste">
      <li v-for="entree in consoleStore.notifications" :key="entree.id">
        <RouterLink
          :to="{ name: entree.vers.nom, query: entree.vers.query }"
          class="adm-ligne"
        >
          <span class="adm-badge" :class="`adm-badge--${entree.ton}`">{{ entree.ton === 'alerte' ? 'Urgent' : entree.ton === 'info' ? 'À traiter' : 'Nouveau' }}</span>
          <span class="adm-ligne__corps">
            <span class="adm-ligne__titre">{{ entree.titre }}</span>
            <span class="adm-ligne__texte">{{ entree.texte }}</span>
          </span>
          <svg
            class="adm-ligne__chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M9 5.5l6.5 6.5L9 18.5" />
          </svg>
        </RouterLink>
      </li>
    </ul>

    <p v-else class="adm-vide__texte">
      Rien en attente : aucune conversation n'attend de conseiller, aucune candidature n'est à
      traiter.
    </p>

    <div class="adm-filet"><span class="adm-eyebrow">Derniers mouvements</span></div>

    <ul v-if="derniers.length > 0" class="adm-liste">
      <li v-for="conv in derniers" :key="conv.conversation_id">
        <RouterLink
          :to="{ name: 'conversations', query: { q: conv.lead_name ?? conv.conversation_id } }"
          class="adm-ligne"
        >
          <span class="adm-badge" :class="`adm-badge--${tonStatutConversation(conv.status, conv.human_active)}`">
            {{ libelleStatutConversation(conv.status, conv.human_active) }}
          </span>
          <span class="adm-ligne__corps">
            <span class="adm-ligne__titre">
              {{ nomAffichage(conv.lead_name, conv.conversation_id) }}
            </span>
            <span class="adm-ligne__texte">{{ conv.last_message ?? 'Aucun message' }}</span>
          </span>
          <span class="adm-ligne__meta">
            {{ tempsRelatifOuTiret(conv.last_message_at ?? conv.created_at) }}
          </span>
        </RouterLink>
      </li>
    </ul>

    <p v-else class="adm-note">Aucune conversation sur les dernières 50 chargées.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import {
  libelleStatutConversation,
  nomAffichage,
  nombre,
  tempsRelatifOuTiret,
  tonStatutConversation,
} from '../format'
import type { NomModule } from '../navigation'
import { useConsoleStore } from '../stores/console'

const consoleStore = useConsoleStore()

interface Indicateur {
  cle: string
  libelle: string
  valeur: number
  detail: string
  vers: NomModule
  accent?: boolean
}

const indicateurs = computed<Indicateur[]>(() => {
  const statistiques = consoleStore.stats
  const conversations = consoleStore.conversations
  const prospects = consoleStore.prospects.length
  return [
    {
      cle: 'conversations',
      libelle: 'Conversations',
      valeur: statistiques?.conversations ?? conversations.length,
      detail: `${conversations.length} chargée(s) dans la liste`,
      vers: 'conversations',
    },
    {
      cle: 'en-attente',
      libelle: 'En attente d’un conseiller',
      valeur: statistiques?.conversations_en_attente ?? consoleStore.enAttenteHumaine.length,
      detail: 'Demandent une prise en main humaine',
      vers: 'conversations',
      accent: true,
    },
    {
      cle: 'prospects',
      libelle: 'Prospects',
      valeur: statistiques?.leads_chatbot ?? prospects,
      detail: 'Coordonnées laissées dans la conversation',
      vers: 'prospects',
    },
    {
      cle: 'candidatures',
      libelle: 'Candidatures',
      valeur: statistiques?.candidats ?? 0,
      detail: `${nombre(statistiques?.candidats_en_attente ?? 0)} en attente de décision`,
      vers: 'candidatures',
    },
    {
      cle: 'comptes',
      libelle: 'Comptes',
      valeur: statistiques?.users ?? 0,
      detail: 'Accès à la console et au CRM',
      vers: 'utilisateurs',
    },
  ]
})

const derniers = computed(() =>
  [...consoleStore.conversations]
    .sort((a, b) =>
      (b.last_message_at ?? b.created_at ?? '').localeCompare(a.last_message_at ?? a.created_at ?? ''),
    )
    .slice(0, 6),
)
</script>

<style scoped>
.adm-ligne__chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--gold);
}
</style>
