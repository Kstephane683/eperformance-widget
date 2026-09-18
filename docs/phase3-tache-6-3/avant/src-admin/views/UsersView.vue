<template>
  <section class="users">
    <header class="users__head">
      <h1 class="users__title">Utilisateurs</h1>
      <span v-if="total !== null" class="users__count">{{ total }} compte(s)</span>
      <button type="button" class="users__refresh" @click="load" :disabled="loading">
        ↻ Actualiser
      </button>
    </header>

    <input
      v-model="search"
      type="search"
      class="users__search"
      placeholder="Rechercher par email…"
      aria-label="Rechercher un utilisateur"
    />

    <p v-if="error" class="users__error">{{ error }}</p>
    <p v-else-if="loading && !users.length" class="users__empty">Chargement…</p>
    <p v-else-if="!filtered.length" class="users__empty">Aucun utilisateur.</p>

    <table v-else class="users__table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Nom</th>
          <th>Rôle</th>
          <th>Statut</th>
          <th>Dernière connexion</th>
          <th>Créé le</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in filtered" :key="u.id">
          <td class="users__email">{{ u.email }}</td>
          <td>{{ u.nom ?? '—' }}</td>
          <td>
            <span class="users__role" :class="`users__role--${u.role}`">{{ u.role }}</span>
          </td>
          <td>
            <span :class="u.is_active ? 'users__on' : 'users__off'">
              {{ u.is_active ? '● Actif' : '○ Inactif' }}
            </span>
          </td>
          <td>{{ relative(u.last_login) }}</td>
          <td>{{ shortDate(u.created_at) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { fetchAdminUsers, type AdminUser } from '@/admin/api'

const users = ref<AdminUser[]>([])
const total = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter((u) => u.email.toLowerCase().includes(q))
})

function relative(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await fetchAdminUsers()
    users.value = res.users
    total.value = res.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.users {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.users__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.users__title {
  margin: 0;
  font-family: var(--police-titres);
  font-size: 22px;
  color: var(--gold2);
}

.users__count {
  color: var(--muted);
  font-size: 13px;
}

.users__refresh {
  margin-left: auto;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
}

.users__refresh:hover {
  border-color: var(--gold-border);
}

.users__search {
  max-width: 340px;
  padding: 10px 14px;
  border-radius: var(--arrondi-bouton);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.users__search:focus-visible {
  border-color: var(--gold);
}

.users__error {
  color: var(--red-text);
}

.users__empty {
  color: var(--muted);
}

.users__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.users__table th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.users__table td {
  padding: 10px;
  border-bottom: 1px solid rgba(201, 169, 110, 0.06);
}

.users__email {
  color: var(--gold2);
}

.users__role {
  padding: 2px 10px;
  border-radius: var(--arrondi-bouton);
  font-size: 12px;
  font-weight: 600;
}

.users__role--admin {
  background: rgba(201, 169, 110, 0.15);
  color: var(--gold2);
  border: 1px solid var(--gold-border);
}

.users__role--lead {
  background: rgba(154, 150, 140, 0.12);
  color: var(--muted);
}

.users__on {
  color: var(--green-text);
}

.users__off {
  color: var(--muted);
}
</style>
