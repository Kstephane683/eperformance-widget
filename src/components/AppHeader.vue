<template>
  <!--
    Header du widget — sticky (hors du flux de défilement), toujours visible.
    Deux variantes, comme Intercom :
      · « tabs »         : logo + équipe (3 avatars) + fermer
      · « conversation » : retour + avatar Mia + sous-titre + menu (⋯) + fermer
  -->
  <header class="ep-header">
    <button
      v-if="estConversation"
      type="button"
      class="ep-header__retour"
      aria-label="Revenir à la liste des conversations"
      @click="retour"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M14.5 5.5 8 12l6.5 6.5"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <BrandLogo v-if="!estConversation" />

    <div class="ep-header__id">
      <template v-if="estConversation">
        <span class="ep-header__avatar" aria-hidden="true">M</span>
        <span class="ep-header__identite">
          <span class="ep-header__name">Mia</span>
          <span class="ep-header__status">
            <span class="ep-header__dot" aria-hidden="true" />
            Agent IA · en ligne
          </span>
        </span>
      </template>

      <!-- Équipe : trois avatars circulaires (Intercom affiche les visages
           disponibles). Le widget n'embarque aucune photo : les initiales
           reprennent la pastille « KS » du blog (eperf.css .quote-avatar),
           sans requête externe ni poids de bundle. -->
      <ul v-else class="ep-header__equipe" aria-label="L'équipe ePerformance">
        <li v-for="membre in EQUIPE" :key="membre.initiales" :title="membre.titre">
          <span class="ep-header__mini" :class="`ep-header__mini--${membre.ton}`" aria-hidden="true">
            {{ membre.initiales }}
          </span>
          <span class="ep-visually-hidden">{{ membre.titre }}</span>
        </li>
      </ul>
    </div>

    <div v-if="estConversation" class="ep-header__menu">
      <button
        type="button"
        class="ep-header__icone"
        aria-haspopup="menu"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        aria-label="Plus d’options"
        @click="menuOpen = !menuOpen"
        @keydown.esc="menuOpen = false"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" fill="currentColor" />
          <circle cx="12" cy="12" r="1.7" fill="currentColor" />
          <circle cx="19" cy="12" r="1.7" fill="currentColor" />
        </svg>
      </button>
      <ul v-if="menuOpen" ref="menuEl" class="ep-menu" role="menu" aria-label="Options de la conversation">
        <li role="none">
          <button type="button" role="menuitem" class="ep-menu__item" @click="nouvelleConversation">
            Nouvelle conversation
          </button>
        </li>
        <li role="none">
          <a
            role="menuitem"
            class="ep-menu__item"
            href="https://eperformance.pro/politique-confidentialite.html"
            target="_blank"
            rel="noopener"
          >
            Politique de confidentialité
          </a>
        </li>
        <li v-if="!estApplication" role="none">
          <button type="button" role="menuitem" class="ep-menu__item" @click="fermer">
            Fermer le chat
          </button>
        </li>
      </ul>
    </div>

    <!-- Le bouton de fermeture n'a pas de sens en mode application : le
         document EST l'application, il n'y a pas de widget à refermer. -->
    <button
      v-if="!estApplication"
      type="button"
      class="ep-header__icone"
      aria-label="Fermer le chat"
      @click="fermer"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </header>
</template>

<script setup lang="ts">
// Header du widget (tâche 6.2-bis) — remplace ChatHeader.vue, qui ne portait
// que la variante conversation.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BrandLogo from '@/components/BrandLogo.vue'
import { estDansIframe } from '@/helpers/environnement'
import { postToSdk } from '@/helpers/sdkBridge'
import { useConversationStore } from '@/stores/conversation'

const route = useRoute()
const router = useRouter()
const conversation = useConversationStore()

/**
 * Mode application (tâche 6.4) : le document est de premier niveau — c'est
 * l'application Mia installée ou ouverte directement, et non le panneau
 * injecté dans un site hôte. Le bouton « Fermer le chat » y disparaît : il n'y
 * a pas de widget à refermer, seulement un onglet ou une fenêtre à quitter.
 */
