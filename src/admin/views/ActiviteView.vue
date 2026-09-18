<template>
  <!--
    Activité — le fil chronologique des dernières 50 conversations chargées.
    Chaque évènement est DÉDUIT d'une donnée réelle (création, dernier message,
    coordonnées laissées, prise en main) : rien n'est journalisé ici qui ne soit
    déjà dans la conversation. La limite est dite à l'écran — un journal tronqué
    qui ne le dit pas est un journal trompeur.
  -->
  <div class="adm-page">
    <p class="adm-note">
      Journal des <strong>{{ nomConcernees }}</strong> conversations les plus récentes
      (limite de la liste admin), du plus récent au plus ancien. Dernier chargement :
      {{ consoleStore.fraicheur }}.
    </p>

    <p v-if="consoleStore.conversationsErreur" class="adm-erreur" role="alert">
      {{ consoleStore.conversationsErreur }}
    </p>

    <p v-if="groupes.length === 0" class="adm-note">Aucune activité à afficher.</p>

    <section v-for="groupe in groupes" :key="groupe.jour" class="adm-jour" :aria-label="groupe.libelle">
      <div class="adm-filet"><span class="adm-eyebrow">{{ groupe.libelle }}</span></div>

      <ul class="adm-liste">
        <li v-for="evenement in groupe.evenements" :key="evenement.id">
          <RouterLink
            :to="{
              name: 'conversations',
              query: { q: evenement.conversation.lead_name ?? evenement.conversation.conversation_id },
            }"
            class="adm-ligne"
          >
            <span class="adm-evenement__marque" :class="`adm-evenement__marque--${evenement.ton}`" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                focusable="false"
              >
                <path v-for="(trace, index) in evenement.icone" :key="index" :d="trace" />
              </svg>
            </span>
            <span class="adm-ligne__corps">
              <span class="adm-ligne__titre">{{ evenement.titre }}</span>
              <span class="adm-ligne__texte">{{ evenement.texte }}</span>
            </span>
            <span class="adm-ligne__meta">{{ heure(evenement.date) }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { AdminConversationSummary } from '../api'
import { dateJourMois, heure, nomAffichage } from '../format'
import { useConsoleStore } from '../stores/console'

const consoleStore = useConsoleStore()

type Ton = 'info' | 'alerte' | 'succes'

interface Evenement {
  id: string
  date: string
  titre: string
  texte: string
  ton: Ton
  icone: readonly string[]
  conversation: AdminConversationSummary
}

interface GroupeJour {
  jour: string
  libelle: string
  evenements: Evenement[]
}

const ICONES = {
  nouvelle: ['M21 12a8 8 0 0 1-8 8H7l-4 3v-5.6A8 8 0 1 1 21 12z'],
  message: ['M4 12h3.4L10 5.8l3.2 12.4L15.6 12H20'],
  prospect: [
    'M4.5 5h15v14h-15z',
    'M12 11.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
    'M8.6 16.4a3.4 3.4 0 0 1 6.8 0',
  ],
  conseiller: [
    'M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
    'M2.8 20c0-3.3 2.8-5.5 6.2-5.5s6.2 2.2 6.2 5.5',
    'M16.4 5.6a3 3 0 0 1 0 5.8M18 14.8c2.1.6 3.4 2.2 3.4 4.2',
  ],
} as const

/** Évènements déduits d'une conversation — jamais inventés. */
function evenementsDe(conv: AdminConversationSummary): Evenement[] {
  const nom = nomAffichage(conv.lead_name, conv.conversation_id)
  const liste: Evenement[] = []

  if (conv.created_at) {
    liste.push({
      id: `${conv.conversation_id}-creation`,
      date: conv.created_at,
      titre: `Nouvelle conversation — ${nom}`,
      texte: `Ouverte depuis ${conv.site_id}`,
      ton: 'info',
      icone: ICONES.nouvelle,
      conversation: conv,
    })
  }

  if (conv.last_message_at && conv.last_message_at !== conv.created_at) {
    liste.push({
      id: `${conv.conversation_id}-message`,
      date: conv.last_message_at,
      titre: `Dernier message — ${nom}`,
      texte: conv.last_message ?? `${conv.message_count} message(s)`,
      ton: 'info',
      icone: ICONES.message,
      conversation: conv,
    })
  }

  if (conv.lead_captured && conv.last_message_at) {
    liste.push({
      id: `${conv.conversation_id}-prospect`,
      date: conv.last_message_at,
      titre: `Coordonnées laissées — ${nom}`,
      texte: conv.lead_phone ?? conv.lead_name ?? 'Prospect capturé',
      ton: 'succes',
      icone: ICONES.prospect,
      conversation: conv,
    })
  }

  if (conv.human_active && conv.last_message_at) {
    liste.push({
      id: `${conv.conversation_id}-conseiller`,
      date: conv.last_message_at,
      titre: `Prise en main par un conseiller — ${nom}`,
      texte: 'La conversation n’est plus menée par Mia',
      ton: 'alerte',
      icone: ICONES.conseiller,
      conversation: conv,
    })
  }

  return liste
}

const nomConcernees = computed(() => consoleStore.conversations.length)

function jourDe(iso: string): string {
  return iso.slice(0, 10)
}

function libelleJour(jour: string): string {
  const aujourdHui = new Date()
  const hier = new Date(aujourdHui.getTime() - 86_400_000)
  if (jour === aujourdHui.toISOString().slice(0, 10)) return "Aujourd'hui"
  if (jour === hier.toISOString().slice(0, 10)) return 'Hier'
  return dateJourMois(jour)
}

const groupes = computed<GroupeJour[]>(() => {
  const evenements = consoleStore.conversations
    .flatMap(evenementsDe)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60)

  const parJour = new Map<string, Evenement[]>()
  for (const evenement of evenements) {
    const jour = jourDe(evenement.date)
    const liste = parJour.get(jour) ?? []
    liste.push(evenement)
    parJour.set(jour, liste)
  }

  return [...parJour.entries()].map(([jour, liste]) => ({
    jour,
    libelle: libelleJour(jour),
    evenements: liste,
  }))
})
</script>

<style scoped>
.adm-jour {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.adm-evenement__marque {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--arrondi-input);
  border: 1px solid var(--info-filet);
  background: var(--info-trace);
  color: var(--info);
}

.adm-evenement__marque svg {
  width: 17px;
  height: 17px;
}

.adm-evenement__marque--succes {
  border-color: var(--succes-filet);
  background: var(--succes-trace);
  color: var(--succes);
}

.adm-evenement__marque--alerte {
  border-color: var(--alerte-filet);
  background: var(--alerte-trace);
  color: var(--alerte);
}
</style>
