<template>
  <!--
    Prospects — les coordonnées laissées dans les conversations.
    Une ligne = un visiteur qui a laissé au moins un moyen de le rappeler. Les
    actions mènent au téléphone, à WhatsApp ou au fil de la conversation :
    aucune ne passe par un agent nommé, la relation reste avec l'opérateur.
  -->
  <div class="adm-page">
    <div class="adm-outils">
      <div class="adm-recherche adm-prospects__recherche">
        <svg
          class="adm-prospects__loupe"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          v-model.trim="recherche"
          type="search"
          placeholder="Rechercher un nom, un numéro…"
          aria-label="Rechercher un prospect"
        />
      </div>
      <div class="adm-outils__fin">
        <span class="adm-note">{{ filtered.length }} prospect(s)</span>
      </div>
    </div>

    <p v-if="consoleStore.conversationsErreur" class="adm-erreur" role="alert">
      {{ consoleStore.conversationsErreur }}
    </p>

    <p v-if="prospects.length === 0" class="adm-vide__texte">
      Aucun prospect pour l’instant. Les visiteurs qui laissent un nom ou un numéro dans la
      conversation apparaissent ici.
    </p>

    <p v-else-if="filtered.length === 0" class="adm-note">
      Aucun prospect ne correspond à « {{ recherche }} ».
    </p>

    <ul v-else class="adm-liste">
      <li v-for="prospect in filtered" :key="prospect.conversation_id" class="adm-bloc adm-prospect">
        <div class="adm-prospect__tete">
          <span class="adm-prospect__pastille" aria-hidden="true">{{ initialesDe(prospect.nomSource) }}</span>
          <div class="adm-prospect__identite">
            <p class="adm-prospect__nom">{{ prospect.nom }}</p>
            <p class="adm-prospect__origine">
              {{ prospect.site_id }} · {{ tempsRelatifOuTiret(prospect.date) }}
            </p>
          </div>
          <span class="adm-badge" :class="`adm-badge--${prospect.ton}`">{{ prospect.statut }}</span>
        </div>

        <p v-if="prospect.telephone" class="adm-prospect__contact">
          <a :href="`tel:${prospect.telephone}`" class="adm-btn adm-btn--discret">
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
              <path d="M6.5 3.5h3l1.5 4-2 1.4a11 11 0 0 0 5.1 5.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />
            </svg>
            {{ prospect.telephone }}
          </a>
          <a
            :href="`https://wa.me/${prospect.telephone.replace(/[^0-9]/g, '')}`"
            target="_blank"
            rel="noopener"
            class="adm-btn adm-btn--discret"
          >
            Écrire sur WhatsApp
          </a>
        </p>

        <p v-if="prospect.dernierMessage" class="adm-prospect__message">
          « {{ tronquer(prospect.dernierMessage, 160) }} »
        </p>

        <div class="adm-outils">
          <RouterLink
            :to="{ name: 'conversations', query: { q: prospect.nomSource } }"
            class="adm-btn"
          >
            Ouvrir la conversation
          </RouterLink>
        </div>
      </li>
    </ul>

    <p class="adm-note">
      Liste construite à partir des <strong>{{ consoleStore.conversations.length }}</strong>
      conversations les plus récentes chargées par la console.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { initialesDe } from '../identite'
import {
  libelleStatutConversation,
  nomAffichage,
  tempsRelatifOuTiret,
  tonStatutConversation,
  tronquer,
  type TonStatut,
} from '../format'
import { useConsoleStore } from '../stores/console'

const route = useRoute()
const consoleStore = useConsoleStore()

const recherche = ref('')

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string' && q.length > 0) recherche.value = q
  },
  { immediate: true },
)

interface Prospect {
  conversation_id: string
  nom: string
  /** Nom réellement saisi par le visiteur, ou l'identifiant — sert d'initiale */
  nomSource: string
  telephone: string | null
  site_id: string
  date: string | null
  dernierMessage: string | null
  statut: string
  ton: TonStatut
}

const prospects = computed<Prospect[]>(() =>
  consoleStore.prospects
    .map((conv) => {
      const nomSource = nomAffichage(conv.lead_name, conv.conversation_id)
      return {
        conversation_id: conv.conversation_id,
        nom: nomSource,
        nomSource,
        telephone: conv.lead_phone,
        site_id: conv.site_id,
        date: conv.last_message_at ?? conv.created_at,
        dernierMessage: conv.last_message,
        statut: libelleStatutConversation(conv.status, conv.human_active),
        ton: tonStatutConversation(conv.status, conv.human_active),
      }
    })
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
)

const filtered = computed(() => {
  const requete = recherche.value.toLowerCase()
  if (requete === '') return prospects.value
  return prospects.value.filter((prospect) =>
    [prospect.nom, prospect.telephone, prospect.dernierMessage, prospect.site_id].some(
      (champ) => typeof champ === 'string' && champ.toLowerCase().includes(requete),
    ),
  )
})
</script>

<style scoped>
.adm-prospects__recherche {
  flex: 1;
  min-width: 180px;
  max-width: 420px;
}

.adm-prospects__loupe {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.adm-prospect {
  gap: 10px;
}

.adm-prospect__tete {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Pastille d'initiales — recette .quote-avatar du site */
.adm-prospect__pastille {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--gold-border);
  background: var(--gold-bg);
  color: var(--gold);
  font-size: 13px;
  font-weight: 700;
}

.adm-prospect__identite {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.adm-prospect__nom {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text);
}

.adm-prospect__origine {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.adm-prospect__contact {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
}

.adm-prospect__contact .adm-btn svg {
  width: 15px;
  height: 15px;
}

.adm-prospect__message {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--soft);
}
</style>
