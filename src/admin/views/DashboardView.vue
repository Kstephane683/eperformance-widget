<template>
  <div class="ep-adm" :class="{ 'ep-adm--detail-open': selectedId !== null }">
    <header class="ep-adm__topbar">
      <div class="ep-adm__brand">
        <span class="ep-adm__brand-mark" aria-hidden="true">A</span>
        <div class="ep-adm__brand-text">
          <h1 class="ep-adm__title">Admin Chatbot</h1>
          <p class="ep-adm__subtitle">ePerformance — conversations &amp; leads</p>
        </div>
      </div>
      <button type="button" class="ep-adm__logout" @click="auth.logout()">Déconnexion</button>
    </header>

    <div class="ep-adm__body">
      <!-- ==================== Volet liste ==================== -->
      <section class="ep-adm__pane ep-adm__pane--list" aria-label="Liste des conversations">
        <div class="ep-adm__filters">
          <input
            v-model.trim="searchQuery"
            type="search"
            class="ep-adm__search"
            placeholder="Rechercher (nom, tél, message…)"
            aria-label="Rechercher une conversation"
          />
          <select v-model="statusFilter" class="ep-adm__select" aria-label="Filtrer par statut">
            <option value="all">Tous</option>
            <option value="active">Actives</option>
            <option value="escalated">Escaladées</option>
            <option value="resolved">Résolues</option>
            <option value="abandoned">Abandonnées</option>
          </select>
        </div>

        <p v-if="listError" class="ep-adm__error" role="alert">{{ listError }}</p>
        <p v-else-if="listLoading && conversations.length === 0" class="ep-adm__hint">
          Chargement des conversations…
        </p>
        <p v-else-if="filteredConversations.length === 0" class="ep-adm__hint">
          Aucune conversation ne correspond.
        </p>

        <ul class="ep-adm__list">
          <li v-for="conv in filteredConversations" :key="conv.conversation_id">
            <button
              type="button"
              class="ep-adm__item"
              :class="{ 'ep-adm__item--active': conv.conversation_id === selectedId }"
              @click="select(conv.conversation_id)"
            >
              <span class="ep-adm__item-top">
                <span class="ep-adm__badge" :class="badgeClass(conv.status, conv.human_active)">
                  {{ badgeLabel(conv.status, conv.human_active) }}
                </span>
                <span class="ep-adm__time">
                  {{ formatRelative(conv.last_message_at ?? conv.created_at) }}
                </span>
              </span>
              <span class="ep-adm__item-name">{{ displayName(conv) }}</span>
              <span v-if="conv.lead_phone" class="ep-adm__item-phone">{{ conv.lead_phone }}</span>
              <span v-if="conv.last_message" class="ep-adm__item-last">
                {{ truncate(conv.last_message, 90) }}
              </span>
              <span class="ep-adm__item-meta">
                {{ conv.message_count }} message(s) · {{ conv.site_id }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <!-- ==================== Volet détail ==================== -->
      <section class="ep-adm__pane ep-adm__pane--detail" aria-label="Détail de la conversation">
        <template v-if="detail">
          <header class="ep-adm__detail-head">
            <button type="button" class="ep-adm__back" @click="closeDetail">← Retour</button>

            <div class="ep-adm__detail-id">
              <span
                class="ep-adm__badge"
                :class="badgeClass(detail.conversation.status, detail.conversation.human_active)"
              >
                {{ badgeLabel(detail.conversation.status, detail.conversation.human_active) }}
              </span>
              <span v-if="detail.conversation.assigned_agent" class="ep-adm__chip">
                Agent : {{ detail.conversation.assigned_agent }}
              </span>
              <span class="ep-adm__chip ep-adm__chip--muted">{{ detail.conversation.site_id }}</span>
            </div>

            <div class="ep-adm__lead-name">{{ detailLead?.name ?? 'Visiteur' }}</div>
            <div class="ep-adm__lead-contact">
              <span v-if="detailLead?.phone">{{ detailLead.phone }}</span>
              <span v-if="detailLead?.email">{{ detailLead.email }}</span>
            </div>

            <div class="ep-adm__actions">
              <button
                v-if="!isHumanActive"
                type="button"
                class="ep-adm__btn ep-adm__btn--takeover"
                :disabled="actionBusy"
                @click="takeover"
              >
                Prendre la main
              </button>
              <button
                v-else
                type="button"
                class="ep-adm__btn ep-adm__btn--release"
                :disabled="actionBusy"
                @click="release"
              >
                Rendre la main à l’IA
              </button>

              <template v-if="agents.length > 0">
                <select
                  v-model="selectedAgentKey"
                  class="ep-adm__select ep-adm__select--agent"
                  aria-label="Agent à assigner"
                >
                  <option value="" disabled>Assigner à un agent…</option>
                  <option v-for="agent in agents" :key="agent.key" :value="agent.key">
                    {{ agent.label }}
                  </option>
                </select>
                <button
                  type="button"
                  class="ep-adm__btn"
                  :disabled="actionBusy || selectedAgentKey === ''"
                  @click="assign"
                >
                  Assigner
                </button>
              </template>
              <p v-else-if="agentsError" class="ep-adm__hint ep-adm__hint--inline">
                Liste des agents indisponible.
              </p>
            </div>

            <p v-if="actionError" class="ep-adm__error" role="alert">{{ actionError }}</p>
          </header>

          <div ref="threadEl" class="ep-adm__thread" @scroll.passive="onThreadScroll">
            <div
              v-for="msg in detail.messages"
              :key="String(msg.id)"
              class="ep-adm-msg"
              :class="messageClass(msg)"
            >
              <span v-if="msg.human" class="ep-adm-msg__badge">Conseiller</span>
              <p class="ep-adm-msg__content">{{ msg.content }}</p>
              <span class="ep-adm-msg__meta">
                {{ messageAuthor(msg) }} · {{ formatTime(msg.created_at) }}
              </span>
            </div>
          </div>

          <footer v-if="isHumanActive" class="ep-adm__composer">
            <textarea
              v-model="draft"
              class="ep-adm__textarea"
              rows="2"
              placeholder="Répondre en tant que conseiller… (Entrée pour envoyer)"
              @keydown.enter.exact.prevent="submitHumanMessage"
            ></textarea>
            <button
              type="button"
              class="ep-adm__send"
              :disabled="sending || draft.trim().length === 0"
              @click="submitHumanMessage"
            >
              Envoyer
            </button>
          </footer>
          <p v-else class="ep-adm__composer-off">
            Le bot gère la conversation — prenez la main pour répondre en tant qu’humain.
          </p>
        </template>

        <div v-else class="ep-adm__empty">
          <template v-if="selectedId === null">
            <p class="ep-adm__empty-title">Aucune conversation sélectionnée</p>
            <p class="ep-adm__empty-sub">
              Choisissez une conversation dans la liste pour voir le fil et intervenir.
            </p>
          </template>
          <template v-else>
            <p v-if="detailError" class="ep-adm__error" role="alert">{{ detailError }}</p>
            <p v-else class="ep-adm__hint">Chargement de la conversation…</p>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  ApiError,
  assignAgent,
  fetchAgents,
  fetchConversationDetail,
  fetchConversations,
  releaseConversation,
  sendHumanMessage,
  takeoverConversation,
} from '../api'
import type {
  AdminAgent,
  AdminConversationDetail,
  AdminConversationStatus,
  AdminConversationSummary,
  AdminMessage,
} from '../api'
import { useAdminAuthStore } from '../stores/auth'

