<template>
  <div class="adm-boite" :class="{ 'adm-boite--detail-ouvert': selectedId !== null }">
    <!-- ==================== Barre d'outils ==================== -->
    <div class="adm-outils">
      <div class="adm-recherche adm-boite__recherche">
        <svg
          class="adm-boite__loupe"
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
          v-model.trim="searchQuery"
          type="search"
          placeholder="Rechercher (nom, téléphone, message…)"
          aria-label="Rechercher une conversation"
        />
      </div>

      <select v-model="statusFilter" class="adm-champ" aria-label="Filtrer par statut">
        <option value="all">Tous les statuts</option>
        <option value="active">Actives</option>
        <option value="escalated">En attente d’un conseiller</option>
        <option value="resolved">Résolues</option>
        <option value="abandoned">Abandonnées</option>
      </select>

      <div class="adm-outils__fin">
        <span class="adm-note">{{ filteredConversations.length }} affichée(s)</span>
        <button
          type="button"
          class="adm-btn adm-btn--discret"
          :disabled="listLoading"
          @click="refreshList()"
        >
          {{ listLoading ? 'Actualisation…' : 'Actualiser' }}
        </button>
      </div>
    </div>

    <p v-if="listError" class="adm-erreur" role="alert">{{ listError }}</p>

    <div class="adm-boite__corps">
      <!-- ==================== Volet liste ==================== -->
      <section class="adm-boite__volet" aria-label="Liste des conversations">
        <p v-if="listLoading && conversations.length === 0" class="adm-note adm-boite__etat">
          Chargement des conversations…
        </p>
        <p v-else-if="filteredConversations.length === 0" class="adm-note adm-boite__etat">
          Aucune conversation ne correspond à ce filtre.
        </p>

        <ul class="adm-liste adm-boite__liste">
          <li v-for="conv in filteredConversations" :key="conv.conversation_id">
            <button
              type="button"
              class="adm-boite__item"
              :class="{ 'adm-boite__item--actif': conv.conversation_id === selectedId }"
              :aria-current="conv.conversation_id === selectedId ? 'true' : undefined"
              @click="select(conv.conversation_id)"
            >
              <span class="adm-boite__item-haut">
                <span
                  class="adm-badge"
                  :class="`adm-badge--${tonStatutConversation(conv.status, conv.human_active)}`"
                >
                  {{ libelleStatutConversation(conv.status, conv.human_active) }}
                </span>
                <span class="adm-ligne__meta">
                  {{ tempsRelatifOuTiret(conv.last_message_at ?? conv.created_at) }}
                </span>
              </span>
              <span class="adm-boite__item-nom">
                {{ nomAffichage(conv.lead_name, conv.conversation_id) }}
              </span>
              <span v-if="conv.lead_phone" class="adm-boite__item-tel">{{ conv.lead_phone }}</span>
              <span v-if="conv.last_message" class="adm-boite__item-msg">
                {{ tronquer(conv.last_message, 90) }}
              </span>
              <span class="adm-ligne__meta">
                {{ conv.message_count }} message(s) · {{ conv.site_id }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <!-- ==================== Volet détail ==================== -->
      <section
        class="adm-boite__volet adm-boite__volet--detail"
        aria-label="Détail de la conversation"
      >
        <template v-if="detail">
          <header class="adm-boite__detail-entete">
            <button
              type="button"
              class="adm-btn adm-btn--discret adm-boite__retour"
              @click="closeDetail"
            >
              Retour à la liste
            </button>

            <div class="adm-boite__detail-id">
              <span
                class="adm-badge"
                :class="`adm-badge--${tonStatutConversation(detail.conversation.status, detail.conversation.human_active)}`"
              >
                {{
                  libelleStatutConversation(
                    detail.conversation.status,
                    detail.conversation.human_active,
                  )
                }}
              </span>
              <span class="adm-badge">{{ detail.conversation.site_id }}</span>
              <span class="adm-badge">{{ detail.messages.length }} message(s)</span>
            </div>

            <p class="adm-boite__prospect">{{ detailLead?.name ?? 'Visiteur' }}</p>
            <p v-if="detailLead?.phone || detailLead?.email" class="adm-boite__contact">
              <a v-if="detailLead?.phone" :href="`tel:${detailLead.phone}`">
                {{ detailLead.phone }}
              </a>
              <a v-if="detailLead?.email" :href="`mailto:${detailLead.email}`">
                {{ detailLead.email }}
              </a>
            </p>

            <div class="adm-outils">
              <button
                v-if="!isHumanActive"
                type="button"
                class="adm-btn adm-btn--or"
                :disabled="actionBusy"
                @click="takeover"
              >
                Prendre la main
              </button>
              <button v-else type="button" class="adm-btn" :disabled="actionBusy" @click="release">
                Rendre la main à Mia
              </button>
            </div>

            <p v-if="actionError" class="adm-erreur" role="alert">{{ actionError }}</p>
          </header>

          <div ref="threadEl" class="adm-boite__fil" @scroll.passive="onThreadScroll">
            <div
              v-for="msg in detail.messages"
              :key="String(msg.id)"
              class="adm-message"
              :class="classeMessage(msg)"
            >
              <span v-if="msg.human" class="adm-message__badge">Conseiller</span>
              <p class="adm-message__contenu">{{ msg.content }}</p>
              <span class="adm-message__meta">
                {{ auteurMessage(msg) }} · {{ heure(msg.created_at) }}
              </span>
            </div>
          </div>

          <footer v-if="isHumanActive" class="adm-boite__redaction">
            <textarea
              v-model="draft"
              class="adm-champ adm-boite__texte"
              rows="2"
              aria-label="Répondre en tant que conseiller"
              placeholder="Répondre en tant que conseiller… (Entrée pour envoyer)"
              @keydown.enter.exact.prevent="submitHumanMessage"
            ></textarea>
            <button
              type="button"
              class="adm-btn adm-btn--or"
              :disabled="sending || draft.trim().length === 0"
              @click="submitHumanMessage"
            >
              Envoyer
            </button>
          </footer>
          <p v-else class="adm-boite__hors-main">
            Mia gère la conversation. Prenez la main pour répondre en tant que conseiller.
          </p>
        </template>

        <div v-else class="adm-boite__vide">
          <template v-if="selectedId === null">
            <p class="adm-vide__titre">Aucune conversation sélectionnée</p>
            <p class="adm-vide__texte">
              Choisissez une conversation dans la liste pour lire le fil et intervenir.
            </p>
          </template>
          <template v-else>
            <p v-if="detailError" class="adm-erreur" role="alert">{{ detailError }}</p>
            <p v-else class="adm-note">Chargement de la conversation…</p>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Boîte de réception — les conversations des visiteurs.
 *
 * DEUX CHANGEMENTS DE FOND depuis l'ancien écran « Chatbot » :
 *
 * 1. AUCUN NOM D'AGENT. L'écran affichait la clé d'agent interne sous chaque
 *    message (« IA — sales-coach »), un sélecteur « Assigner à un agent… » et
 *    une pastille « Agent : <clé> ». C'était une fuite du routage interne : la
 *    console ne parle plus que de Mia et d'un conseiller humain. Le choix de la
 *    compétence reste au backend, là où il est déjà décidé.
 *
 * 2. Le titre de l'écran n'est plus ici : il est dans l'en-tête de la console.
 *    Une page qui répète son titre trois fois (barre latérale, en-tête, page)
 *    dépense la place qui manque au contenu.
 *
 * La liste est partagée (store de la console) : l'en-tête, les pastilles et
 * cette vue lisent la même donnée, sans second appel réseau.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  ApiError,
  fetchConversationDetail,
  releaseConversation,
  sendHumanMessage,
  takeoverConversation,
} from '../api'
import type { AdminConversationDetail, AdminConversationStatus, AdminMessage } from '../api'
import {
  heure,
  libelleStatutConversation,
  nomAffichage,
  tempsRelatifOuTiret,
  tonStatutConversation,
  tronquer,
} from '../format'
import { useConsoleStore } from '../stores/console'

