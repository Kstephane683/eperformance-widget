<template>
  <div ref="scroller" class="ep-messages">
    <MessageBubble v-for="message in messages" :key="message.id" :message="message" />
    <TypingIndicator v-if="isTyping" />
    <QuickReplies
      v-if="!isTyping && !isSending"
      :quick-replies="quickReplies"
      :disabled="isSending"
      @select="$emit('quick-reply', $event)"
    />
  </div>
</template>

<script setup lang="ts">
// Adaptation de ConversationWrap.vue (Chatwoot) — scroll auto vers le bas
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
}>()

defineEmits<{ 'quick-reply': [value: string] }>()

const scroller = ref<HTMLElement | null>(null)

watch(
  () => [props.messages.length, props.isTyping, props.quickReplies.length],
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
  gap: 10px;
  padding: 16px 12px 20px;
  overflow-y: auto;
}
</style>
