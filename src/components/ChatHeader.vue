<template>
  <header class="ep-header">
    <div class="ep-header__avatar" aria-hidden="true">A</div>
    <div class="ep-header__id">
      <div class="ep-header__name">Aminata</div>
      <div class="ep-header__status">Coach acquisition client · ePerformance</div>
    </div>
    <button type="button" class="ep-header__close" aria-label="Fermer le chat" @click="close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
    </button>
  </header>
</template>

<script setup lang="ts">
// Adaptation de ChatHeader.vue (Chatwoot) — identité IA ePerformance
// (persona Aminata servie par le backend Railway).
// Le bouton fermer est indispensable en mobile plein écran : la bubble
// est masquée quand le widget est ouvert (chevauchait l'input).
import { postToSdk } from '@/helpers/sdkBridge'

function close() {
  // Le SDK ferme le holder (et notifie le widget via postMessage 'close',
  // reçu par App.vue → router retourne à l'accueil)
  postToSdk({ event: 'close' })
}
</script>

<style scoped>
.ep-header__id {
  flex: 1;
  min-width: 0;
}

.ep-header__close {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: rgba(201, 169, 110, 0.12);
  color: var(--ep-gold);
  display: grid;
  place-items: center;
  transition: background 0.2s ease;
}

.ep-header__close:hover {
  background: rgba(201, 169, 110, 0.25);
}
</style>