const REFRESH_MS = 10_000

const route = useRoute()
const consoleStore = useConsoleStore()

const conversations = computed(() => consoleStore.conversations)
const listLoading = computed(() => consoleStore.conversationsEnCours)
const listError = computed(() => consoleStore.conversationsErreur)

const searchQuery = ref('')
const statusFilter = ref<string>('all')

/** Filtres reçus par l'URL : liens de notification et de recherche globale. */
function appliquerRequete(): void {
  const q = route.query.q
  if (typeof q === 'string' && q.length > 0) searchQuery.value = q
  const statut = route.query.statut
  if (typeof statut === 'string' && statut.length > 0) statusFilter.value = statut
}

watch(() => route.query, appliquerRequete)

const filteredConversations = computed(() => {
  const requete = searchQuery.value.toLowerCase()
  const filtre = statusFilter.value as 'all' | AdminConversationStatus
  return conversations.value.filter((conv) => {
    if (filtre !== 'all' && conv.status !== filtre) return false
    if (requete === '') return true
    return [
      conv.lead_name,
      conv.lead_phone,
      conv.last_message,
      conv.conversation_id,
      conv.site_id,
    ].some((champ) => typeof champ === 'string' && champ.toLowerCase().includes(requete))
  })
})

// ============================================================
// Détail
// ============================================================

