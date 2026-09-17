<template>
  <div ref="scroller" class="ep-messages">
    <template v-for="(message, index) in messages" :key="message.id">
      <!-- Séparateur de jour (pattern Intercom) quand le jour change -->
      <div v-if="dayLabel(index)" class="ep-day-separator">
        <span>{{ dayLabel(index) }}</span>
      </div>
      <MessageBubble :message="message" />
    </template>

    <TypingIndicator v-if="isTyping" />

    <!-- Réessayer après échec réseau (avant le fallback WhatsApp silencieux) -->
    <div v-if="failedContent && !isSending" class="ep-retry">
      <button type="button" class="ep-retry__btn" @click="$emit('retry')">
        ↻ Réessayer
      </button>
    </div>

    <QuickReplies
      v-if="!isTyping && !isSending"
      :quick-replies="quickReplies"
      :disabled="isSending"
      @select="$emit('quick-reply', $event)"
    />
  </div>
</template>

<script setup lang="ts">
// Adaptation de ConversationWrap.vue (Chatwoot) — scroll auto vers le bas,
// séparateurs de jour, bouton Réessayer après échec réseau.
import { nextTick, ref, watch } from 'vue'

import MessageBubble from './MessageBubble.vue'
import QuickReplies from './QuickReplies.vue'
import TypingIndicator from './TypingIndicator.vue'
import type { WidgetMessage } from '@/types/api'

const props = defineProps<{
  messages: WidgetMessage[]
  quickReplies: string[]
  isTyping: boolean
  isSending: boolean
  failedContent: string | null
}>()

defineEmits<{ 'quick-reply': [value: string]; retry: [] }>()

const scroller = ref<HTMLElement | null>(null)

/** "Aujourd'hui" / "Hier" / date locale — null si même jour que le message précédent */
function dayLabel(index: number): string | null {
  const current = new Date(props.messages[index]?.created_at ?? '')
  if (Number.isNaN(current.getTime())) return null
  if (index > 0) {
    const previous = new Date(props.messages[index - 1]?.created_at ?? '')
    if (
      !Number.isNaN(previous.getTime()) &&
      current.toDateString() === previous.toDateString()
    ) {
      return null
    }
  }
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (current.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (current.toDateString() === yesterday.toDateString()) return 'Hier'
  return current.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

watch(
  () => [props.messages.length, props.isTyping, props.quickReplies.length, props.failedContent],
  async () => {
    await nextTick()
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
    // Rattrapage : les quick replies rendus après le smooth peuvent laisser
    // quelques px — on force le bas une fois l'animation terminée
    setTimeout(() => {
      scroller.value?.scrollTo({ top: scroller.value.scrollHeight })
    }, 400)
  },
)
</script>

<style scoped>
.ep-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 12px 24px;
  overflow-y: auto;
}

.ep-day-separator {
  display: flex;
  justify-content: center;
  margin: 6px 0 4px;
}

.ep-day-separator span {
  font-size: 11px;
  color: var(--muted);
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bouton);
  padding: 4px 12px;
}

.ep-retry {
  display: flex;
  justify-content: center;
}

/* Variante de .btn-outline (eperf.css:518-523) : filet d'accent, texte or */
.ep-retry__btn {
  padding: 8px 16px;
  border-radius: var(--arrondi-bouton);
  border: 1px solid var(--gold-border);
  background: var(--gold-bg);
  color: var(--gold);
  font-weight: 600;
  font-size: 13px;
  transition: background-color var(--t) var(--ease-out),
              border-color var(--t) var(--ease-out);
}

.ep-retry__btn:hover {
  background: var(--card2);
  border-color: var(--gold);
}
</style>
