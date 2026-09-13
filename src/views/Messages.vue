<template>
  <div class="widget-messages">
    <p>Vue Messages — placeholder Sprint 1. Store Pinia + API Railway arrivent aux Sprints 2-3.</p>
    <button type="button" @click="goHome">Retour</button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
function goHome() {
  router.push({ name: 'home' })
}
</script>