const selectedId = ref<string | null>(null)
const detail = ref<AdminConversationDetail | null>(null)
const detailError = ref<string | null>(null)
const draft = ref('')
const sending = ref(false)
const actionBusy = ref(false)
const actionError = ref<string | null>(null)

const selectedSummary = computed(
  () => conversations.value.find((c) => c.conversation_id === selectedId.value) ?? null,
)
const isHumanActive = computed(() => detail.value?.conversation.human_active === true)

const detailLead = computed(() => {
  if (!detail.value) return null
  const prospect = detail.value.lead
  const resume = selectedSummary.value
  const nom = prospect?.name ?? resume?.lead_name ?? null
  const telephone = prospect?.phone ?? resume?.lead_phone ?? null
  const courriel = prospect?.email ?? null
  if (nom === null && telephone === null && courriel === null) return null
  return { name: nom ?? 'Visiteur', phone: telephone, email: courriel }
})

function messageOf(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return `Erreur réseau : ${e.message}`
  return 'Erreur inconnue.'
}

let detailReqSeq = 0
async function loadDetail(conversationId: string, silencieux = false): Promise<void> {
  const seq = ++detailReqSeq
  try {
    const donnees = await fetchConversationDetail(conversationId)
    if (seq !== detailReqSeq) return
    detail.value = donnees
    detailError.value = null
  } catch (e) {
    if (seq !== detailReqSeq) return
    if (!silencieux) detailError.value = messageOf(e)
  }
}

function select(conversationId: string): void {
  if (selectedId.value === conversationId) return
  selectedId.value = conversationId
  detail.value = null
  draft.value = ''
  actionError.value = null
  stickToBottom.value = true
  void loadDetail(conversationId)
}

function closeDetail(): void {
  selectedId.value = null
  detail.value = null
  detailError.value = null
}

function refreshList(): Promise<void> {
  return consoleStore.chargerConversations()
}

// ============================================================
// Rafraîchissement 10 s — en pause quand l'onglet est caché
// ============================================================

let intervalle: number | null = null

function tic(): void {
  if (document.hidden) return
  void consoleStore.chargerConversations()
  const identifiant = selectedId.value
  if (identifiant !== null) void loadDetail(identifiant, true)
}

onMounted(() => {
  appliquerRequete()
  void consoleStore.chargerConversations()
  intervalle = window.setInterval(tic, REFRESH_MS)
  document.addEventListener('visibilitychange', tic)
})

onBeforeUnmount(() => {
  if (intervalle !== null) window.clearInterval(intervalle)
  document.removeEventListener('visibilitychange', tic)
})

// ============================================================
// Actions — prise en main, retour à Mia, message de conseiller
// ============================================================

async function avecAction(run: () => Promise<void>): Promise<void> {
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
  const identifiant = selectedId.value
  if (!identifiant) return
  void avecAction(async () => {
    await takeoverConversation(identifiant)
    await Promise.all([loadDetail(identifiant, true), consoleStore.chargerConversations()])
  })
}

function release(): void {
  const identifiant = selectedId.value
  if (!identifiant) return
  void avecAction(async () => {
    await releaseConversation(identifiant)
    await Promise.all([loadDetail(identifiant, true), consoleStore.chargerConversations()])
  })
}

function submitHumanMessage(): void {
  const identifiant = selectedId.value
  const contenu = draft.value.trim()
  if (!identifiant || contenu === '' || sending.value || !isHumanActive.value) return
  sending.value = true
  actionError.value = null
  void (async () => {
    try {
      await sendHumanMessage(identifiant, contenu)
      draft.value = ''
      stickToBottom.value = true
      await Promise.all([loadDetail(identifiant, true), consoleStore.chargerConversations()])
    } catch (e) {
      actionError.value = messageOf(e)
    } finally {
      sending.value = false
    }
  })()
}

// ============================================================
// Auteur d'un message — Mia, un conseiller, ou le visiteur
// ============================================================

function classeMessage(msg: AdminMessage): string {
  if (msg.role === 'user') return 'adm-message--visiteur'
  return msg.human ? 'adm-message--conseiller' : 'adm-message--mia'
}

function auteurMessage(msg: AdminMessage): string {
  if (msg.role === 'user') return 'Visiteur'
  return msg.human ? 'Conseiller' : 'Mia'
}

// ============================================================
// Défilement du fil — coller en bas si l'opérateur y est déjà
// ============================================================

const threadEl = ref<HTMLElement | null>(null)
const stickToBottom = ref(true)