const estApplication = !estDansIframe()

/** La variante suit l'écran affiché : un seul header, toujours visible. */
const estConversation = computed(() => route.name === 'conversation')

const menuOpen = ref(false)
const menuEl = ref<HTMLElement | null>(null)

// Changer d'écran referme le menu (le routeur ne remonte pas le header)
watch(estConversation, () => {
  menuOpen.value = false
})

/**
 * Équipe affichée en avatars : la persona qui répond (Mia) et les deux
 * identités publiques du blog (l'auteur, l'équipe). Aucune photo inventée.
 */
const EQUIPE = [
  { initiales: 'M', titre: 'Mia — agent IA ePerformance', ton: 'whatsapp' as const },
  { initiales: 'KS', titre: 'K. Stéphane — fondateur ePerformance', ton: 'or' as const },
  { initiales: 'EP', titre: 'L’équipe ePerformance', ton: 'neutre' as const },
]

function fermer() {
  // Le SDK ferme le holder (et notifie le widget via postMessage 'close',
  // reçu par App.vue → retour à l'accueil)
  postToSdk({ event: 'close' })
}

function retour() {
  router.push({ name: 'messages' })
}

function nouvelleConversation() {
  menuOpen.value = false
  conversation.reset()
  router.push({ name: 'conversation' })
}

function onClicExterieur(evenement: MouseEvent) {
  if (!menuOpen.value) return
  const cible = evenement.target as Node | null
  if (cible && menuEl.value?.contains(cible)) return
  menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onClicExterieur)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClicExterieur)
})
</script>

<style scoped>
/* Recette .site-header (eperf.css:543-551) : surface à 92 % + flou */
.ep-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--card) 92%, transparent);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  flex-shrink: 0;
  z-index: 2;
}

.ep-header__id {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.ep-header__identite {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Avatar de l'agent : aplat d'accent + --on-gold (jamais de dégradé) */
.ep-header__avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--gold);
  color: var(--on-gold);
  display: grid;
  place-items: center;
  font-family: var(--police-titres);
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

/* Pastille « en ligne » : état de succès → --green-text (eperf.css:265) */
.ep-header__status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}

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

.ep-header__name {
  font-family: var(--police-titres);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

/* --- Équipe (3 avatars) --------------------------------------------- */
.ep-header__equipe {
  display: flex;
  align-items: center;
  list-style: none;
  margin-left: auto;
  padding-right: 4px;
}

.ep-header__equipe li + li {
  margin-left: -10px;
}

/* Recette .quote-avatar (eperf.css:960-971) : pastille d'initiales */
.ep-header__mini {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  border: 2px solid var(--card);
  background: var(--gold-bg);
  color: var(--gold);
}

.ep-header__mini--or {
  background: var(--gold);
  color: var(--on-gold);
}

.ep-header__mini--neutre {
  background: var(--card2);
  color: var(--soft);
  border-color: var(--card);
  box-shadow: inset 0 0 0 1px var(--border);
}

/* --- Boutons icônes : recette .theme-toggle (eperf.css:623-637) ------ */
.ep-header__icone,
.ep-header__retour {
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

.ep-header__icone:hover,
.ep-header__retour:hover {
  background: var(--gold-border);
}

/* --- Menu (⋯) -------------------------------------------------------- */
.ep-header__menu {
  position: relative;
  flex-shrink: 0;
}

.ep-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 210px;
  padding: 6px;
  list-style: none;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bloc);
  box-shadow: var(--shadow-md);
  z-index: 5;
}

.ep-menu__item {
  display: block;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: var(--arrondi-input);
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 13.5px;
  text-align: left;
  text-decoration: none;
  transition: background-color var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out);
}

.ep-menu__item:hover {
  background: var(--gold-bg);
  color: var(--gold);
}
</style>