const REFRESH_MS = 10_000
const LIST_LIMIT = 50

const auth = useAdminAuthStore()

// ============================================================
// ÉTAT — liste
// ============================================================

const conversations = ref<AdminConversationSummary[]>([])
const listLoading = ref(false)
const listError = ref<string | null>(null)
const searchQuery = ref('')
/** Filtre statut côté client (la liste est déjà chargée, limit=50). */
const statusFilter = ref<string>('all')

const filteredConversations = computed(() => {
  const query = searchQuery.value.toLowerCase()
  const filter = statusFilter.value as 'all' | AdminConversationStatus
  return conversations.value.filter((conv) => {
    if (filter !== 'all' && conv.status !== filter) return false
    if (query === '') return true
    return [
      conv.lead_name,
      conv.lead_phone,
      conv.last_message,
      conv.conversation_id,
      conv.site_id,
      conv.assigned_agent,
    ].some((field) => typeof field === 'string' && field.toLowerCase().includes(query))
  })
})

// ============================================================
// ÉTAT — détail
// ============================================================

const selectedId = ref<string | null>(null)
const detail = ref<AdminConversationDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)
const draft = ref('')
const sending = ref(false)

const agents = ref<AdminAgent[]>([])
const agentsError = ref(false)
const selectedAgentKey = ref('')
const actionBusy = ref(false)
const actionError = ref<string | null>(null)

