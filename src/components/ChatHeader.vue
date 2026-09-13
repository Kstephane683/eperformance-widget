<template>
  <header class="ep-header">
    <div class="ep-header__avatar" aria-hidden="true">A</div>
    <div class="ep-header__id">
      <div class="ep-header__name">Aminata</div>
      <div class="ep-header__status">
        <span class="ep-header__dot" aria-hidden="true" />
        En ligne · répond en quelques instants
      </div>
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
// Pastille "En ligne" : pattern Intercom/Crisp (confiance instantanée).
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

.ep-header__status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ep-text-muted);
}

.ep-header__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34c77b;
  box-shadow: 0 0 0 0 rgba(52, 199, 123, 0.5);
  animation: ep-online-pulse 2s infinite;
}

@keyframes ep-online-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(52, 199, 123, 0.5);
  }
  70% {
    box-shadow: 0 0 0 7px rgba(52, 199, 123, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(52, 199, 123, 0);
  }
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
