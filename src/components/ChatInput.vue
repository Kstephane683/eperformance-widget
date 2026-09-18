<template>
  <div class="ep-input-zone">
    <!-- Aperçu de la pièce jointe : data URL locale, jamais transmise au serveur -->
    <div v-if="attachment" class="ep-piece" role="status">
      <img v-if="attachment.dataUrl" :src="attachment.dataUrl" alt="" class="ep-piece__apercu" />
      <span v-else class="ep-piece__icone" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M13.5 6.5 8 12a3.5 3.5 0 0 0 5 5l6-6a5 5 0 0 0-7.1-7.1l-6 6a6.5 6.5 0 0 0 9.2 9.2l3.4-3.4"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
      </span>
      <span class="ep-piece__nom">{{ attachment.name }}</span>
      <button
        type="button"
        class="ep-piece__retirer"
        aria-label="Retirer la pièce jointe"
        @click="retirerPiece"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

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

    <p v-if="messageDictee" class="ep-dictee" role="status">{{ messageDictee }}</p>

    <form class="ep-input-bar" @submit.prevent="submit">
      <!-- Pièce jointe : aucun endpoint d'upload (contrat V2, décision #5).
           Le fichier reste local ; seul son nom part dans le message. -->
      <input
        ref="fileEl"
        type="file"
        class="ep-visually-hidden"
        accept="image/*,.pdf,.txt,.doc,.docx,.csv,.xls,.xlsx"
        tabindex="-1"
        @change="onFichier"
      />
      <button
        type="button"
        class="ep-action"
        aria-label="Joindre un fichier"
        title="Joindre un fichier"
        @click="fileEl?.click()"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M13.5 6.5 8 12a3.5 3.5 0 0 0 5 5l6-6a5 5 0 0 0-7.1-7.1l-6 6a6.5 6.5 0 0 0 9.2 9.2l3.4-3.4"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <button
        type="button"
        class="ep-action"
        :class="{ 'ep-action--active': emojiOpen }"
        :aria-label="emojiOpen ? 'Masquer les emojis' : 'Afficher les emojis'"
        :aria-expanded="emojiOpen ? 'true' : 'false'"
        title="Emojis"
        @click="emojiOpen = !emojiOpen"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
          <path
            d="M8.5 14.5a4.5 4.5 0 0 0 7 0"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <circle cx="9" cy="10" r="1.1" fill="currentColor" />
          <circle cx="15" cy="10" r="1.1" fill="currentColor" />
        </svg>
      </button>

      <!--
        GIF : écart assumé (tâche 6.2-bis). Une recherche de GIF impose une
        dépendance externe (API Giphy/Tenor) et des contenus sous licence :
        aucun des deux n'est acceptable ici. L'icône reste visible mais
        annoncée indisponible — aria-disabled + infobulle + description
        lecteur d'écran. Aucune UI factice, aucun bouton qui ne fait rien
        sans le dire.
      -->
      <button
        type="button"
        class="ep-action ep-action--indisponible"
        aria-disabled="true"
        :aria-describedby="`${idGif}-aide`"
        title="Recherche de GIF indisponible dans cette version"
        @click.prevent
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="3"
            y="4.5"
            width="18"
            height="15"
            rx="2.5"
            stroke="currentColor"
            stroke-width="1.7"
          />
          <path d="M6.6 9.4h1.5v5.2H6.6z" fill="currentColor" />
          <path
            d="M9.6 9.4h1.5v5.2H9.6zM12 9.4h3v1.4h-1.5v.9h1.3v1.3h-1.3v1.6H12z"
            fill="currentColor"
          />
        </svg>
      </button>
      <span :id="`${idGif}-aide`" class="ep-visually-hidden">
        Recherche de GIF indisponible : cette version n'intègre aucun service tiers.
      </span>

      <!-- Dictée : Web Speech API, sans dépendance. Si le navigateur ne
           l'expose pas, le bouton est annoncé indisponible (jamais factice). -->
      <button
        type="button"
        class="ep-action"
        :class="{ 'ep-action--ecoute': ecoute }"
        :aria-disabled="dicteeDispo ? 'false' : 'true'"
        :aria-label="
          dicteeDispo ? (ecoute ? 'Arrêter la dictée' : 'Dicter mon message') : DICTEE_INDISPONIBLE
        "
        :title="dicteeDispo ? 'Dicter mon message' : DICTEE_INDISPONIBLE"
        @click="basculerDictee"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="9"
            y="3"
            width="6"
            height="10.5"
            rx="3"
            stroke="currentColor"
            stroke-width="1.7"
          />
          <path
            d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
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

      <button
        type="submit"
        class="ep-send"
        :disabled="disabled || !peutEnvoyer"
        aria-label="Envoyer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"
            fill="currentColor"
          />
        </svg>
      </button>
    </form>

    <p class="ep-legal">
      <a href="https://eperformance.pro/politique-confidentialite.html" target="_blank" rel="noopener">
        Politique de confidentialité
      </a>
    </p>
  </div>
