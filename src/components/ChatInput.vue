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
        😊
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
.ep-input-zone {
  border-top: 1px solid var(--ep-border);
  background: #101014;
  backdrop-filter: blur(12px);
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.45);
}

.ep-emoji-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 8px 12px 0;
}

.ep-emoji {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

.ep-emoji:hover {
  background: rgba(201, 169, 110, 0.12);
  transform: scale(1.15);
}

.ep-input-bar {
  display: flex;
  gap: 8px;
  padding: 12px;
  align-items: center;
}

.ep-emoji-toggle {
  width: 40px;
  height: 44px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  border-radius: 10px;
  transition: transform 0.15s ease;
}

.ep-emoji-toggle:hover {
  transform: scale(1.15);
}

.ep-input {
  flex: 1;
  padding: 12px 16px;
  border-radius: var(--ep-radius-full);
  border: 1px solid var(--ep-border);
  background: #060609;
  color: var(--ep-text);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ep-input::placeholder {
  color: var(--ep-text-muted);
}

.ep-input:hover {
  border-color: rgba(201, 169, 110, 0.45);
}

.ep-input:focus-visible {
  border-color: var(--ep-gold);
  box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.15);
}

.ep-send {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
  display: grid;
  place-items: center;
  transition: transform 0.15s ease, opacity 0.2s ease;
}

.ep-send:hover:not(:disabled) {
  transform: scale(1.05);
}

.ep-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Plein écran mobile (iframe) : respecter la barre home de l'iPhone */
@media (max-width: 668px) {
  .ep-input-zone {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
