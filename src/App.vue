<template>
  <!--
    Structure du widget (tâche 6.2-bis) : header sticky + zone de contenu
    défilante + barre d'onglets — la disposition d'Intercom.
    Le panneau des onglets porte role="tabpanel" et pointe vers l'onglet actif
    (aria-labelledby) ; l'écran Conversation n'est pas un panneau d'onglet.
  -->
  <div class="ep-app">
    <AppHeader />

    <main
      v-if="estOnglet"
      :id="`ep-panel-${nomRoute}`"
      class="ep-corps"
      role="tabpanel"
      :aria-labelledby="`ep-tab-${nomRoute}`"
      tabindex="-1"
    >
      <router-view />
    </main>
    <div v-else class="ep-corps">
      <router-view />
    </div>

    <TabBar v-if="afficherOnglets" />
  </div>
</template>

<script setup lang="ts">
// Widget ePerformance — root component (extraction Chatwoot, adapté Railway).
// Le SDK (site hôte) pilote open/close via postMessage : le router suit.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import TabBar from '@/components/TabBar.vue'
import { initSdkBridge, notifyReady, postToSdk } from '@/helpers/sdkBridge'
import { useConversationStore } from '@/stores/conversation'

/** Les quatre onglets — l'écran Conversation n'en fait pas partie */
const ONGLETS = ['home', 'messages', 'aide', 'actualites'] as const
const MOBILE_QUERY = '(max-width: 668px)'

const route = useRoute()
const router = useRouter()
const conversation = useConversationStore()

/** Nom de route sous forme de chaîne (un nom peut être un symbole) */
const nomRoute = computed(() => String(route.name ?? ''))

const estOnglet = computed(() => ONGLETS.includes(nomRoute.value as (typeof ONGLETS)[number]))

/**
 * Barre d'onglets : toujours visible sur les écrans d'onglet ; sur l'écran
 * Conversation elle reste visible en mobile (Intercom y garde la navigation)
 * et s'efface en desktop, où le retour du header suffit.
 */
const estMobile = ref(false)
const afficherOnglets = computed(
  () => estOnglet.value || (route.name === 'conversation' && estMobile.value),
)

/** Gabarit annoncé par le SDK dans l'URL (null en développement direct) */
const viewportInitial = (() => {
  if (typeof window === 'undefined') return null
  const valeur = new URLSearchParams(window.location.search).get('viewport')
  return valeur === 'mobile' || valeur === 'desktop' ? valeur : null
})()

let media: MediaQueryList | null = null
let cleanup: (() => void) | null = null

function onMediaChange(e: MediaQueryListEvent | MediaQueryList) {
  estMobile.value = e.matches
}

onMounted(() => {
  // Le SDK pose `viewport` au chargement puis à chaque changement : c'est lui
  // qui fait foi dans l'iframe (l'iframe ne fait que 400 px sur un desktop,
  // une requête média locale la croirait mobile). Hors iframe (dev direct du
  // widget), la requête média locale sert de repli.
  if (viewportInitial) {
    estMobile.value = viewportInitial === 'mobile'
  } else if (typeof window.matchMedia === 'function') {
    media = window.matchMedia(MOBILE_QUERY)
    onMediaChange(media)
    media.addEventListener('change', onMediaChange)
  }

  cleanup = initSdkBridge({
    // Ouverture : le widget s'ouvre sur l'accueil (défaut d'Intercom)
    onOpen: () => router.push({ name: 'home' }),
    onClose: () => router.push({ name: 'home' }),
    onIdentify: (userId, userData) => conversation.identify(userId, userData),
    onViewport: (viewport) => {
      estMobile.value = viewport === 'mobile'
    },
  })
  // Échap ferme le widget (le focus est souvent dans l'iframe)
  window.addEventListener('keydown', onEscape)
  notifyReady()
})

onUnmounted(() => {
  cleanup?.()
  window.removeEventListener('keydown', onEscape)
  media?.removeEventListener('change', onMediaChange)
})

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    postToSdk({ event: 'close' })
  }
}
</script>

<style scoped>
.ep-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg);
}

/* Zone centrale : le seul élément qui défile (header et onglets fixes) */
.ep-corps {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ep-corps:focus {
  outline: none;
}
</style>