const selectedSummary = computed(
  () => conversations.value.find((c) => c.conversation_id === selectedId.value) ?? null,
)

const isHumanActive = computed(() => detail.value?.conversation.human_active === true)

const detailLead = computed(() => {
  if (!detail.value) return null
  const lead = detail.value.lead
  const summary = selectedSummary.value
  const name = lead?.name ?? summary?.lead_name ?? null
  const phone = lead?.phone ?? summary?.lead_phone ?? null
  const email = lead?.email ?? null
  if (name === null && phone === null && email === null) return null
  return { name: name ?? 'Visiteur', phone, email }
})

// ============================================================
// HELPERS AFFICHAGE
// ============================================================

function badgeLabel(status: string, humanActive: boolean): string {
  if (status === 'escalated') return humanActive ? 'Humain actif' : 'En attente humain'
  if (status === 'active') return 'Active'
  if (status === 'resolved') return 'Résolue'
  if (status === 'abandoned') return 'Abandonnée'
  return status
}

function badgeClass(status: string, humanActive: boolean): string {
  const base = 'ep-adm__badge'
  if (status === 'active') return `${base} ${base}--active`
  if (status === 'escalated') {
    return humanActive ? `${base} ${base}--escalated ${base}--human-active` : `${base} ${base}--escalated`
  }
  if (status === 'resolved') return `${base} ${base}--resolved`
  if (status === 'abandoned') return `${base} ${base}--abandoned`
  return base
}

function displayName(conv: AdminConversationSummary): string {
  return conv.lead_name ?? `Visiteur ${conv.conversation_id.slice(-6)}`
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function messageClass(msg: AdminMessage): string {
  if (msg.role === 'user') return 'ep-adm-msg ep-adm-msg--user'
  return msg.human ? 'ep-adm-msg ep-adm-msg--human' : 'ep-adm-msg ep-adm-msg--ia'
}

function messageAuthor(msg: AdminMessage): string {
  if (msg.role === 'user') return 'Visiteur'
  if (msg.human) return 'Conseiller'
  return msg.agent_used ? `IA — ${msg.agent_used}` : 'IA'
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Session expirée — veuillez vous reconnecter.'
    if (e.status === 403) return 'Accès refusé : ce compte n’est pas administrateur.'
    return e.message
  }
  if (e instanceof Error) return `Erreur réseau : ${e.message}`
  return 'Erreur inconnue.'
}

// ============================================================
// CHARGEMENT — liste + détail (protection contre les réponses périmées)
// ============================================================

let listReqSeq = 0
async function refreshList(silent = false): Promise<void> {
  const seq = ++listReqSeq
  if (!silent) listLoading.value = true
  try {
    const data = await fetchConversations(LIST_LIMIT)
    if (seq !== listReqSeq) return
    conversations.value = data.conversations ?? []
    listError.value = null
  } catch (e) {
    if (seq !== listReqSeq) return
    listError.value = messageOf(e)
  } finally {
    if (seq === listReqSeq) listLoading.value = false
  }
}

let detailReqSeq = 0
async function loadDetail(conversationId: string, silent = false): Promise<void> {
  const seq = ++detailReqSeq
  if (!silent) {
    detailLoading.value = true
    detailError.value = null
  }
  try {
    const data = await fetchConversationDetail(conversationId)
    if (seq !== detailReqSeq) return
    detail.value = data
    detailError.value = null
    const assigned = data.conversation.assigned_agent
    if (assigned && agents.value.some((a) => a.key === assigned)) {
      selectedAgentKey.value = assigned
    }
  } catch (e) {
    if (seq !== detailReqSeq) return
    detailError.value = messageOf(e)
  } finally {
    if (seq === detailReqSeq) detailLoading.value = false
  }
}

