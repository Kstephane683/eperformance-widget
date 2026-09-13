<template>
  <div v-if="quickReplies.length" class="ep-quick-replies" role="group" aria-label="Suggestions">
    <button
      v-for="reply in quickReplies"
      :key="reply"
      type="button"
      class="ep-quick-reply"
      :disabled="disabled"
      @click="$emit('select', reply)"
    >
      {{ reply }}
    </button>
  </div>
</template>

<script setup lang="ts">
// Boutons natifs depuis metadata.suggestions (contrat V2) — remplace
// le parsing des onclick="window.deepChatSendMessage(...)" du backend
defineProps<{ quickReplies: string[]; disabled?: boolean }>()
defineEmits<{ select: [value: string] }>()
</script>
