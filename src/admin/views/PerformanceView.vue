<template>
  <!--
    Performance — ce qui se mesure dans les données réellement chargées.
    Aucun taux n'est « estimé » : chaque chiffre est un rapport entre deux
    compteurs de la liste des conversations, et la fenêtre d'observation est
    écrite à l'écran (50 dernières conversations). Un taux affiché sans sa
    fenêtre est un taux qui trompe.
  -->
  <div class="adm-page">
    <p class="adm-note">
      Mesuré sur les <strong>{{ total }}</strong> conversations les plus récentes chargées
      par la console, et non sur l'historique complet. Dernier chargement :
      {{ consoleStore.fraicheur }}.
    </p>

    <p v-if="consoleStore.conversationsErreur" class="adm-erreur" role="alert">
      {{ consoleStore.conversationsErreur }}
    </p>

    <section class="adm-bloc" aria-label="Volume des sept derniers jours">
      <p class="adm-eyebrow">Conversations ouvertes — 7 derniers jours</p>
      <div class="adm-graphe">
        <div v-for="jour in semaine" :key="jour.cle" class="adm-graphe__colonne">
          <span class="adm-graphe__valeur">{{ jour.valeur }}</span>
          <div class="adm-graphe__piste">
            <div class="adm-graphe__barre" :style="{ height: `${jour.hauteur}%` }"></div>
          </div>
          <span class="adm-graphe__jour">{{ jour.libelle }}</span>
        </div>
      </div>
      <p class="adm-note">
        {{ ouvertesCetteSemaine }} conversation(s) ouverte(s) sur la période.
      </p>
    </section>

    <div class="adm-grille">
      <section class="adm-bloc" aria-label="Taux de résolution">
        <div class="adm-jauge">
          <span class="adm-jauge__legende">
            <span>Résolues</span>
            <span class="adm-jauge__valeur">{{ pourcentage(resolues, total) }}</span>
          </span>
          <div class="adm-jauge__piste">
            <div class="adm-jauge__part" :style="{ width: `${part(resolues)}%` }"></div>
          </div>
          <span class="adm-note">{{ resolues }} conversation(s) sur {{ total }}</span>
        </div>
      </section>

      <section class="adm-bloc" aria-label="Taux d’escalade">
        <div class="adm-jauge">
          <span class="adm-jauge__legende">
            <span>Escaladées vers un conseiller</span>
            <span class="adm-jauge__valeur">{{ pourcentage(escaladees, total) }}</span>
          </span>
          <div class="adm-jauge__piste">
            <div class="adm-jauge__part adm-jauge__part--alerte" :style="{ width: `${part(escaladees)}%` }"></div>
          </div>
          <span class="adm-note">{{ escaladees }} conversation(s) sur {{ total }}</span>
        </div>
      </section>

      <section class="adm-bloc" aria-label="Capture de prospects">
        <div class="adm-jauge">
          <span class="adm-jauge__legende">
            <span>Coordonnées laissées</span>
            <span class="adm-jauge__valeur">{{ pourcentage(prospects, total) }}</span>
          </span>
          <div class="adm-jauge__piste">
            <div class="adm-jauge__part adm-jauge__part--succes" :style="{ width: `${part(prospects)}%` }"></div>
          </div>
          <span class="adm-note">{{ prospects }} conversation(s) avec coordonnées</span>
        </div>
      </section>
    </div>

    <div class="adm-filet"><span class="adm-eyebrow">Répartition par statut</span></div>

    <div class="adm-tableau-cadre">
      <table class="adm-tableau">
        <caption class="adm-visuellement-cache">
          Répartition des conversations chargées par statut
        </caption>
        <thead>
          <tr>
            <th scope="col">Statut</th>
            <th scope="col">Conversations</th>
            <th scope="col">Part</th>
            <th scope="col">Messages</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ligne in repartition" :key="ligne.statut">
            <td>
              <span class="adm-badge" :class="`adm-badge--${ligne.ton}`">{{ ligne.libelle }}</span>
            </td>
            <td class="adm-tableau__fort">{{ ligne.nombre }}</td>
            <td>{{ pourcentage(ligne.nombre, total) }}</td>
            <td>{{ ligne.messages }}</td>
          </tr>
          <tr>
            <td class="adm-tableau__fort">Total</td>
            <td class="adm-tableau__fort">{{ total }}</td>
            <td>100 %</td>
            <td>{{ messagesTotal }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="adm-note">
      Longueur moyenne d’une conversation : <strong>{{ messagesMoyens }}</strong> message(s) —
      {{ messagesTotal }} messages sur {{ total }} conversation(s).
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { AdminConversationSummary } from '../api'
import {
  libelleStatutConversation,
  pourcentage,
  tonStatutConversation,
  type TonStatut,
} from '../format'
import { useConsoleStore } from '../stores/console'

const consoleStore = useConsoleStore()

const total = computed(() => consoleStore.conversations.length)
const messagesTotal = computed(() =>
  consoleStore.conversations.reduce((somme, conv) => somme + (conv.message_count ?? 0), 0),
)
const messagesMoyens = computed(() =>
  total.value === 0 ? '0' : (messagesTotal.value / total.value).toFixed(1).replace('.', ','),
)

const resolues = computed(
  () => consoleStore.conversations.filter((c) => c.status === 'resolved').length,
)
const escaladees = computed(
  () => consoleStore.conversations.filter((c) => c.status === 'escalated').length,
)
const prospects = computed(
  () => consoleStore.conversations.filter((c) => c.lead_captured).length,
)

/** Part d'un compteur, bornée à 100 % (une barre ne déborde jamais). */
function part(valeur: number): number {
  if (total.value === 0) return 0
  return Math.min(100, Math.round((valeur / total.value) * 100))
}

interface Colonne {
  cle: string
  libelle: string
  valeur: number
  hauteur: number
}

/** Sept derniers jours, du plus ancien au plus récent. */
const semaine = computed<Colonne[]>(() => {
  const jours: Colonne[] = []
  const maintenant = new Date()
  for (let decalage = 6; decalage >= 0; decalage -= 1) {
    const date = new Date(maintenant.getTime() - decalage * 86_400_000)
    const cle = date.toISOString().slice(0, 10)
    const valeur = consoleStore.conversations.filter(
      (conv) => (conv.created_at ?? '').slice(0, 10) === cle,
    ).length
    jours.push({
      cle,
      libelle: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
      valeur,
      hauteur: 0,
    })
  }
  const maximum = Math.max(1, ...jours.map((jour) => jour.valeur))
  return jours.map((jour) => ({ ...jour, hauteur: Math.round((jour.valeur / maximum) * 100) }))
})

const ouvertesCetteSemaine = computed(() =>
  semaine.value.reduce((somme, jour) => somme + jour.valeur, 0),
)

interface LigneRepartition {
  statut: string
  libelle: string
  ton: TonStatut
  nombre: number
  messages: number
}

const repartition = computed<LigneRepartition[]>(() => {
  const statuts = ['active', 'escalated', 'resolved', 'abandoned']
  return statuts.map((statut) => {
    const liste = consoleStore.conversations.filter((conv) => conv.status === statut)
    return {
      statut,
      libelle: libelleStatutConversation(statut, false),
      ton: tonStatutConversation(statut, false),
      nombre: liste.length,
      messages: liste.reduce<number>((somme, conv: AdminConversationSummary) => somme + conv.message_count, 0),
    }
  })
})
</script>

<style scoped>
.adm-graphe {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 168px;
  margin-top: 4px;
}

.adm-graphe__colonne {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.adm-graphe__valeur {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.adm-graphe__piste {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: var(--arrondi-input);
  background: var(--neutre-trace);
  overflow: hidden;
}

/* Barre d'accent : une seule teinte, la hauteur porte la donnée */
.adm-graphe__barre {
  width: 100%;
  min-height: 3px;
  border-radius: var(--arrondi-input) var(--arrondi-input) 0 0;
  background: var(--gold);
  transition: height var(--t-slow) var(--ease-out);
}

.adm-graphe__jour {
  font-size: 11px;
  text-transform: capitalize;
  color: var(--muted);
}

.adm-jauge__part--alerte {
  background: var(--alerte);
}

.adm-jauge__part--succes {
  background: var(--succes);
}
</style>