</template>

<script setup lang="ts">
// Zone de saisie (tâche 6.2-bis) — texte, emojis, pièce jointe locale,
// dictée vocale. Adaptée de ChatInputWrap.vue (Chatwoot).
import { computed, onMounted, ref, useId } from 'vue'

import { postToSdk } from '@/helpers/sdkBridge'
import { creerDictee, DICTEE_INDISPONIBLE, dicteeDisponible, type Dictee } from '@/helpers/speech'
import { useIntentStore } from '@/stores/intent'
import type { MessageAttachment } from '@/types/api'

defineProps<{ disabled?: boolean; placeholder?: string }>()
const emit = defineEmits<{
  send: [payload: { content: string; attachment: MessageAttachment | null }]
}>()

const EMOJIS = ['😊', '👍', '🙏', '🔥', '💪', '🚀', '❤️', '✅', '🤝', '📈', '😂', '🤔']

const draft = ref('')
const emojiOpen = ref(false)
const attachment = ref<MessageAttachment | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const fileEl = ref<HTMLInputElement | null>(null)
const idGif = useId()

/* ---------- Pièce jointe (locale, jamais transmise) ---------- */

function lireDataUrl(fichier: File): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const lecteur = new FileReader()
      lecteur.onload = () => resolve(typeof lecteur.result === 'string' ? lecteur.result : null)
      lecteur.onerror = () => resolve(null)
      lecteur.readAsDataURL(fichier)
    } catch {
      resolve(null)
    }
  })
}

async function onFichier(evenement: Event) {
  const champ = evenement.target as HTMLInputElement
  const fichier = champ.files?.[0]
  if (!fichier) return
  // Une image porte un aperçu local ; tout autre fichier n'affiche que son nom.
  const dataUrl = fichier.type.startsWith('image/') ? await lireDataUrl(fichier) : null
  attachment.value = { name: fichier.name, dataUrl }
  champ.value = ''
  inputEl.value?.focus()
}

function retirerPiece() {
  attachment.value = null
}

/* ---------- Dictée vocale ---------- */

const dicteeDispo = dicteeDisponible()
const ecoute = ref(false)
const messageDictee = ref('')
let dictee: Dictee | null = null

function basculerDictee() {
  if (!dicteeDispo) {
    messageDictee.value = DICTEE_INDISPONIBLE
    return
  }
  if (!dictee) {
    dictee = creerDictee({
      onTexte: (texte, definitif) => {
        // La transcription alimente le champ : les résultats intermédiaires
        // sont réécrits, le résultat final est conservé tel quel.
        draft.value = texte
        if (definitif) {
          ecoute.value = false
          messageDictee.value = ''
        }
      },
      onEtat: (etat, message) => {
        ecoute.value = etat === 'ecoute'
        messageDictee.value =
          etat === 'erreur' ? (message ?? '') : etat === 'ecoute' ? 'Dictée en cours…' : ''
      },
    })
  }
  if (ecoute.value) {
    dictee?.arreter()
  } else {
    messageDictee.value = ''
    dictee?.demarrer()
  }
}

