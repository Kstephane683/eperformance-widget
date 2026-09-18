<template>
  <div class="ep-bubble" :class="isUser ? 'ep-bubble--user' : 'ep-bubble--agent'">
    <!--
      Messages d'un conseiller humain (human_name du backend) : badge
      « Conseiller » + nom réel. L'information n'est jamais portée par la
      seule couleur (WCAG 1.4.1) : le badge est un libellé, pas une teinte.
    -->
    <p v-if="estConseiller" class="ep-bubble__entete">
      <span class="ep-badge">Conseiller</span>
      <span class="ep-bubble__auteur">{{ message.human_name }}</span>
    </p>

    <!-- Pièce jointe locale : aperçu data URL (jamais envoyé au backend) -->
    <figure v-if="message.attachment?.dataUrl" class="ep-bubble__piece">
      <img :src="message.attachment.dataUrl" :alt="`Aperçu de ${message.attachment.name}`" />
    </figure>

    <!-- Rendu riche : markdown rendu (gras/italique/listes/liens) OU html conservé
         s'il porte des liens (fallback WhatsApp). Boutons backend toujours retirés. -->
    <div v-if="!isUser && displayHtml" class="ep-bubble__html" v-html="displayHtml" />
    <!-- Rendu texte simple -->
    <template v-else>{{ message.content }}</template>

    <span v-if="!isUser && message.agent_used && !estConseiller" class="ep-bubble__meta">
      {{ agentLabel }}
    </span>

    <!--
      Signature sous chaque message : auteur • qualité • ancienneté, comme
      Intercom. L'heure exacte reste accessible en infobulle.
    -->
    <span class="ep-bubble__signature">
      <span :title="heureExacte">{{ signature }}</span>
      <button
        v-if="!isUser && message.content"
        type="button"
        class="ep-bubble__copy"
        :aria-label="copied ? 'Copié' : 'Copier le message'"
        @click="copy"
      >
        <svg v-if="!copied" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2" />
          <path
            d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { tempsRelatif } from '@/helpers/relativeTime'
import { htmlToText, renderMarkdown, sanitizeMessageHtml } from '@/helpers/sanitize'
import type { WidgetMessage } from '@/types/api'

const props = defineProps<{
  message: WidgetMessage
  /** Horloge de la vue : les libellés relatifs vieillissent sans re-rendu */
  maintenant?: number
}>()

const isUser = computed(() => props.message.role === 'user')

/** Message d'un conseiller humain identifié (nom réel fourni par le backend) */
const estConseiller = computed(() => Boolean(props.message.human_name))

/**
 * Priorité d'affichage côté agent :
 * 1. html backend contenant un <a> (fallback WhatsApp) → sanitisé tel quel
 * 2. sinon → texte markdown rendu (les ** du LLM deviennent du gras réel)
 */
const displayHtml = computed(() => {
  if (props.message.html && /<a[\s>]/.test(props.message.html)) {
    return sanitizeMessageHtml(props.message.html)
  }
  const source = props.message.html ? htmlToText(props.message.html) : props.message.content
  return source ? renderMarkdown(source) : ''
})

const heureExacte = computed(() => {
  const d = new Date(props.message.created_at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
})

/** « Mia • Agent IA • il y a 2 minutes » — ou « Vous • il y a 2 minutes » */
const signature = computed(() => {
  const auteur = isUser.value
    ? 'Vous'
    : estConseiller.value
      ? String(props.message.human_name)
      : 'Mia'
  const qualite = isUser.value ? null : estConseiller.value ? 'Conseiller' : 'Agent IA'
  const quand = tempsRelatif(props.message.created_at, props.maintenant)
  return [auteur, qualite, quand].filter(Boolean).join(' • ')
})

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard indisponible (permissions) — silencieux
  }
}

const agentLabel = computed(() => {
  const key = props.message.agent_used ?? ''
  return key
    .replace(/^sales-|^marketing-|^design-|^product-|^research-/, '')
    .replace(/-/g, ' ')
})
</script>
