<template>
  <!--
    Utilisateurs — les comptes qui accèdent à la console et au CRM.
    Le tableau est le bon objet ici : les colonnes se comparent. Il défile
    horizontalement sur écran étroit plutôt que de casser la page.
  -->
  <div class="adm-page">
    <div class="adm-outils">
      <div class="adm-recherche adm-utilisateurs__recherche">
        <svg
          class="adm-utilisateurs__loupe"
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
          placeholder="Rechercher par nom, email, rôle…"
          aria-label="Rechercher un utilisateur"
        />
      </div>

      <div class="adm-outils__fin">
        <span class="adm-note">
          {{ filtered.length }} affiché(s)<template v-if="total !== null"> · {{ total }} compte(s)</template>
        </span>
        <button type="button" class="adm-btn adm-btn--discret" :disabled="loading" @click="load">
          {{ loading ? 'Chargement…' : 'Actualiser' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="adm-erreur" role="alert">{{ error }}</p>
    <p v-else-if="loading && utilisateurs.length === 0" class="adm-note">Chargement…</p>
    <p v-else-if="utilisateurs.length === 0" class="adm-vide__texte">Aucun compte.</p>
    <p v-else-if="filtered.length === 0" class="adm-note">
      Aucun compte ne correspond à « {{ recherche }} ».
    </p>

    <div v-else class="adm-tableau-cadre">
      <table class="adm-tableau">
        <caption class="adm-visuellement-cache">Comptes de la console et du CRM</caption>
        <thead>
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Nom</th>
            <th scope="col">Rôle</th>
            <th scope="col">Statut</th>
            <th scope="col">Dernière connexion</th>
            <th scope="col">Créé le</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="compte in filtered" :key="compte.id">
            <td class="adm-tableau__fort">{{ compte.email }}</td>
            <td>{{ compte.nom ?? '—' }}</td>
            <td>
              <span class="adm-badge" :class="compte.role === 'admin' ? 'adm-badge--or' : ''">
                {{ compte.role }}
              </span>
            </td>
            <td>
              <span class="adm-badge" :class="compte.is_active ? 'adm-badge--succes' : ''">
                {{ compte.is_active ? 'Actif' : 'Inactif' }}
              </span>
            </td>
            <td>{{ tempsRelatifOuTiret(compte.last_login) }}</td>
            <td>{{ dateCourteOuTiret(compte.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { fetchAdminUsers, type AdminUser } from '@/admin/api'
import { dateCourteOuTiret, tempsRelatifOuTiret } from '../format'

const route = useRoute()

const utilisateurs = ref<AdminUser[]>([])
const total = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const recherche = ref('')

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string' && q.length > 0) recherche.value = q
  },
  { immediate: true },
)

const filtered = computed(() => {
  const requete = recherche.value.toLowerCase()
  if (requete === '') return utilisateurs.value
  return utilisateurs.value.filter((compte) =>
    [compte.email, compte.nom, compte.role].some(
      (champ) => typeof champ === 'string' && champ.toLowerCase().includes(requete),
    ),
  )
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const reponse = await fetchAdminUsers()
    utilisateurs.value = reponse.users
    total.value = reponse.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.adm-utilisateurs__recherche {
  flex: 1;
  min-width: 180px;
  max-width: 420px;
}

.adm-utilisateurs__loupe {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
</style>
