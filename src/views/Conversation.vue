<template>
  <div class="ep-chat">
    <template v-if="conversation.isRestoring">
      <p class="ep-chat__notice" role="status">Reprise de la conversation…</p>
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
      <ChatInput :disabled="messages.isSending" @send="envoyer" />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Écran Conversation — fil de messages + zone de saisie complète.
 * Le header (retour / avatar Mia / sous-titre / menu / fermer) est rendu par
 * AppHeader : il reste sticky au-dessus de cet écran.
 */
import { onMounted } from 'vue'

import ChatInput from '@/components/ChatInput.vue'
import ChatMessages from '@/components/ChatMessages.vue'
import { useConversationStore } from '@/stores/conversation'
import { useIntentStore } from '@/stores/intent'
import { useMessagesStore } from '@/stores/messages'
import type { MessageAttachment } from '@/types/api'

const conversation = useConversationStore()
const messages = useMessagesStore()
const intent = useIntentStore()

function envoyer(payload: { content: string; attachment: MessageAttachment | null }) {
  // sendMessage peut rejeter (réseau) : le store a déjà posé le fallback,
  // on évite une promesse non capturée.
  void messages.sendMessage(payload.content, payload.attachment).catch(() => undefined)
}

onMounted(() => {
  // Reprise après refresh : hydrate depuis GET /conversation si session existante
  void conversation.restore().then(async (restored) => {
    if (!restored && !messages.messages.length) {
      messages.addLocal(
        'agent',
        'Bonjour 👋 Vous parlez maintenant avec Mia. Comment puis-je vous aider ?',
      )
    }
    // Intention venue de l'accueil : message pré-rempli (suggestion cliquée)
    const attente = intent.consommerMessage()
    if (attente) {
      await messages.sendMessage(attente).catch(() => undefined)
    }
  })
})
</script>

<style scoped>
.ep-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg);
}

.ep-chat__notice {
  margin: auto;
  color: var(--muted);
  font-size: 14px;
}
</style>
