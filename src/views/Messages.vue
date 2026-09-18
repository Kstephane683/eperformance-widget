<template>
  <div class="ep-vue">
    <h1 class="ep-vue__titre">Messages</h1>
    <p class="ep-vue__sous-titre">Votre conversation avec Mia et nos conseillers.</p>

    <p v-if="conversation.isRestoring" class="ep-etat">Reprise de la conversation…</p>

    <ul v-else class="ep-liste">
      <li>
        <button type="button" class="ep-ligne" @click="ouvrir">
          <span class="ep-pastille ep-pastille--pleine" aria-hidden="true">M</span>
          <span class="ep-ligne__corps">
            <span class="ep-ligne__titre">{{ titre }}</span>
            <span class="ep-ligne__texte">{{ apercu }}</span>
          </span>
          <span class="ep-ligne__meta">{{ quand }}</span>
          <svg
            class="ep-ligne__chevron"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet Messages — liste des conversations.
 *
 * v1 : une seule conversation (celle de ce visiteur, persistée en
 * localStorage et rechargée par GET /conversation). La structure de liste
 * (avatar, titre, aperçu, date relative, chevron) est déjà celle d'Intercom :
 * plusieurs conversations pourront s'y ajouter sans refonte.
 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { tempsRelatif } from '@/helpers/relativeTime'
import { useConversationStore } from '@/stores/conversation'
import { useMessagesStore } from '@/stores/messages'

const router = useRouter()
const conversation = useConversationStore()
const messages = useMessagesStore()

/** Dernier message connu — c'est lui qui donne l'aperçu et la date */
const dernier = computed(() => messages.messages.at(-1) ?? null)

const titre = computed(() => (messages.humanMode ? 'Mia et un conseiller' : 'Mia'))

const apercu = computed(() => {
  if (!dernier.value) return 'Démarrer la conversation'
  const prefixe = dernier.value.role === 'user' ? 'Vous : ' : ''
  return `${prefixe}${dernier.value.content}`
})

const quand = computed(() => tempsRelatif(dernier.value?.created_at))

function ouvrir() {
  router.push({ name: 'conversation' })
}

onMounted(() => {
  // Reprise après refresh : sans historique, la conversation reste vierge.
  void conversation.restore()
})
</script>
