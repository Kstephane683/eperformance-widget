<template>
  <div class="ep-input-zone">
    <!-- Barre emojis (pattern Intercom/Crisp, sans lib externe) -->
    <div v-if="emojiOpen" class="ep-emoji-bar" role="group" aria-label="Emojis">
      <button
        v-for="emoji in EMOJIS"
        :key="emoji"
        type="button"
        class="ep-emoji"
        :aria-label="`Insérer ${emoji}`"
        @click="insert(emoji)"
      >
        {{ emoji }}
      </button>
    </div>

    <form class="ep-input-bar" @submit.prevent="submit">
      <button
        type="button"
        class="ep-emoji-toggle"
        aria-label="Emojis"
        @click="emojiOpen = !emojiOpen"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
          <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="9" cy="10" r="1.1" fill="currentColor" />
          <circle cx="15" cy="10" r="1.1" fill="currentColor" />
        </svg>
      </button>
      <input
        ref="inputEl"
        v-model="draft"
        type="text"
        class="ep-input"
        :placeholder="placeholder"
        :disabled="disabled"
        aria-label="Votre message"
        @focus="notifyFocus(true)"
        @blur="notifyFocus(false)"
        @keydown.enter.exact.prevent="submit"
        @keydown.esc="emojiOpen = false"
      />
      <button type="submit" class="ep-send" :disabled="disabled || !draft.trim()" aria-label="Envoyer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"
            fill="currentColor"
          />
        </svg>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
// Adaptation de ChatInputWrap.vue (Chatwoot) — texte + emojis rapides,
// attachments reportés v2 (contrat V2, décision #5)
import { ref } from 'vue'

import { postToSdk } from '@/helpers/sdkBridge'

defineProps<{ disabled?: boolean; placeholder?: string }>()
const emit = defineEmits<{ send: [content: string] }>()

const EMOJIS = ['😊', '👍', '🙏', '🔥', '💪', '🚀', '❤️', '✅', '🤝', '📈', '😂', '🤔']

const draft = ref('')
const emojiOpen = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

// Focus/blur → le SDK relance son fix clavier au bon moment (iOS)
function notifyFocus(focused: boolean) {
  postToSdk({ event: focused ? 'input-focus' : 'input-blur' })
}

function insert(emoji: string) {
  draft.value += emoji
  inputEl.value?.focus()
}

function submit() {
  const content = draft.value.trim()
  if (!content) return
  emojiOpen.value = false
  emit('send', content)
  draft.value = ''
}
</script>

<style scoped>
/* Surface de la zone de saisie : recette de barre du site — fond --card,
   filet décoratif --border en haut, ombre --shadow-md (l'ancien dégradé
   d'ombre et le backdrop-filter inutile sont retirés : DESIGN-SYSTEM-UNIFIE
   §5.4). Le reste (.ep-input-bar, .ep-input, .ep-send) est global. */
.ep-input-zone {
  border-top: 1px solid var(--border);
  background: var(--card);
  box-shadow: var(--shadow-md);
}

.ep-emoji-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px 0;
}

.ep-emoji {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--arrondi-input);
  background: transparent;
  color: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--t) var(--ease-out);
}

.ep-emoji:hover {
  background: var(--gold-bg);
}

.ep-emoji-toggle {
  width: 40px;
  height: 44px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
  border-radius: var(--arrondi-input);
  transition: color var(--t) var(--ease-out), background-color var(--t) var(--ease-out);
}

/* Le site ne grossit pas ses boutons au survol : il change la couleur
   (eperf.css:617, 637). */
.ep-emoji-toggle:hover {
  color: var(--gold);
  background: var(--gold-bg);
}

/* Plein écran mobile (iframe) : respecter la barre home de l'iPhone */
@media (max-width: 668px) {
  .ep-input-zone {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