function select(conversationId: string): void {
  if (selectedId.value === conversationId) return
  selectedId.value = conversationId
  detail.value = null
  draft.value = ''
  selectedAgentKey.value = ''
  actionError.value = null
  stickToBottom.value = true
  void loadDetail(conversationId)
}

function closeDetail(): void {
  selectedId.value = null
  detail.value = null
  detailError.value = null
}

async function loadAgents(): Promise<void> {
  agentsError.value = false
  try {
    agents.value = await fetchAgents()
  } catch {
    agents.value = []
    agentsError.value = true
  }
}

// ============================================================
// AUTO-REFRESH 10 s — pausé quand l'onglet est caché
// ============================================================

let pollInterval: number | null = null

function pollTick(): void {
  if (document.hidden) return
  void refreshList(true)
  const id = selectedId.value
  if (id !== null) void loadDetail(id, true)
}

onMounted(() => {
  void refreshList()
  void loadAgents()
  pollInterval = window.setInterval(pollTick, REFRESH_MS)
  // Retour sur l'onglet → rafraîchissement immédiat (pollTick ignore hidden)
  document.addEventListener('visibilitychange', pollTick)
})

onBeforeUnmount(() => {
  if (pollInterval !== null) window.clearInterval(pollInterval)
  document.removeEventListener('visibilitychange', pollTick)
})

// ============================================================
// ACTIONS — takeover / release / assign / message humain
// ============================================================

async function withAction(run: () => Promise<void>): Promise<void> {
  if (actionBusy.value) return
  actionBusy.value = true
  actionError.value = null
  try {
    await run()
  } catch (e) {
    actionError.value = messageOf(e)
  } finally {
    actionBusy.value = false
  }
}

function takeover(): void {
  const id = selectedId.value
  if (!id) return
  void withAction(async () => {
    await takeoverConversation(id)
    await Promise.all([loadDetail(id, true), refreshList(true)])
  })
}

function release(): void {
  const id = selectedId.value
  if (!id) return
  void withAction(async () => {
    await releaseConversation(id)
    await Promise.all([loadDetail(id, true), refreshList(true)])
  })
}

function assign(): void {
  const id = selectedId.value
  const key = selectedAgentKey.value
  if (!id || key === '') return
  void withAction(async () => {
    await assignAgent(id, key)
    await Promise.all([loadDetail(id, true), refreshList(true)])
  })
}

function submitHumanMessage(): void {
  const id = selectedId.value
  const content = draft.value.trim()
  if (!id || content === '' || sending.value || !isHumanActive.value) return
  sending.value = true
  actionError.value = null
  void (async () => {
    try {
      await sendHumanMessage(id, content)
      draft.value = ''
      stickToBottom.value = true
      await Promise.all([loadDetail(id, true), refreshList(true)])
    } catch (e) {
      actionError.value = messageOf(e)
    } finally {
      sending.value = false
    }
  })()
}

// ============================================================
// SCROLL DU FIL — coller en bas si l'utilisateur est déjà en bas
// ============================================================

const threadEl = ref<HTMLElement | null>(null)
const stickToBottom = ref(true)

function onThreadScroll(): void {
  const el = threadEl.value
  if (!el) return
  stickToBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 80
}

async function scrollToBottom(force = false): Promise<void> {
  if (!force && !stickToBottom.value) return
  await nextTick()
  const el = threadEl.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(
  () => detail.value?.messages.length ?? 0,
  (count, prev) => {
    if (count !== prev) void scrollToBottom(prev === 0)
  },
)
</script>

<style scoped>
/* ==================== Gabarit général ==================== */

.ep-adm {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at 50% -10%, #16141c 0%, var(--ep-bg) 55%);
}

.ep-adm__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ep-border-soft);
  background: var(--ep-glass);
  backdrop-filter: blur(12px);
}

.ep-adm__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ep-adm__brand-mark {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
  display: grid;
  place-items: center;
  font-family: var(--ep-font-title);
  font-weight: 700;
  font-size: 16px;
}

.ep-adm__brand-text {
  min-width: 0;
}

.ep-adm__title {
  margin: 0;
  font-family: var(--ep-font-title);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--ep-gold-light);
}

