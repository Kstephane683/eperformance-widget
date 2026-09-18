<template>
  <!--
    Écran d'attente hors-ligne.

    Il ne REMPLACE pas l'application : il la recouvre. Le fil, la conversation
    et l'état des stores restent en mémoire — au retour du réseau, le voile
    disparaît et Mia reprend exactement où elle en était, sans rechargement.
    Aucun emoji (règle n°8), et le ton dit la vérité : Mia ne peut pas répondre
    sans réseau, elle n'a pas perdu la conversation.
  -->
  <div
    v-if="horsLigne"
    class="ep-voile"
    role="alertdialog"
    aria-labelledby="ep-hors-ligne-titre"
    aria-describedby="ep-hors-ligne-texte"
    data-testid="ecran-hors-ligne"
    tabindex="-1"
    ref="voileEl"
  >
    <div class="ep-voile__carte">
      <span class="ep-voile__icone" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 3l18 18M9.5 5.5a10.4 10.4 0 0 1 5 0M5.5 9.2a14.9 14.9 0 0 1 4-1.7M18.6 9.3a15 15 0 0 0-2.3-.9M2.6 12.6a19.6 19.6 0 0 1 3.6-1.6M21.4 12.6a19.6 19.6 0 0 0-4.6-1.9"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
          <path d="M12 19.2h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </span>

      <h2 id="ep-hors-ligne-titre" class="ep-voile__titre">Mia a besoin du réseau</h2>

      <p id="ep-hors-ligne-texte" class="ep-voile__texte">
        Votre appareil est hors ligne : Mia ne peut pas répondre pour l’instant. Votre
        conversation est conservée et reprendra d’elle-même dès que la connexion sera rétablie.
      </p>

      <button type="button" class="ep-voile__bouton" @click="reessayer">Réessayer</button>

      <p class="ep-voile__aide">
        Si vous êtes connecté, fermez puis rouvrez Mia : la reprise est automatique.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Écran d'attente hors-ligne — état lu par `helpers/reseau.ts` (événements
 * `online`/`offline` du navigateur). Le retour à la normale est automatique :
 * aucun rechargement, aucune action demandée au visiteur.
 */
import { nextTick, onMounted, ref, watch } from 'vue'

import { horsLigne, initReseau, reverifierReseau } from '@/helpers/reseau'

const voileEl = ref<HTMLElement | null>(null)

/** Le focus entre dans l'écran d'attente : le clavier ne reste pas dans le vide */
watch(horsLigne, async (actif) => {
  if (!actif) return
  await nextTick()
  voileEl.value?.focus()
})

function reessayer() {
  reverifierReseau()
}

onMounted(() => {
  initReseau()
})
</script>

<style scoped>
/* Voile opaque : rien de l'application ne doit rester cliquable derrière */
.ep-voile {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--bg);
  text-align: center;
}

.ep-voile:focus {
  outline: none;
}

.ep-voile__carte {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-width: 22rem;
}

.ep-voile__icone {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--gold-bg);
  border: 1px solid var(--gold-border);
  color: var(--gold);
}

.ep-voile__titre {
  font-family: var(--police-titres);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text);
}

.ep-voile__texte {
  font-size: 14px;
  line-height: 1.6;
  color: var(--soft);
}

/* Action principale : recette .btn-gold du site */
.ep-voile__bouton {
  margin-top: 4px;
  padding: 12px 24px;
  border: none;
  border-radius: var(--arrondi-bouton);
  background: var(--gold);
  color: var(--on-gold);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--shadow-gold);
  transition: background-color var(--t) var(--ease-out), transform var(--t-fast) var(--ease-out);
}

.ep-voile__bouton:hover {
  background: var(--gold2);
}

.ep-voile__bouton:active {
  transform: translateY(1px);
}

.ep-voile__aide {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--muted);
}
</style>
