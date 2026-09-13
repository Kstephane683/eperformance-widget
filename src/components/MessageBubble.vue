<template>
  <div class="ep-bubble" :class="isUser ? 'ep-bubble--user' : 'ep-bubble--agent'">
    <!-- Rendu riche : HTML backend sanitisé (boutons backend retirés, suggestions = JSON) -->
    <div v-if="message.html && !isUser" class="ep-bubble__html" v-html="sanitizedHtml" />
    <!-- Rendu texte simple -->
    <template v-else>{{ message.content }}</template>

    <span v-if="!isUser && message.agent_used" class="ep-bubble__meta">
      {{ agentLabel }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { sanitizeMessageHtml } from '@/helpers/sanitize'
import type { WidgetMessage } from '@/types/api'

const props = defineProps<{ message: WidgetMessage }>()

const isUser = computed(() => props.message.role === 'user')
const sanitizedHtml = computed(() =>
  props.message.html ? sanitizeMessageHtml(props.message.html) : '',
)
const agentLabel = computed(() => {
  const key = props.message.agent_used ?? ''
  return key
    .replace(/^sales-|^marketing-|^design-|^product-|^research-/, '')
    .replace(/-/g, ' ')
})
</script>
