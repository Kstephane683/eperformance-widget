<template>
  <!--
    Candidatures — les diagnostics et candidatures reçus du site.
    Les cartes remplacent le tableau : un score, un statut et un moyen de contact
    se lisent mieux en carte, et la grille s'adapte au mobile sans défilement
    horizontal. Le tri place les scores les plus chauds en premier.
  -->
  <div class="adm-page">
    <div class="adm-outils">
      <div class="adm-recherche adm-candidatures__recherche">
        <svg
          class="adm-candidatures__loupe"
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
          placeholder="Rechercher un nom, une entreprise…"
          aria-label="Rechercher une candidature"
        />
      </div>

      <select v-model="statut" class="adm-champ" aria-label="Filtrer par statut">
        <option value="">Tous les statuts</option>
        <option value="en_attente">En attente</option>
        <option value="accepte">Acceptés</option>
        <option value="refuse">Refusés</option>
        <option value="alumni">Alumni</option>
      </select>

      <div class="adm-outils__fin">
        <span class="adm-note">
          {{ filtered.length }} affichée(s)<template v-if="total !== null"> · {{ total }} au total</template>
        </span>
        <button type="button" class="adm-btn adm-btn--discret" :disabled="loading" @click="load">
          {{ loading ? 'Chargement…' : 'Actualiser' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="adm-erreur" role="alert">{{ error }}</p>
    <p v-else-if="loading && candidats.length === 0" class="adm-note">Chargement…</p>
    <p v-else-if="candidats.length === 0" class="adm-vide__texte">
      Aucune candidature pour l’instant — les diagnostics envoyés depuis le site arrivent ici
      automatiquement.
    </p>
    <p v-else-if="filtered.length === 0" class="adm-note">
      Aucune candidature ne correspond à ce filtre.
    </p>

    <ul v-else class="adm-grille">
      <li v-for="candidature in filtered" :key="candidature.id" class="adm-carte">
        <div class="adm-candidature__tete">
          <p class="adm-candidature__nom">{{ candidature.nom }}</p>
          <span class="adm-badge" :class="`adm-badge--${tonScore(candidature.score)}`">
            Score {{ candidature.score }}
          </span>
        </div>

        <ul class="adm-candidature__contact">
          <li v-if="candidature.email">
            <a :href="`mailto:${candidature.email}`">{{ candidature.email }}</a>
          </li>
          <li v-if="candidature.whatsapp">
            <a
              :href="`https://wa.me/${candidature.whatsapp.replace(/[^0-9]/g, '')}`"
              target="_blank"
              rel="noopener"
            >
              {{ candidature.whatsapp }}
            </a>
          </li>
          <li v-if="candidature.entreprise">{{ candidature.entreprise }}</li>
          <li v-if="candidature.secteur">{{ candidature.secteur }}</li>
        </ul>

        <div class="adm-candidature__pied">
          <span class="adm-badge" :class="`adm-badge--${tonStatutCandidature(candidature.statut)}`">
            {{ libelleStatutCandidature(candidature.statut) }}
          </span>
          <span class="adm-candidature__niveau">
            {{ libelleNiveau(candidature.niveau_accompagnement) }}
          </span>
          <span class="adm-ligne__meta">{{ dateCourteOuTiret(candidature.created_at) }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { fetchAdminCandidats, type AdminCandidat } from '@/admin/api'
import {
  dateCourteOuTiret,
  libelleNiveau,
  libelleStatutCandidature,
  tonScore,
  tonStatutCandidature,
} from '../format'

const route = useRoute()

const candidats = ref<AdminCandidat[]>([])
const total = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const statut = ref('')
const recherche = ref('')

/** Filtres reçus par l'URL (recherche globale, notifications). */
watch(
  () => route.query,
  (query) => {
    const q = query.q
    if (typeof q === 'string' && q.length > 0) recherche.value = q
    const filtre = query.statut
    if (typeof filtre === 'string' && filtre.length > 0) statut.value = filtre
  },
  { immediate: true },
)

const filtered = computed(() => {
  const requete = recherche.value.toLowerCase()
  if (requete === '') return candidats.value
  return candidats.value.filter((candidature) =>
    [candidature.nom, candidature.email, candidature.entreprise, candidature.secteur].some(
      (champ) => typeof champ === 'string' && champ.toLowerCase().includes(requete),
    ),
  )
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const reponse = await fetchAdminCandidats(statut.value || undefined)
    // Tri par score décroissant : les dossiers les plus chauds d'abord
    candidats.value = [...reponse.candidats].sort((a, b) => b.score - a.score)
    total.value = reponse.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
  } finally {
    loading.value = false
  }
}

watch(statut, load)
onMounted(load)
</script>

<style scoped>
.adm-candidatures__recherche {
  flex: 1;
  min-width: 180px;
  max-width: 420px;
}

.adm-candidatures__loupe {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.adm-candidature__tete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.adm-candidature__nom {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.adm-candidature__contact {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12.5px;
  color: var(--muted);
}

.adm-candidature__pied {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.adm-candidature__niveau {
  font-size: 12px;
  font-weight: 600;
  color: var(--gold);
}
</style>
