<template>
  <header class="ep-header">
    <div class="ep-header__avatar" aria-hidden="true">A</div>
    <div class="ep-header__id">
      <div class="ep-header__name">Mia</div>
      <div class="ep-header__status">
        <span class="ep-header__dot" aria-hidden="true" />
        Mia • Agent IA • En ligne
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
// (persona Mia servie par le backend Railway).
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

/* Mise en page seule : la typographie et la couleur du statut viennent du
   design system global (.ep-header__status dans src/style.css → --muted). */
.ep-header__status {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Pastille « en ligne » : état de succès → --green-text (eperf.css:192,265).
   L'animation porte l'information « en direct » : elle est légitime
   (DESIGN-SYSTEM-UNIFIE §4, règle 4). */
.ep-header__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green-text);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--green-text) 50%, transparent);
  animation: ep-online-pulse 2s infinite;
}

@keyframes ep-online-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--green-text) 50%, transparent);
  }
  70% {
    box-shadow: 0 0 0 7px color-mix(in srgb, var(--green-text) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--green-text) 0%, transparent);
  }
}

/* Bouton icône : recette .theme-toggle du site (eperf.css:623-637) */
.ep-header__close {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: var(--gold-bg);
  color: var(--gold);
  display: grid;
  place-items: center;
  transition: background-color var(--t) var(--ease-out), color var(--t) var(--ease-out);
}

.ep-header__close:hover {
  background: var(--gold-border);
}
</style>
