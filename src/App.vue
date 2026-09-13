<template>
  <router-view />
</template>

<script setup lang="ts">
// Widget ePerformance — root component (extraction Chatwoot, adapté Railway)
// Le SDK (site hôte) pilote open/close via postMessage : le router suit.
import { onMounted, onUnmounted } from 'vue'

import { useRouter } from 'vue-router'

import { initSdkBridge, notifyReady } from '@/helpers/sdkBridge'
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
  notifyReady()
})

onUnmounted(() => cleanup?.())
</script>