function onThreadScroll(): void {
  const element = threadEl.value
  if (!element) return
  stickToBottom.value = element.scrollTop + element.clientHeight >= element.scrollHeight - 80
}

async function scrollToBottom(force = false): Promise<void> {
  if (!force && !stickToBottom.value) return
  await nextTick()
  const element = threadEl.value
  if (element) element.scrollTop = element.scrollHeight
}

watch(
  () => detail.value?.messages.length ?? 0,
  (nombre, precedent) => {
    if (nombre !== precedent) void scrollToBottom(precedent === 0)
  },
)
</script>

<style scoped>
.adm-boite {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* La boîte de réception vit dans la hauteur disponible : la liste et le fil
     défilent en interne, comme dans une boîte de réception de messagerie. */
  flex: 1;
  min-height: 0;
}

.adm-boite__recherche {
  flex: 1;
  min-width: 180px;
  max-width: 420px;
}

.adm-boite__loupe {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.adm-boite__corps {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 14px;
}

.adm-boite__volet {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bloc);
  background: var(--card);
  overflow: hidden;
}

.adm-boite__etat {
  padding: 14px;
}

.adm-boite__liste {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

.adm-boite__item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--arrondi-input);
  background: transparent;
  color: var(--text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  /* Même état actif que la barre latérale, donc même durée (décision D7c) :
     la conversation sélectionnée et le module courant marquent la même chose —
     « c'est ici que vous êtes ». Deux durées pour un même signal enverraient
     deux messages différents. */
  transition: background-color var(--t) var(--ease-out),
    border-color var(--t) var(--ease-out);
}

.adm-boite__item:hover {
  background: var(--neutre-trace);
}

/* Sélection : fond d'accent ET filet — l'état se lit sans la teinte seule */
.adm-boite__item--actif {
  background: var(--gold-bg);
  border-color: var(--gold-border);
}

.adm-boite__item-haut {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.adm-boite__item-nom {
  font-size: 14px;
  font-weight: 600;
}

.adm-boite__item-tel {
  font-size: 12px;
  color: var(--gold2);
}

.adm-boite__item-msg {
  font-size: 12.5px;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---------- Détail ---------- */
.adm-boite__detail-entete {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-bottom: 1px solid var(--border);
  background: var(--card2);
}

.adm-boite__retour {
  display: none;
  align-self: flex-start;
}

.adm-boite__detail-id {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.adm-boite__prospect {
  margin: 0;
  font-family: var(--police-titres);
  font-size: 21px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--text);
}

.adm-boite__contact {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  font-size: 12.5px;
}

.adm-boite__fil {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

.adm-message {
  max-width: 78%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border-radius: var(--arrondi-bloc);
  font-size: 14px;
  line-height: 1.55;
  word-break: break-word;
}

/* Visiteur à gauche — surface posée, filet décoratif */
.adm-message--visiteur {
  align-self: flex-start;
  background: var(--card2);
  border: 1px solid var(--border);
}

/* Mia à droite — trace d'accent (le bleu d'état reste réservé aux statuts) */
.adm-message--mia {
  align-self: flex-end;
  background: var(--gold-bg);
  border: 1px solid var(--border);
}

/* Conseiller humain à droite — or plein, texte sur or */
.adm-message--conseiller {
  align-self: flex-end;
  background: var(--gold);
  color: var(--on-gold);
}

.adm-message__badge {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: var(--arrondi-bouton);
  background: var(--neutre-trace);
  color: var(--on-gold);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.adm-message__contenu {
  margin: 0;
  white-space: pre-wrap;
}

.adm-message__meta {
  font-size: 10.5px;
  opacity: 0.72;
}

.adm-boite__redaction {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--border);
  background: var(--card2);
}

.adm-boite__texte {
  flex: 1;
  min-width: 0;
  resize: none;
  line-height: 1.5;
}

.adm-boite__hors-main {
  margin: 0;
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  background: var(--card2);
  color: var(--muted);
  font-size: 12.5px;
}

.adm-boite__vide {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
}

@media (max-width: 1000px) {
  .adm-boite__corps {
    grid-template-columns: minmax(0, 1fr);
  }

  .adm-boite__volet--detail {
    display: none;
  }

  /* Conversation ouverte → le détail prend l'écran, la liste s'efface */
  .adm-boite--detail-ouvert .adm-boite__volet:not(.adm-boite__volet--detail) {
    display: none;
  }

  .adm-boite--detail-ouvert .adm-boite__volet--detail {
    display: flex;
  }

  .adm-boite__retour {
    display: inline-flex;
  }

  .adm-message {
    max-width: 92%;
  }
}
</style>