.ep-adm__subtitle {
  margin: 0;
  font-size: 11px;
  color: var(--ep-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ep-adm__logout {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: var(--ep-radius-full);
  border: 1px solid var(--ep-border);
  background: transparent;
  color: var(--ep-gold);
  font-size: 12px;
  font-weight: 600;
  transition: background 0.2s ease;
}

.ep-adm__logout:hover {
  background: rgba(201, 169, 110, 0.12);
}

.ep-adm__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 400px) 1fr;
}

.ep-adm__pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ep-adm__pane--list {
  border-right: 1px solid var(--ep-border-soft);
  background: rgba(12, 12, 16, 0.6);
}

/* ==================== Filtres + liste ==================== */

.ep-adm__filters {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--ep-border-soft);
}

.ep-adm__search,
.ep-adm__select {
  padding: 10px 12px;
  border-radius: var(--ep-radius-md);
  border: 1px solid var(--ep-border);
  background: #060609;
  color: var(--ep-text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ep-adm__search {
  flex: 1;
  min-width: 0;
}

.ep-adm__search::placeholder {
  color: var(--ep-text-muted);
}

.ep-adm__search:focus-visible,
.ep-adm__select:focus-visible {
  border-color: var(--ep-gold);
  box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.15);
}

.ep-adm__list {
  flex: 1;
  overflow-y: auto;
  margin: 0;
  padding: 8px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ep-adm__item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 12px;
  text-align: left;
  border-radius: var(--ep-radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--ep-text);
  font-family: inherit;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ep-adm__item:hover {
  background: rgba(201, 169, 110, 0.06);
}

.ep-adm__item--active {
  background: rgba(201, 169, 110, 0.1);
  border-color: var(--ep-border);
}

.ep-adm__item-top {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ep-adm__time {
  font-size: 11px;
  color: var(--ep-text-muted);
  white-space: nowrap;
}

.ep-adm__item-name {
  font-weight: 600;
  font-size: 14px;
}

.ep-adm__item-phone {
  font-size: 12px;
  color: var(--ep-gold-light);
}

.ep-adm__item-last {
  font-size: 12.5px;
  color: var(--ep-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ep-adm__item-meta {
  font-size: 10.5px;
  color: var(--ep-text-muted);
  opacity: 0.8;
}

/* ==================== Badges de statut ==================== */

.ep-adm__badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--ep-radius-full);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}

.ep-adm__badge--active {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.ep-adm__badge--escalated {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.3);
}

/* Escalade avec humain actif : accent renforcé */
.ep-adm__badge--human-active {
  background: rgba(251, 191, 36, 0.22);
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.35);
}

.ep-adm__badge--resolved {
  color: var(--ep-text-muted);
  background: rgba(154, 150, 140, 0.12);
  border: 1px solid rgba(154, 150, 140, 0.3);
}

.ep-adm__badge--abandoned {
  color: #7a766c;
  background: rgba(122, 118, 108, 0.15);
  border: 1px solid rgba(122, 118, 108, 0.3);
}

/* ==================== Détail : en-tête ==================== */

.ep-adm__detail-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ep-border-soft);
  background: var(--ep-glass);
  backdrop-filter: blur(12px);
}

.ep-adm__back {
  display: none;
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: var(--ep-radius-full);
  border: 1px solid var(--ep-border);
  background: transparent;
  color: var(--ep-gold);
  font-size: 12px;
  font-weight: 600;
}

