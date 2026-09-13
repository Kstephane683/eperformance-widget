<template>
  <router-view />
</template>

<script setup lang="ts">
// Widget ePerformance — root component (extraction Chatwoot, adapté Railway)
// Le SDK (site hôte) pilote open/close via postMessage : le router suit.
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

import { initSdkBridge, notifyReady, postToSdk } from '@/helpers/sdkBridge'
import { useConversationStore } from '@/stores/conversation'

const router = useRouter()
const conversation = useConversationStore()

let cleanup: (() => void) | null = null

onMounted(() => {
  cleanup = initSdkBridge({
    onOpen: () => router.push({ name: 'messages' }),
    onClose: () => router.push({ name: 'home' }),
    onIdentify: (userId, userData) => conversation.identify(userId, userData),
  })
  // Échap ferme le widget (le focus est souvent dans l'iframe)
  window.addEventListener('keydown', onEscape)
  notifyReady()
})

onUnmounted(() => {
  cleanup?.()
  window.removeEventListener('keydown', onEscape)
})

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && router.currentRoute.value.name === 'messages') {
    postToSdk({ event: 'close' })
  }
}
</script>
