<template>
  <div class="ep-bubble" :class="isUser ? 'ep-bubble--user' : 'ep-bubble--agent'">
    <!-- Rendu riche : markdown rendu (gras/italique/code) OU html conservé
         s'il porte des liens (fallback WhatsApp). Boutons backend toujours retirés. -->
    <div
      v-if="!isUser && displayHtml"
      class="ep-bubble__html"
      v-html="displayHtml"
    />
    <!-- Rendu texte simple -->
    <template v-else>{{ message.content }}</template>

    <span v-if="!isUser && message.agent_used" class="ep-bubble__meta">
      {{ agentLabel }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { htmlToText, renderMarkdown, sanitizeMessageHtml } from '@/helpers/sanitize'
import type { WidgetMessage } from '@/types/api'

const props = defineProps<{ message: WidgetMessage }>()

const isUser = computed(() => props.message.role === 'user')

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

const agentLabel = computed(() => {
  const key = props.message.agent_used ?? ''
  return key
    .replace(/^sales-|^marketing-|^design-|^product-|^research-/, '')
    .replace(/-/g, ' ')
})
</script>