/* ---------- Envoi ---------- */

/** Le bouton d'envoi reste inactif tant qu'il n'y a ni texte ni pièce jointe */
const peutEnvoyer = computed(() => Boolean(draft.value.trim() || attachment.value))

function insert(emoji: string) {
  draft.value += emoji
  inputEl.value?.focus()
}

// Focus/blur → le SDK relance son fix clavier au bon moment (iOS)
function notifyFocus(focused: boolean) {
  postToSdk({ event: focused ? 'input-focus' : 'input-blur' })
}

function submit() {
  if (!peutEnvoyer.value) return
  emojiOpen.value = false
  emit('send', { content: draft.value.trim(), attachment: attachment.value })
  draft.value = ''
  attachment.value = null
  dictee?.arreter()
}

/** « Poser une question » (Accueil) : le champ prend le focus à l'arrivée */
const intent = useIntentStore()
onMounted(() => {
  if (intent.consommerFocus()) {
    inputEl.value?.focus()
  }
})

defineExpose({ focus: () => inputEl.value?.focus() })
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
  padding: 8px 10px 0;
}

.ep-emoji {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: var(--arrondi-input);
  background: transparent;
  color: inherit;
  font-size: 19px;
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--t) var(--ease-out);
}

.ep-emoji:hover {
  background: var(--gold-bg);
}

/* Icônes d'action : 34 px pour tenir 4 boutons + champ + envoi sur 360 px */
.ep-action {
  width: 34px;
  height: 40px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: var(--arrondi-input);
  display: grid;
  place-items: center;
  transition: color var(--t) var(--ease-out), background-color var(--t) var(--ease-out);
}

/* Le site ne grossit pas ses boutons au survol : il change la couleur
   (eperf.css:617, 637). */
.ep-action:hover {
  color: var(--gold);
  background: var(--gold-bg);
}

.ep-action--active,
.ep-action--ecoute {
  color: var(--gold);
  background: var(--gold-bg);
}

/* État d'écoute : l'animation porte l'information (micro actif) */
.ep-action--ecoute svg {
  animation: ep-ecoute 1.6s var(--ease-in-out) infinite;
}

@keyframes ep-ecoute {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

/* Indisponible : l'information est portée par l'attribut + l'infobulle,
   la teinte ne fait que la renforcer (WCAG 1.4.1) */
.ep-action--indisponible {
  color: var(--muted);
  opacity: 0.5;
  cursor: not-allowed;
}

.ep-action--indisponible:hover {
  color: var(--muted);
  background: transparent;
}

.ep-dictee {
  padding: 6px 14px 0;
  font-size: 12px;
  color: var(--gold);
}

/* ---------- Pièce jointe ---------- */

.ep-piece {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 12px 0;
  padding: 8px 10px;
  border: 1px solid var(--gold-border);
  border-radius: var(--arrondi-input);
  background: var(--gold-bg);
}

.ep-piece__apercu {
  width: 38px;
  height: 38px;
  object-fit: cover;
  border-radius: var(--arrondi-input);
  border: 1px solid var(--border);
}

.ep-piece__icone {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: var(--arrondi-input);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--gold);
}

.ep-piece__nom {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ep-piece__retirer {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: var(--card);
  color: var(--muted);
  display: grid;
  place-items: center;
  transition: color var(--t-fast) var(--ease-out);
}

.ep-piece__retirer:hover {
  color: var(--red-text);
}

/* ---------- Mention légale ---------- */

.ep-legal {
  padding: 0 14px 8px;
  font-size: 10.5px;
  text-align: center;
}

.ep-legal a {
  color: var(--muted);
  text-decoration: underline;
}

.ep-legal a:hover {
  color: var(--gold);
}

/* Plein écran mobile (iframe) : respecter la barre home de l'iPhone */
@media (max-width: 668px) {
  .ep-input-zone {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
