<template>
  <form class="ep-input-bar" @submit.prevent="submit">
    <input
      v-model="draft"
      type="text"
      class="ep-input"
      :placeholder="placeholder"
      :disabled="disabled"
      aria-label="Votre message"
      @focus="notifyFocus(true)"
      @blur="notifyFocus(false)"
      @keydown.enter.exact.prevent="submit"
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
</template>

<script setup lang="ts">
// Adaptation de ChatInputWrap.vue (Chatwoot) — simplifié : texte seul,
// attachments reportés v2 (contrat V2, décision #5)
import { ref } from 'vue'

import { postToSdk } from '@/helpers/sdkBridge'

defineProps<{ disabled?: boolean; placeholder?: string }>()
const emit = defineEmits<{ send: [content: string] }>()

const draft = ref('')

// Focus/blur → le SDK relance son fix clavier au bon moment (iOS)
function notifyFocus(focused: boolean) {
  postToSdk({ event: focused ? 'input-focus' : 'input-blur' })
}

function submit() {
  const content = draft.value.trim()
  if (!content) return
  emit('send', content)
  draft.value = ''
}
</script>