.ep-adm__detail-id {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.ep-adm__chip {
  padding: 3px 10px;
  border-radius: var(--ep-radius-full);
  font-size: 11px;
  font-weight: 600;
  color: var(--ep-gold);
  background: rgba(201, 169, 110, 0.1);
  border: 1px solid var(--ep-border-soft);
}

.ep-adm__chip--muted {
  color: var(--ep-text-muted);
}

.ep-adm__lead-name {
  font-family: var(--ep-font-title);
  font-size: 20px;
  font-weight: 600;
  color: var(--ep-gold-light);
  line-height: 1.2;
}

.ep-adm__lead-contact {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12.5px;
  color: var(--ep-text-muted);
}

.ep-adm__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.ep-adm__select--agent {
  max-width: 220px;
}

.ep-adm__btn {
  padding: 9px 16px;
  border-radius: var(--ep-radius-full);
  border: 1px solid var(--ep-border);
  background: rgba(201, 169, 110, 0.12);
  color: var(--ep-gold);
  font-weight: 600;
  font-size: 13px;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.ep-adm__btn:hover:not(:disabled) {
  background: rgba(201, 169, 110, 0.22);
  border-color: var(--ep-gold);
}

.ep-adm__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ep-adm__btn--takeover {
  border: none;
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
  font-weight: 700;
}

.ep-adm__btn--takeover:hover:not(:disabled) {
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  filter: brightness(1.05);
}

/* ==================== Fil des messages ==================== */

.ep-adm__thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.ep-adm-msg {
  max-width: 78%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border-radius: var(--ep-radius-md);
  font-size: 14px;
  line-height: 1.55;
  word-break: break-word;
}

/* Visiteur à gauche */
.ep-adm-msg--user {
  align-self: flex-start;
  background: var(--ep-surface-raised);
  border: 1px solid var(--ep-border-soft);
}

/* IA à droite */
.ep-adm-msg--ia {
  align-self: flex-end;
  background: rgba(201, 169, 110, 0.08);
  border: 1px solid var(--ep-border-soft);
}

/* Conseiller humain à droite, or + badge "Conseiller" */
.ep-adm-msg--human {
  align-self: flex-end;
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
}

.ep-adm-msg__badge {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: var(--ep-radius-full);
  background: rgba(10, 10, 14, 0.18);
  color: #0a0a0e;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ep-adm-msg__content {
  margin: 0;
  white-space: pre-wrap;
}

.ep-adm-msg__meta {
  font-size: 10.5px;
  opacity: 0.6;
}

/* ==================== Zone de saisie humaine ==================== */

.ep-adm__composer {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--ep-border);
  background: #101014;
  backdrop-filter: blur(12px);
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.45);
}

.ep-adm__textarea {
  flex: 1;
  min-width: 0;
  resize: none;
  padding: 10px 14px;
  border-radius: var(--ep-radius-md);
  border: 1px solid var(--ep-border);
  background: #060609;
  color: var(--ep-text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ep-adm__textarea::placeholder {
  color: var(--ep-text-muted);
}

.ep-adm__textarea:focus-visible {
  border-color: var(--ep-gold);
  box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.15);
}

.ep-adm__send {
  flex-shrink: 0;
  padding: 11px 20px;
  border: none;
  border-radius: var(--ep-radius-md);
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
  font-weight: 700;
  font-size: 14px;
  transition: transform 0.15s ease, opacity 0.2s ease;
}

.ep-adm__send:hover:not(:disabled) {
  transform: scale(1.03);
}

.ep-adm__send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ep-adm__composer-off {
  margin: 0;
  padding: 10px 16px;
  border-top: 1px solid var(--ep-border-soft);
  background: rgba(12, 12, 16, 0.6);
  color: var(--ep-text-muted);
  font-size: 12px;
}

/* ==================== États divers ==================== */

.ep-adm__hint {
  margin: 0;
  padding: 14px 16px;
  color: var(--ep-text-muted);
  font-size: 13px;
}

.ep-adm__hint--inline {
  padding: 0;
  font-size: 12px;
}

.ep-adm__error {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--ep-radius-md);
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.35);
  color: #fca5a5;
  font-size: 12.5px;
}

.ep-adm__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
}

.ep-adm__empty-title {
  margin: 0;
  font-family: var(--ep-font-title);
  font-size: 20px;
  color: var(--ep-gold-light);
}

.ep-adm__empty-sub {
  margin: 0;
  max-width: 320px;
  font-size: 13px;
  color: var(--ep-text-muted);
}

/* ==================== Mobile (mobile-first <= 900px) ==================== */

@media (max-width: 900px) {
  .ep-adm__body {
    grid-template-columns: 1fr;
  }

  .ep-adm__pane--detail {
    display: none;
  }

  /* Conversation sélectionnée → détail plein écran, liste masquée */
  .ep-adm--detail-open .ep-adm__pane--list {
    display: none;
  }

  .ep-adm--detail-open .ep-adm__pane--detail {
    display: flex;
  }

  .ep-adm__back {
    display: inline-flex;
  }

  .ep-adm-msg {
    max-width: 88%;
  }
}
</style>
