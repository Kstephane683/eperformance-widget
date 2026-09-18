<template>
  <section class="cand">
    <header class="cand__head">
      <h1 class="cand__title">Candidats &amp; Diagnostics</h1>
      <span v-if="total !== null" class="cand__count">{{ total }} candidat(s)</span>
      <button type="button" class="cand__refresh" @click="load" :disabled="loading">
        ↻ Actualiser
      </button>
    </header>

    <div class="cand__filters">
      <select v-model="statut" class="cand__select" aria-label="Filtrer par statut">
        <option value="">Tous les statuts</option>
        <option value="en_attente">En attente</option>
        <option value="accepte">Acceptés</option>
        <option value="refuse">Refusés</option>
        <option value="alumni">Alumni</option>
      </select>
    </div>

    <p v-if="error" class="cand__error">{{ error }}</p>
    <p v-else-if="loading && !candidats.length" class="cand__empty">Chargement…</p>
    <p v-else-if="!candidats.length" class="cand__empty">
      Aucun candidat — les diagnostics du site arrivent ici automatiquement.
    </p>

    <div v-else class="cand__grid">
      <article v-for="c in candidats" :key="c.id" class="cand__card">
        <div class="cand__card-head">
          <strong class="cand__name">{{ c.nom }}</strong>
          <span class="cand__score" :class="scoreClass(c.score)">Score {{ c.score }}</span>
        </div>
        <div class="cand__contact">
          <a v-if="c.email" :href="`mailto:${c.email}`">{{ c.email }}</a>
          <a
            v-if="c.whatsapp"
            :href="`https://wa.me/${c.whatsapp.replace(/[^0-9]/g, '')}`"
            target="_blank"
            rel="noopener"
          >
            {{ c.whatsapp }}
          </a>
          <span v-if="c.entreprise">{{ c.entreprise }}</span>
          <span v-if="c.secteur">{{ c.secteur }}</span>
        </div>
        <div class="cand__foot">
          <span class="cand__statut" :class="`cand__statut--${c.statut}`">
            {{ statutLabel(c.statut) }}
          </span>
          <span class="cand__niveau">{{ niveauLabel(c.niveau_accompagnement) }}</span>
          <span class="cand__date">{{ shortDate(c.created_at) }}</span>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { fetchAdminCandidats, type AdminCandidat } from '@/admin/api'

const candidats = ref<AdminCandidat[]>([])
const total = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const statut = ref('')

function scoreClass(score: number): string {
  if (score >= 70) return 'cand__score--high'
  if (score >= 40) return 'cand__score--mid'
  return 'cand__score--low'
}

function statutLabel(s: string | null): string {
  const map: Record<string, string> = {
    en_attente: 'En attente',
    accepte: 'Accepté',
    refuse: 'Refusé',
    alumni: 'Alumni',
  }
  return s ? (map[s] ?? s) : '—'
}

function niveauLabel(n: string | null): string {
  const map: Record<string, string> = {
    essentielle: 'Essentielle',
    croissance: 'Croissance',
    acceleration: 'Accélération',
  }
  return n ? (map[n] ?? n) : '—'
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
    const res = await fetchAdminCandidats(statut.value || undefined)
    // Tri score desc (les leads les plus chauds en premier)
    candidats.value = [...res.candidats].sort((a, b) => b.score - a.score)
    total.value = res.total
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
.cand {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cand__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cand__title {
  margin: 0;
  font-family: var(--police-titres);
  font-size: 22px;
  color: var(--gold2);
}

.cand__count {
  color: var(--muted);
  font-size: 13px;
}

.cand__refresh {
  margin-left: auto;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
}

.cand__refresh:hover {
  border-color: var(--gold-border);
}

.cand__select {
  max-width: 240px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
}

.cand__error {
  color: var(--red-text);
}

.cand__empty {
  color: var(--muted);
}

.cand__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.cand__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-input);
  background: var(--bg2);
}

.cand__card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.cand__name {
  font-size: 15px;
}

.cand__score {
  padding: 3px 10px;
  border-radius: var(--arrondi-bouton);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.cand__score--high {
  background: rgba(52, 199, 123, 0.15);
  color: var(--green-text);
  border: 1px solid rgba(52, 199, 123, 0.3);
}

.cand__score--mid {
  background: rgba(201, 169, 110, 0.15);
  color: var(--gold2);
  border: 1px solid var(--gold-border);
}

.cand__score--low {
  background: rgba(154, 150, 140, 0.12);
  color: var(--muted);
  border: 1px solid rgba(154, 150, 140, 0.25);
}

.cand__contact {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
  color: var(--muted);
}

.cand__contact a {
  color: var(--gold);
  text-decoration: none;
}

.cand__contact a:hover {
  text-decoration: underline;
}

.cand__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 12px;
}

.cand__statut {
  padding: 2px 10px;
  border-radius: var(--arrondi-bouton);
  font-weight: 600;
}

/* Hors canon assumé (même raison que DashboardView.vue : ni --alerte ni --info
   dans eperf.css — DESIGN-SYSTEM-UNIFIE §2.5, promotion §6.3). */
.cand__statut--en_attente {
  background: rgba(226, 141, 62, 0.15);
  color: #e28d3e;
}

.cand__statut--accepte {
  background: rgba(52, 199, 123, 0.15);
  color: var(--green-text);
}

.cand__statut--refuse {
  background: rgba(154, 150, 140, 0.12);
  color: var(--muted);
}

.cand__statut--alumni {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.cand__niveau {
  color: var(--gold);
  font-weight: 600;
}

.cand__date {
  margin-left: auto;
  color: var(--muted);
}
</style>
