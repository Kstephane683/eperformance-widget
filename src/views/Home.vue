<template>
  <div class="widget-home">
    <h1>ePerformance</h1>
    <p>Widget v1 — Sprint 1 (setup). Les composants Chatwoot seront adaptés au Sprint 4.</p>
    <button type="button" @click="goToMessages">Ouvrir la conversation</button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
function goToMessages() {
  router.push({ name: 'messages' })
}
</script>
