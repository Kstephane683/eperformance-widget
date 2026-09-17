<template>
  <div class="ep-chat">
    <ChatHeader />

    <template v-if="conversation.isRestoring">
      <p class="ep-chat__notice">Reprise de la conversation…</p>
    </template>
    <template v-else>
      <ChatMessages
        :messages="messages.messages"
        :quick-replies="messages.quickReplies"
        :is-typing="messages.isTyping"
        :is-sending="messages.isSending"
        :failed-content="messages.failedContent"
        @quick-reply="messages.sendQuickReply($event)"
        @retry="messages.retryLast()"
      />
      <ChatInput :disabled="messages.isSending" @send="messages.sendMessage($event)" />
    </template>
  </div>
</template>

<script setup lang="ts">
// Vue conversation — branchements Pinia (Sprint 2) + composants adaptés (Sprint 4)
import { onMounted } from 'vue'

import ChatHeader from '@/components/ChatHeader.vue'
import ChatInput from '@/components/ChatInput.vue'
import ChatMessages from '@/components/ChatMessages.vue'
import { useConversationStore } from '@/stores/conversation'
import { useMessagesStore } from '@/stores/messages'

const conversation = useConversationStore()
const messages = useMessagesStore()

onMounted(() => {
  // Reprise après refresh : hydrate depuis GET /conversation si session existante
  conversation.restore().then((restored) => {
    if (!restored && !messages.messages.length) {
      messages.addLocal(
        'agent',
        "Bonjour 👋 Vous parlez maintenant avec Mia. Comment puis-je vous aider ?",
      )
    }
  })
})
</script>

<style scoped>
.ep-chat {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--bg);
}

.ep-chat__notice {
  margin: auto;
  color: var(--muted);
  font-size: 14px;
}
</style>
